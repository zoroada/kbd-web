/* Copyright 2023 Cipulot
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
#include "ec_switch_matrix.h"
#include "via.h"

#ifdef VIA_ENABLE
/* Integration: raw_hid_receive -> via_custom_value_command -> this KB hook.
 * Do not add id_matrix_adc to the top-level command switch.
 * The existing raw_hid_receive sends the reply; do not send it here again.
 * Full 32-byte packets, zero padded, big-endian signed int16 ADC:
 * SET key baseline: 14 00 06 row col adc_hi adc_lo
 * GET key baseline: 15 00 06 row col 00 00
 * GET reply:        15 00 06 row col adc_hi adc_lo
 * SET updates only the selected key and automatically saves ec_config.
 */
#define EC_BASELINE_MAGIC 0x45434231UL
#define EC_OFFSET_MIN 50
#define EC_ADC_MAX 1024

enum via_enums {
    id_baseline_magic = 1,
    id_actuation_offset = 2,
    id_release_offset = 3,
    id_noise_floor = 4,
    id_calibrate = 5,
    id_matrix_adc = 6,
    id_save_config = 13,
};

static uint16_t get_u16(const uint8_t *p) {
    return ((uint16_t)p[0] << 8) | p[1];
}
static void put_u16(uint8_t *p, uint16_t value) {
    p[0] = (uint8_t)(value >> 8);
    p[1] = (uint8_t)value;
}

/* Storage size must match ec_config_t; storage API has no error return. */
void ec_save_config(void) {
    ec_config.baseline_magic = EC_BASELINE_MAGIC;
    eeconfig_update_kb_datablock(&ec_config, 0, sizeof(ec_config));
}

bool ec_restore_config(void) {
    eeprom_ec_config_t saved = {0};
    eeconfig_read_kb_datablock(&saved, 0, sizeof(saved));
    if (saved.baseline_magic != EC_BASELINE_MAGIC ||
        saved.actuation_offset < EC_OFFSET_MIN ||
        saved.actuation_offset > EC_ADC_MAX ||
        saved.release_offset < EC_OFFSET_MIN ||
        saved.release_offset > EC_ADC_MAX) return false;
    for (uint8_t row = 0; row < MATRIX_ROWS; row++) {
        for (uint8_t col = 0; col < MATRIX_COLS; col++) {
            if (saved.noise_floor[row][col] > EC_ADC_MAX) return false;
        }
    }
    ec_config = saved;
    return true;
}

/* Buffer offsets and sizes are bytes. The wire encoding is big endian,
 * independent of the native EEPROM structure byte order. */
bool dynamic_adc_get_buffer(void *data, uint32_t offset, uint32_t length) {
    if (!data || length > 26 || (offset & 1) || (length & 1) ||
        offset > sizeof(ec_config.noise_floor) ||
        length > sizeof(ec_config.noise_floor) - offset) return false;
    uint8_t *out = data;
    for (uint32_t i = 0; i < length; i += 2) {
        uint32_t key = (offset + i) / 2;
        put_u16(&out[i], (uint16_t)ec_config.noise_floor[key / MATRIX_COLS][key % MATRIX_COLS]);
    }
    return true;
}
bool dynamic_adc_set_buffer(const void *data, uint32_t offset, uint32_t length) {
    if (!data || length > 26 || (offset & 1) || (length & 1) ||
        offset > sizeof(ec_config.noise_floor) ||
        length > sizeof(ec_config.noise_floor) - offset) return false;
    const uint8_t *in = data;
    for (uint32_t i = 0; i < length; i += 2)
        if (get_u16(&in[i]) > EC_ADC_MAX) return false;
    for (uint32_t i = 0; i < length; i += 2) {
        uint32_t key = (offset + i) / 2;
        ec_config.noise_floor[key / MATRIX_COLS][key % MATRIX_COLS] = get_u16(&in[i]);
    }
    if (length) ec_save_config();
    return true;
}

void via_config_set_value(uint8_t *data) {
    uint8_t *value = &data[1];
    switch (data[0]) {
        case id_noise_floor:
            if (dynamic_adc_set_buffer(&value[3], get_u16(value), value[2])) return;
            break;
        case id_actuation_offset:
        case id_release_offset: {
            const uint16_t n = get_u16(value);
            if (n < EC_OFFSET_MIN || n > EC_ADC_MAX) break;
            const uint16_t old = data[0] == id_actuation_offset ?
                ec_config.actuation_offset : ec_config.release_offset;
            if (old != n || ec_config.baseline_magic != EC_BASELINE_MAGIC) {
                if (data[0] == id_actuation_offset) ec_config.actuation_offset = n;
                else ec_config.release_offset = n;
                ec_save_config();
            }
            return;
        }
        case id_matrix_adc: {
            const uint8_t row = value[0], col = value[1];
            const uint16_t raw = get_u16(&value[2]);
            const int32_t n = raw < 0x8000 ? raw : (int32_t)raw - 65536;
            if (row >= MATRIX_ROWS || col >= MATRIX_COLS || n > EC_ADC_MAX) break;
            if (ec_config.noise_floor[row][col] != n ||
                ec_config.baseline_magic != EC_BASELINE_MAGIC) {
                ec_config.noise_floor[row][col] = (int16_t)n;
                ec_save_config();
            }
            return;
        }
        case id_calibrate:
            if (value[0] != 1) break;
            ec_noise_floor();
            ec_save_config();
            return;
        case id_save_config:
            if (value[0] != 0) break;
            ec_save_config();
            return;
        default:
            break;
    }
    data[0] = id_unhandled;
}

void via_config_get_value(uint8_t *data) {
    uint8_t *value = &data[1];
    switch (data[0]) {
        case id_noise_floor:
            if (dynamic_adc_get_buffer(&value[3], get_u16(value), value[2])) return;
            break;
        case id_baseline_magic: {
            const uint32_t magic = ec_config.baseline_magic;
            value[0] = (uint8_t)(magic >> 24);
            value[1] = (uint8_t)(magic >> 16);
            value[2] = (uint8_t)(magic >> 8);
            value[3] = (uint8_t)magic;
            return;
        }
        case id_actuation_offset:
            put_u16(value, ec_config.actuation_offset);
            return;
        case id_release_offset:
            put_u16(value, ec_config.release_offset);
            return;
        case id_matrix_adc: {
            const uint8_t row = value[0], col = value[1];
            if (row >= MATRIX_ROWS || col >= MATRIX_COLS) break;
            put_u16(&value[2], (uint16_t)ec_config.noise_floor[row][col]);
            return;
        }
        default:
            break;
    }
    data[0] = id_unhandled;
}

void via_custom_value_command_kb(uint8_t *data, uint8_t length) {
    if (!data || !length) return;
    if (length < 3 || data[1] != id_custom_channel) {
        data[0] = id_unhandled;
        return;
    }
    const bool get = data[0] == id_custom_get_value;
    const bool set = data[0] == id_custom_set_value;
    const uint8_t id = data[2];
    uint8_t required = 0;
    if (get) {
        switch (id) {
            case id_baseline_magic: required = 7; break;
            case id_actuation_offset:
            case id_release_offset: required = 5; break;
            case id_noise_floor: required = 32; break;
            case id_matrix_adc: required = 7; break;
        }
    } else if (set) {
        switch (id) {
            case id_actuation_offset:
            case id_release_offset: required = 5; break;
            case id_noise_floor: required = 32; break;
            case id_matrix_adc: required = 7; break;
            case id_calibrate:
            case id_save_config: required = 4; break;
        }
    }
    if (!required || length < required) {
        data[0] = id_unhandled;
        return;
    }
    if (get) via_config_get_value(&data[2]);
    else via_config_set_value(&data[2]);
    if (data[2] == id_unhandled) {
        data[0] = id_unhandled;
        data[2] = id;
    }
}
#endif

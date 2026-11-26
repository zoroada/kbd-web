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
#include <string.h>

#ifdef VIA_ENABLE
/* Custom channel 0, 32-byte VIA packets. All 16-bit fields are big endian.
 * GET  08 00 0C row col -> 08 00 0C row col adc_hi adc_lo
 * SET  07 00 09 00     -> status at byte 3 (0 = accepted)
 * SET  07 00 0D 00     -> save current baseline; status at byte 3
 * GET  08 00 0E        -> rows, cols, version=1, signed16=1 at bytes 3..6
 * Other commands return id_unhandled. Calibration/save must not be retried.
 */
#define EC_BASELINE_MAGIC 0x45434231UL

/* Call after the existing EEPROM block has been loaded, and after the last
 * startup ec_noise_floor() call. false means no saved baseline is available.
 */
bool ec_baseline_restore(void) {
    if (eeprom_ec_config.baseline_magic != EC_BASELINE_MAGIC) return false;
    memcpy(ec_config.noise_floor, eeprom_ec_config.baseline_adc,
           sizeof(ec_config.noise_floor));
    return true;
}

void ec_baseline_save(void) {
    memcpy(eeprom_ec_config.baseline_adc, ec_config.noise_floor,
           sizeof(eeprom_ec_config.baseline_adc));
    eeprom_ec_config.baseline_magic = EC_BASELINE_MAGIC;
    eeconfig_update_kb_datablock(&eeprom_ec_config, 0, EECONFIG_KB_DATA_SIZE);
}

bool ec_baseline_read(uint8_t row, uint8_t col, int16_t *value) {
    if (!value || row >= MATRIX_ROWS || col >= MATRIX_COLS) return false;
    *value = ec_config.noise_floor[row][col];
    return true;
}

void via_custom_value_command_kb(uint8_t *data, uint8_t length) {
    if (!data || length == 0) return;
    if (length < 3) { data[0] = id_unhandled; return; }
    if (data[1] != id_custom_channel) { data[0] = id_unhandled; return; }
    if (data[0] == id_custom_get_value) {
        if (data[2] == 12 && length >= 7) {
            const uint8_t row = data[3], col = data[4];
            int16_t reading;
            if (!ec_baseline_read(row, col, &reading)) {
                data[0] = id_unhandled;
                return;
            }
            const uint16_t value = (uint16_t)reading;
            data[5] = (uint8_t)(value >> 8);
            data[6] = (uint8_t)value;
            return;
        }
        if (data[2] == 14 && length >= 7) {
            data[3] = MATRIX_ROWS;
            data[4] = MATRIX_COLS;
            data[5] = 1; /* protocol version */
            data[6] = 1; /* signed int16 ADC */
            return;
        }
    } else if (data[0] == id_custom_set_value && length >= 4 && data[3] == 0) {
        if (data[2] == 9) {
            ec_noise_floor();
            data[3] = 0;
            return;
        }
        if (data[2] == 13) {
            ec_baseline_save();
            data[3] = 0;
            return;
        }
    }
    data[0] = id_unhandled;
}
#endif

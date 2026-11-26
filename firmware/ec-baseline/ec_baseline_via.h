/* SPDX-License-Identifier: GPL-3.0-or-later */
#pragma once
#include <stdint.h>
#include <stdbool.h>

#ifdef VIA_ENABLE
bool ec_baseline_read(uint8_t row, uint8_t col, int16_t *value);
void ec_baseline_save(void);
bool ec_baseline_restore(void);
#endif

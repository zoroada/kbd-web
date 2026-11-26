/* SPDX-License-Identifier: GPL-3.0-or-later */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#ifdef VIA_ENABLE
void ec_save_config(void);
bool ec_restore_config(void);
void via_config_set_value(uint8_t *data);
void via_config_get_value(uint8_t *data);
#endif

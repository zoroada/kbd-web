// SPDX-License-Identifier: GPL-2.0-or-later
// Display text comes from vial-gui's Keycode definitions, including line breaks.
export function createLabeler(codes, labels) {
  const names = new Map();
  for (const [name, text] of Object.entries(labels)) {
    if (Number.isInteger(codes[name]) && !name.includes('(kc)')) names.set(codes[name], text);
  }
  const ranges = [['QK_MOMENTARY','MO'],['QK_TO','TO'],['QK_DEF_LAYER','DF'],['QK_PERSISTENT_DEF_LAYER','PDF'],['QK_TOGGLE_LAYER','TG'],['QK_ONE_SHOT_LAYER','OSL'],['QK_LAYER_TAP_TOGGLE','TT']];
  return function label(code) {
    if (names.has(code)) return names.get(code);
    for (const [base,name] of ranges) {
      if (codes[base] !== undefined && code >= codes[base] && code < codes[base]+32) return `${name}(${code-codes[base]})`;
    }
    if (codes.QK_MACRO !== undefined && code >= codes.QK_MACRO && code < codes.QK_MACRO+128) return `M${code-codes.QK_MACRO}`;
    if (codes.QK_TAP_DANCE !== undefined && code >= codes.QK_TAP_DANCE && code < codes.QK_TAP_DANCE+256) return `TD(${code-codes.QK_TAP_DANCE})`;
    for (const [name,value] of Object.entries(codes)) {
      if (name.endsWith('(kc)') && (code & 0xff00)===value && labels[name]) return labels[name].replace('(kc)', names.get(code & 255) ?? `0x${(code&255).toString(16)}`);
    }
    return `0x${code.toString(16).padStart(4,'0')}`;
  };
}
export const encoderDirection = direction => direction === 0 ? '↺ 逆时针' : '↻ 顺时针';

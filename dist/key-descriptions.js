// SPDX-License-Identifier: GPL-2.0-or-later
const meanings={
KC_NO:'不发送任何按键；此位置禁用。',KC_TRNS:'透明键：继续使用下方有效层在同一位置的按键。',
KC_ESCAPE:'Escape：退出或取消当前操作。',KC_ENTER:'回车：确认或换行。',KC_BSPACE:'退格：删除光标前的字符。',KC_DELETE:'Delete：删除光标后的字符或所选内容。',KC_TAB:'Tab：制表或切换焦点。',KC_SPACE:'输入空格。',KC_CAPSLOCK:'切换英文字母大小写锁定。',KC_NUMLOCK:'切换数字小键盘锁定。',KC_PSCREEN:'Print Screen：截取屏幕，具体行为由系统决定。',KC_SCROLLLOCK:'切换滚动锁定。',KC_PAUSE:'Pause / Break：暂停或中断，由当前应用决定。',KC_INSERT:'切换插入／覆盖输入模式。',KC_HOME:'跳到行首或内容开头。',KC_END:'跳到行尾或内容末尾。',KC_PGUP:'向上翻页。',KC_PGDOWN:'向下翻页。',KC_LEFT:'光标向左移动。',KC_RIGHT:'光标向右移动。',KC_UP:'光标向上移动。',KC_DOWN:'光标向下移动。',KC_APPLICATION:'打开上下文菜单。',
BL_TOGG:'切换单色背光的开启／关闭。',BL_STEP:'循环切换单色背光亮度档位。',BL_BRTG:'开启或关闭背光呼吸效果。',BL_ON:'将单色背光开启至最大亮度。',BL_OFF:'关闭单色背光。',BL_INC:'提高单色背光亮度。',BL_DEC:'降低单色背光亮度。',RGB_TOG:'开启或关闭 RGB 灯光。',RGB_MOD:'切换到下一个 RGB 灯效模式。',RGB_RMOD:'切换到上一个 RGB 灯效模式。',RGB_HUI:'增加 RGB 色相，改变灯光颜色。',RGB_HUD:'降低 RGB 色相，反向改变灯光颜色。',RGB_SAI:'增加 RGB 饱和度，让颜色更鲜艳。',RGB_SAD:'降低 RGB 饱和度，让颜色更接近白色。',RGB_VAI:'提高 RGB 灯光亮度。',RGB_VAD:'降低 RGB 灯光亮度。',RGB_SPI:'加快 RGB 灯效播放速度。',RGB_SPD:'减慢 RGB 灯效播放速度。',
RM_ON:'开启 RGB Matrix 矩阵灯光。',RM_OFF:'关闭 RGB Matrix 矩阵灯光。',RM_TOGG:'切换 RGB Matrix 矩阵灯光的开启／关闭。',RM_NEXT:'切换到下一个矩阵灯效。',RM_PREV:'切换到上一个矩阵灯效。',RM_HUEU:'增加矩阵灯光色相，改变颜色。',RM_HUED:'降低矩阵灯光色相，反向改变颜色。',RM_SATU:'增加矩阵灯光饱和度。',RM_SATD:'降低矩阵灯光饱和度。',RM_VALU:'提高矩阵灯光亮度。',RM_VALD:'降低矩阵灯光亮度。',RM_SPDU:'加快矩阵灯效播放速度。',RM_SPDD:'减慢矩阵灯效播放速度。',
KC_VOLU:'提高系统音量。',KC_VOLD:'降低系统音量。',KC_MUTE:'切换系统静音。',KC_MPLY:'媒体播放／暂停。',KC_MNXT:'下一首／下一个媒体项目。',KC_MPRV:'上一首／上一个媒体项目。',KC_MSTP:'停止媒体播放。',QK_BOOT:'进入固件引导模式，用于刷写固件；键盘可能暂时断开。',QK_REBOOT:'重新启动键盘。',QK_CLEAR_EEPROM:'清除键盘 EEPROM 配置，恢复固件默认设置。'
};
const modes={P:'常亮',B:'呼吸',R:'彩虹',SW:'旋涡',SN:'贪吃蛇',K:'往返扫描',X:'圣诞',G:'渐变',T:'测试'};
export function describeKey(name,display='',original={}){
 if(meanings[name])return meanings[name];
 const layer=name.match(/^(MO|TO|DF|TG|OSL|TT|PDF)\((\d+)\)$/);
 if(layer){const [,type,n]=layer;return {MO:`按住时启用第 ${n} 层，松开后退出。`,TO:`切换到第 ${n} 层，并关闭其他非默认层。`,DF:`将第 ${n} 层设为默认层（通常不跨重启保存）。`,PDF:`将第 ${n} 层设为默认层并持久保存。`,TG:`切换第 ${n} 层的开启／关闭。`,OSL:`为下一次按键临时启用第 ${n} 层。`,TT:`按住时启用第 ${n} 层；连续轻点达到固件阈值时切换该层。`}[type]}
 if(/^M\d+$/.test(name))return `执行宏 ${name.slice(1)} 中配置的动作序列。`;
 if(/^TD\(\d+\)$/.test(name))return `执行 ${name} 的轻点、长按或双击动作，由 Tap Dance 配置决定。`;
 if(name.startsWith('RGB_M_'))return `将 RGB 灯光切换为${modes[name.slice(6)]||display.replaceAll('\n',' ')}效果。`;
 if(/^KC_[A-Z]$/.test(name))return `输入字母 ${name.slice(3)}；大小写取决于 Shift 和 Caps Lock 状态。`;
 if(/^KC_[0-9]$/.test(name))return `输入数字 ${name.slice(3)}；按住 Shift 时输入键帽上方的符号。`;
 if(/^KC_F\d+$/.test(name))return `发送 ${name.slice(3)} 功能键，具体操作由当前应用决定。`;
 if(/^KC_[LR](CTRL|SHIFT|ALT|GUI)$/.test(name)){const m=name.match(/^KC_([LR])(.*)$/);return `${m[1]==='L'?'左':'右'}侧 ${m[2]==='GUI'?'系统修饰键（Windows 键／Mac Command）':m[2]+' 修饰键'}，可与其他按键组合使用。`}
 if(name.startsWith('KC_KP_'))return `发送数字小键盘的「${display.replaceAll('\n',' ')}」按键；受 Num Lock 和系统设置影响。`;
 if(name.endsWith('(kc)'))return `${original[name]||display.replaceAll('\n',' ')}。点击后选择基础键码，组成修饰或轻点／长按功能。`;
 if(original[name])return original[name];
 if(/^USER|^QK_KB/.test(name))return '用户／键盘自定义功能，具体作用由键盘固件定义。';
 return `发送「${display.replaceAll('\n',' ')||name}」按键；输出及操作由当前系统、键盘布局和应用决定。`;
}
export function attachKeyHint(button,meaning,identity=''){
 const text=meaning+(identity?'\n'+identity:'');button.title=text;
 button.setAttribute('aria-description',text);
 // Native title supports mouse hover; a shared visible hint also supports keyboard focus.
 button.addEventListener('pointerenter',()=>showHint(button,text));
 button.addEventListener('focus',()=>showHint(button,text));
 button.addEventListener('pointerleave',hideHint);button.addEventListener('blur',hideHint);button.addEventListener('click',hideHint);
}
let tip;
function hideHint(){if(tip)tip.hidden=true}
function showHint(button,text){if(!tip){tip=document.createElement('div');tip.className='key-hint';tip.setAttribute('role','tooltip');document.body.append(tip);window.addEventListener('scroll',hideHint,true);window.addEventListener('resize',hideHint)}tip.textContent=text;tip.hidden=false;const r=button.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,window.innerWidth-330))+'px';tip.style.top=Math.max(8,r.top-tip.offsetHeight-8)+'px'}

const englishBasic={KC_NO:'No key: sends no input.',KC_TRNS:'Transparent: use the key at this position on the next active lower layer.',KC_ESCAPE:'Escape: cancel or exit.',KC_ENTER:'Enter: confirm or insert a line break.',KC_BSPACE:'Backspace: delete the character before the cursor.',KC_DELETE:'Delete: remove the character after the cursor or the selected item.',KC_TAB:'Tab: insert a tab or move focus.',KC_SPACE:'Insert a space.',KC_CAPSLOCK:'Toggle Caps Lock.',KC_NUMLOCK:'Toggle Num Lock.',KC_PSCREEN:'Print Screen: capture the screen; behavior depends on the operating system.',KC_SCROLLLOCK:'Toggle Scroll Lock.',KC_PAUSE:'Pause / Break: behavior depends on the application.',KC_INSERT:'Toggle insert / overwrite mode.',KC_HOME:'Move to the beginning of the line or content.',KC_END:'Move to the end of the line or content.',KC_PGUP:'Page up.',KC_PGDOWN:'Page down.',KC_LEFT:'Move left.',KC_RIGHT:'Move right.',KC_UP:'Move up.',KC_DOWN:'Move down.',KC_APPLICATION:'Open the context menu.'};
export function englishDescription(name,display='',original={}){
 if(original[name])return original[name];
 if(englishBasic[name])return englishBasic[name];
 const layer=name.match(/^(MO|TO|DF|TG|OSL|TT|PDF)\((\d+)\)$/);
 if(layer){const [,type,n]=layer;return {MO:`Activate layer ${n} while held; release to deactivate.`,TO:`Switch to layer ${n}, disabling other non-default layers.`,DF:`Set layer ${n} as the default layer.`,PDF:`Persistently set layer ${n} as the default layer.`,TG:`Toggle layer ${n} on or off.`,OSL:`Activate layer ${n} for the next keypress.`,TT:`Hold to activate layer ${n}; tap repeatedly to toggle it.`}[type]}
 if(/^M\d+$/.test(name))return `Run the action sequence configured in macro ${name.slice(1)}.`;
 if(/^TD\(\d+\)$/.test(name))return `Run the tap, hold or double-tap action configured in ${name}.`;
 if(/^KC_[A-Z]$/.test(name))return `Type the letter ${name.slice(3)}. Case depends on Shift and Caps Lock.`;
 if(/^KC_[0-9]$/.test(name))return `Type ${name.slice(3)}; hold Shift to type the upper symbol.`;
 if(/^KC_F\d+$/.test(name))return `Send the ${name.slice(3)} function key; behavior depends on the application.`;
 if(/^KC_[LR](CTRL|SHIFT|ALT|GUI)$/.test(name)){const [,side,mod]=name.match(/^KC_([LR])(.*)$/);return `${side==='L'?'Left':'Right'} ${mod==='GUI'?'GUI modifier (Windows / Command)':mod+' modifier'}. Combine with other keys.`}
 if(name.startsWith('KC_KP_'))return `Send numeric keypad ${display.replaceAll('\n',' ')}; behavior depends on Num Lock and the system.`;
 if(/^USER|^QK_KB/.test(name))return 'Custom keyboard function. Its behavior is defined by the firmware.';
 return `Send ${display.replaceAll('\n',' ')||name}; behavior depends on the system, keyboard layout and application.`;
}
function chineseFallback(name,display,original){
 const text=original[name]||'';
 const terms={'Left':'左侧','Right':'右侧','Control':'Ctrl 控制键','Shift':'Shift 换挡键','Alt':'Alt 修饰键','GUI':'系统修饰键','Caps Lock':'大写锁定键','Escape':'退出键','Backspace':'退格键','both sides':'左右两侧',' and ':'与','`':'反引号','\\':'反斜杠'};
 const translate=s=>{for(const [a,b] of Object.entries(terms).sort((a,b)=>b[0].length-a[0].length))s=s.replaceAll(a,b);return s};
 if(text.startsWith('Swap '))return '交换'+translate(text.slice(5))+'的功能。';
 if(text.startsWith('Unswap '))return '取消交换'+translate(text.slice(7))+'的功能。';
 if(text.startsWith('Toggle '))return '切换'+translate(text.slice(7))+'。';
 if(text.startsWith('Disable '))return '禁用'+translate(text.slice(8))+'。';
 if(text.startsWith('Enable '))return '启用'+translate(text.slice(7))+'。';
 return `「${display.replaceAll('\n',' ')||name}」功能键；详细行为见下方英文原版说明。`;
}
export function bilingualDescription(name,display='',original={}){
 let chinese=describeKey(name,display,original);
 if(!/[\u3400-\u9fff]/.test(chinese))chinese=chineseFallback(name,display,original);
 return `${chinese}\n${englishDescription(name,display,original)}`;
}

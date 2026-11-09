import {describeKey,bilingualDescription,attachKeyHint} from './key-descriptions.js';
// SPDX-License-Identifier: GPL-2.0-or-later
// Layouts and categories are exported from the Vial desktop application.
const make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
let paletteDataPromise;
function paletteData(){return paletteDataPromise??=Promise.all(['vial-palette.json','vial-descriptions.json'].map(async path=>{const response=await fetch(path);if(!response.ok)throw Error('选择区资料加载失败');return response.json()})).catch(e=>{paletteDataPromise=undefined;throw e})}
export async function mountPalette(host,ctx){
 const [data,descriptions]=await paletteData();
 const {codes,label,pick,act,macroCount,tapCount,comboCount,overrideCount=0,repeatCount=0,readCards,editCard,layers}=ctx;
 const tabs=ctx.basicOnly?['Basic','ISO/JIS','App, Media and Mouse']:['Basic','ISO/JIS','Layers','Quantum','Backlight','App, Media and Mouse','Tap Dance','Combo','Key Override','Alt Repeat Key','User','Macro'];
 const root=make('div','vial-selector'),nav=make('div','vial-tabs'),viewport=make('div','vial-tab-viewport');
 nav.setAttribute('role','tablist');root.append(nav,viewport);host.append(root);
 const buttons=[];
 const choose=(code)=>act(()=>pick(code));
 function key(name,code=codes[name]){if(!Number.isInteger(code))return null;const b=make('button','palette-key',name.endsWith('(kc)')?name.replace('(kc)','\n(kc)').replace('LSFT','LSft').replace('LCTL','LCtl').replace('RSFT','RSft').replace('RCTL','RCtl'):label(code));const user=ctx.userKeys?.find(k=>k.code===code);attachKeyHint(b,user?(user.custom?user.description:`用户自定义按键 ${code-codes.QK_KB}，具体功能由键盘固件定义。\n${user.description}; behavior is defined by the keyboard firmware.`):bilingualDescription(name,label(code),descriptions),name+' · 0x'+code.toString(16).padStart(4,'0'));b.setAttribute('aria-label',label(code).replaceAll('\n',' ')||'空按键');b.onclick=()=>{if(name.endsWith('(kc)')){act(async()=>{await ctx.openKeyPicker(0,base=>{if(base>255)throw Error('请选择基础按键');return pick(code|base)},'选择基础按键',{basicOnly:true})})}else choose(code)};return b}
 function flow(names,body){const f=make('div','key-flow');for(const name of names){const b=key(name);if(b)f.append(b)}body.append(f)}
 function physical(rows,body){const wrap=make('div','palette-layout-scroll'),board=make('div','palette-layout');let y=0,max=0;
 for(const row of rows){let x=0,w=1,h=1;for(const item of row){if(typeof item==='object'){x+=item.x||0;y+=item.y||0;w=item.w||w;h=item.h||h;continue}const b=key(item);if(b){b.classList.add('layout-key');Object.assign(b.style,{left:`${x*100/23}%`,top:`${y*100/6.25}%`,width:`${(w-.09)*100/23}%`,height:`${(h-.09)*100/6.25}%`});board.append(b)}x+=w;max=Math.max(max,x);w=h=1}y++}wrap.append(board);body.append(wrap)}
 function any(){const b=make('button','palette-key','Any');attachKeyHint(b,'手动输入 QMK 键码名称或十六进制数值，分配自定义按键。\nEnter a QMK keycode name or hexadecimal value to assign a custom key.','Any');b.onclick=()=>act(async()=>{const value=prompt('输入 QMK 键码名称或 16 位数值（例如 KC_A / 0x0004）');if(value===null)return;const code=codes[value]??Number(value);if(!Number.isInteger(code)||code<0||code>65535)throw Error('无效键码');await pick(code)});return b}
 const panels=new Map();let active=ctx.initialTab||'Basic',disposed=false;
 function prepare(tab){
  if(panels.has(tab))return panels.get(tab);
  const pane=make('div','vial-tab-body');panels.set(tab,pane);
  pane.append(make('p','muted','正在后台读取配置…'));
  build(tab,pane).catch(error=>{pane.replaceChildren();pane.append(make('p','muted','读取失败：'+error.message));const retry=make('button','','重新读取');retry.onclick=()=>{panels.delete(tab);const fresh=prepare(tab);if(active===tab)viewport.replaceChildren(fresh)};pane.append(retry)});
  return pane;
 }
 function draw(tab){active=tab;ctx.onTabChange?.(tab);buttons.forEach((b,i)=>{b.classList.toggle('active',tabs[i]===tab);b.setAttribute('aria-selected',String(tabs[i]===tab))});viewport.replaceChildren(prepare(tab))}
 async function build(tab,body){body.replaceChildren();
 if(tab==='Basic'||tab==='ISO/JIS'){physical(data.layouts[tab==='Basic'?'ansi_100':'iso_100'],body);const extras=make('div','key-flow');extras.append(any());for(const n of [...data.groups.KEYCODES_SPECIAL,...data.groups.KEYCODES_SHIFTED]){const b=key(n);if(b)extras.append(b)}body.append(extras);return}
 if(tab==='User'){flow((ctx.userKeys||[]).map(k=>k.id),body);return}
 if(tab==='Quantum'){
  body.classList.add('quantum-compact');
  const columns=Array.from({length:8},()=>{const column=make('div','quantum-column');body.append(column);return column});
  const columnFor={'单次修饰':0,'组合修饰':1,'点按 / 长按':2,'双用途':2,'设备':3,'全键无冲 / 分体':3,'键位设置':4,'声音 / 音乐':5,'触觉反馈':6,'自动 Shift':7,'组合 / 重复':7,'其他':7};
  const section=(title,groups)=>{
   for(const [heading,names] of groups){
    const valid=names.filter(n=>Number.isInteger(codes[n]));if(!valid.length)continue;
    const box=make('section','quantum-region');box.dataset.kind=title;
    box.style.setProperty('--region-span',valid.length>24?'4':valid.length>14?'3':valid.length>8?'2':'2');
    box.append(make('h4','',heading));flow(valid,box);columns[columnFor[heading]??7].append(box);
   }
  };
  const mods=data.groups.KEYCODES_MODIFIERS||[],quantum=data.groups.KEYCODES_QUANTUM||[];
  section('修饰键',[
   ['单次修饰',mods.filter(n=>n.startsWith('OSM('))],
   ['组合修饰',mods.filter(n=>n.endsWith('(kc)')&&!n.includes('_T('))],
   ['点按 / 长按',mods.filter(n=>n.includes('_T('))],
   ['双用途',mods.filter(n=>!n.startsWith('OSM(')&&!n.endsWith('(kc)'))]
  ]);
  const functional=[
   ['设备',data.groups.KEYCODES_BOOT||[]],
   ['键位设置',quantum.filter(n=>n.startsWith('MAGIC_')&&!/NKRO|EE_HANDS/.test(n))],
   ['全键无冲 / 分体',quantum.filter(n=>/NKRO|EE_HANDS/.test(n))],
   ['声音 / 音乐',quantum.filter(n=>/^(AU_|CLICKY_|MU_)/.test(n))],
   ['触觉反馈',quantum.filter(n=>n.startsWith('HPT_'))],
   ['自动 Shift',quantum.filter(n=>n.startsWith('KC_AS'))],
   ['组合 / 重复',quantum.filter(n=>/^(CMB_|QK_CAPS_WORD|QK_REPEAT|QK_ALT_REPEAT)/.test(n))]
  ];
  const assigned=new Set(functional.flatMap(g=>g[1]));functional.push(['其他',quantum.filter(n=>!assigned.has(n))]);
  section('功能',functional);return;
 }
 if(tab==='Layers'){const f=make('div','key-flow');for(const [base,name] of [['QK_MOMENTARY','MO'],['QK_TO','TO'],['QK_DEF_LAYER','DF'],['QK_TOGGLE_LAYER','TG'],['QK_ONE_SHOT_LAYER','OSL'],['QK_LAYER_TAP_TOGGLE','TT']])for(let i=0;i<layers;i++){const b=key(`${name}(${i})`,codes[base]+i);if(b)f.append(b)}body.append(f);return}
 if(['Macro','Tap Dance','Combo','Key Override','Alt Repeat Key'].includes(tab)){const type=tab==='Macro'?'macro':tab==='Tap Dance'?'tap':tab==='Key Override'?'override':tab==='Alt Repeat Key'?'repeat':'combo',grid=make('div','entry-cards');body.append(grid);const loading=make('p','muted','正在后台读取配置…');grid.append(loading);const summaries=await readCards(type);grid.replaceChildren();const count=type==='macro'?summaries.length:{tap:tapCount,combo:comboCount,override:overrideCount,repeat:repeatCount}[type];if(!count){grid.append(make('p','muted','当前固件未提供此功能。'));return}
 for(let i=0;i<count;i++){const card=make('div','entry-card'),name=type==='macro'?`M${i}`:type==='tap'?`TD(${i})`:(type==='override'||type==='repeat')?String(i):`Combo ${i}`,main=make('button','entry-main');main.append(make('strong','entry-name',name));const lines=summaries[i]||[];if(!lines.length)main.append(make('span','entry-empty','N/C'));else{const preview=make('span','entry-preview');lines.forEach(line=>preview.append(make('span','',line)));main.append(preview)}attachKeyHint(main,type==='repeat'?'配置替代重复键的原按键与替代按键。\nConfigure the original key and its alternative repeat key.':type==='override'?'满足修饰键条件时，将触发键替换为另一个按键。点击编辑。\nReplace a trigger key when modifier conditions match. Click to edit.':type==='combo'?'同时按下配置的多个输入键时，触发此组合键的输出动作。点击编辑。\nPress the configured input keys together to trigger the combo output. Click to edit.':bilingualDescription(name,name),name+(lines.length?'\n'+lines.join('\n'):' · 尚未配置'));main.onclick=()=>{if(type==='combo'||type==='override'||type==='repeat'){if(ctx.allowEdit!==false)act(()=>editCard(type,i))}else choose(codes[type==='macro'?'QK_MACRO':'QK_TAP_DANCE']+i);grid.querySelectorAll('.entry-card').forEach(c=>c.classList.remove('selected'));card.classList.add('selected')};const edit=make('button','entry-edit','编辑');edit.setAttribute('aria-label',`编辑 ${name}`);attachKeyHint(edit,`打开 ${name} 的动作配置。\nEdit the actions configured in ${name}.`);edit.onclick=()=>act(()=>editCard(type,i));card.append(main);if(ctx.allowEdit!==false)card.append(edit);grid.append(card)}if(type==='override'){body.append(make('p','muted','Key Override 对整个键盘生效，不需要分配到单独按键。'));flow(['QK_KEY_OVERRIDE_TOGGLE','QK_KEY_OVERRIDE_ON','QK_KEY_OVERRIDE_OFF','KO_TOGG','KO_ON','KO_OFF'],body)}return}
 const groups={Quantum:['KEYCODES_BOOT','KEYCODES_MODIFIERS','KEYCODES_QUANTUM'],Backlight:['KEYCODES_BACKLIGHT'],'App, Media and Mouse':['KEYCODES_MEDIA'],User:['KEYCODES_USER']};let names=(groups[tab]||[]).flatMap(g=>data.groups[g]||[]);flow(names,body);
 if(tab==='User'&&!names.length)flow(Object.keys(codes).filter(n=>/^USER|^QK_KB/.test(n)),body);
 }
 tabs.forEach(tab=>{const b=make('button','',tab);b.setAttribute('role','tab');b.onclick=()=>draw(tab);buttons.push(b);nav.append(b)});
 draw(active);
 // Prebuild detached panes and start HID reads after the initial UI is mounted.
 const timer=setTimeout(()=>{if(!disposed)tabs.forEach(prepare)},0);
 const unsubscribe=ctx.subscribe?.(tab=>{if(!tab||disposed)return;panels.delete(tab);const pane=prepare(tab);if(active===tab)viewport.replaceChildren(pane)});
 const observer=new MutationObserver(()=>{if(!root.isConnected){disposed=true;clearTimeout(timer);unsubscribe?.();observer.disconnect()}});observer.observe(document.body,{childList:true,subtree:true});
 return {select:draw};
}

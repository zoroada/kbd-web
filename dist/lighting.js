// SPDX-License-Identifier: GPL-2.0-or-later
import {read16,u16} from './protocol.js?v=bootloader-1';
export const vialEffects={"0": "Disable", "1": "Direct Control", "2": "Solid Color", "3": "Alphas Mods", "4": "Gradient Up Down", "5": "Gradient Left Right", "6": "Breathing", "7": "Band Sat", "8": "Band Val", "9": "Band Pinwheel Sat", "10": "Band Pinwheel Val", "11": "Band Spiral Sat", "12": "Band Spiral Val", "13": "Cycle All", "14": "Cycle Left Right", "15": "Cycle Up Down", "16": "Rainbow Moving Chevron", "17": "Cycle Out In", "18": "Cycle Out In Dual", "19": "Cycle Pinwheel", "20": "Cycle Spiral", "21": "Dual Beacon", "22": "Rainbow Beacon", "23": "Rainbow Pinwheels", "24": "Raindrops", "25": "Jellybean Raindrops", "26": "Hue Breathing", "27": "Hue Pendulum", "28": "Hue Wave", "29": "Typing Heatmap", "30": "Digital Rain", "31": "Solid Reactive Simple", "32": "Solid Reactive", "33": "Solid Reactive Wide", "34": "Solid Reactive Multiwide", "35": "Solid Reactive Cross", "36": "Solid Reactive Multicross", "37": "Solid Reactive Nexus", "38": "Solid Reactive Multinexus", "39": "Splash", "40": "Multisplash", "41": "Solid Splash", "42": "Solid Multisplash", "43": "Pixel Rain", "44": "Pixel Fractal"};
export const qmkEffects={"0": "All Off", "1": "Solid Color", "2": "Breathing 1", "3": "Breathing 2", "4": "Breathing 3", "5": "Breathing 4", "6": "Rainbow Mood 1", "7": "Rainbow Mood 2", "8": "Rainbow Mood 3", "9": "Rainbow Swirl 1", "10": "Rainbow Swirl 2", "11": "Rainbow Swirl 3", "12": "Rainbow Swirl 4", "13": "Rainbow Swirl 5", "14": "Rainbow Swirl 6", "15": "Snake 1", "16": "Snake 2", "17": "Snake 3", "18": "Snake 4", "19": "Snake 5", "20": "Snake 6", "21": "Knight 1", "22": "Knight 2", "23": "Knight 3", "24": "Christmas", "25": "Gradient 1", "26": "Gradient 2", "27": "Gradient 3", "28": "Gradient 4", "29": "Gradient 5", "30": "Gradient 6", "31": "Gradient 7", "32": "Gradient 8", "33": "Gradient 9", "34": "Gradient 10", "35": "RGB Test", "36": "Alternating"};
export async function readLighting(device){
 const type=device.definition.lighting,state={type};
 if(type==='vialrgb'){
  const info=await device.lighting(64);if(read16(info,2)!==1)throw Error('不支持的 VialRGB 版本');
  state.max=info[4];const supported=new Set([0]);let cursor=0,done=false;
  for(let page=0;page<512;page++){
   const data=await device.send(8,66,u16(cursor));let next=cursor;
   for(let i=2;i<32;i+=2){const id=read16(data,i);if(id===65535){done=true;break}supported.add(id);next=Math.max(next,id)}
   if(done)break;if(next===cursor)throw Error('灯效列表未前进');cursor=next;
  }
  if(!done)throw Error('灯效列表过长');
  const a=await device.lighting(65);Object.assign(state,{mode:read16(a,2),speed:a[4],h:a[5],s:a[6],v:a[7],supported:[...supported].sort((a,b)=>a-b)});
 }else{
  if(['qmk_rgblight','qmk_backlight_rgblight'].includes(type)){
   const a=await device.lighting(128),b=await device.lighting(129),c=await device.lighting(130),d=await device.lighting(131);
   Object.assign(state,{max:255,v:a[2],mode:b[2],speed:c[2],h:d[2],s:d[3],supported:Object.keys(qmkEffects).map(Number)});
  }
  if(['qmk_backlight','qmk_backlight_rgblight'].includes(type)){state.backlight=(await device.lighting(9))[2];state.breathing=(await device.lighting(10))[2]}
 }
 return state;
}
export async function writeLighting(device,state,field){
 if(state.type==='vialrgb')return device.lighting(65,[...u16(state.mode),state.speed,state.h,state.s,state.v]);
 const id={mode:129,speed:130,v:128,color:131,backlight:9,breathing:10}[field];
 if(id===undefined)throw Error('无效灯光参数');
 return device.lighting(id,field==='color'?[state.h,state.s]:[state[field]]);
}
export function hsvHex(h,s,v=255){
 h=h/255*6;s/=255;v/=255;const c=v*s,x=c*(1-Math.abs(h%2-1)),m=v-c;
 const rgb=h<1?[c,x,0]:h<2?[x,c,0]:h<3?[0,c,x]:h<4?[0,x,c]:h<5?[x,0,c]:[c,0,x];
 return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
export function hexHS(hex){
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=!d?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;
 return [Math.round(h/6*255),Math.round((max?d/max:0)*255)];
}
export async function mountLighting(host,device,{notice}){
 const state=await readLighting(device),make=(tag,cls)=>{const e=document.createElement(tag);e.className=cls||'';return e};
 if(!state.supported&&state.backlight===undefined){host.textContent='设备定义未声明支持灯光。';return}
 host.classList.add('lighting-panel');const form=make('div','lighting-form');host.append(form);
 let queue=Promise.resolve(),timer,lastError=null;const dirty=new Set();
 const flush=()=>{clearTimeout(timer);const fields=[...dirty];dirty.clear();const snapshot={...state};
  if(!fields.length)return queue;
  queue=queue.then(async()=>{lastError=null;if(state.type==='vialrgb')await writeLighting(device,snapshot,'mode');else for(const f of fields)await writeLighting(device,snapshot,f)}).then(()=>notice('灯光已应用，点击保存可保存到设备。')).catch(e=>{lastError=e;notice('灯光写入失败：'+e.message)});return queue;
 };
 const changed=field=>{dirty.add(field);clearTimeout(timer);timer=setTimeout(flush,70)};
 function row(title,control){const wrap=make('label','lighting-row'),name=make('span');name.textContent=title;wrap.append(name,control);form.append(wrap)}
 function slider(title,field,max=255){
  const wrap=make('div','lighting-slider'),input=make('input'),number=make('input');input.type='range';number.type='number';
  for(const control of [input,number]){control.min=0;control.max=max;control.value=state[field];control.setAttribute('aria-label',title)}
  const update=source=>{const n=Number(source.value);if(!Number.isInteger(n)||n<0||n>max)return;state[field]=n;input.value=number.value=n;changed(field)};
  input.oninput=()=>update(input);number.onchange=()=>update(number);wrap.append(input,number);row(title,wrap);
 }
 if(state.supported){
  const effects=state.type==='vialrgb'?vialEffects:qmkEffects,select=make('select');
  for(const id of state.supported){const o=make('option');o.value=id;o.textContent=effects[id]||`Effect ${id}`;select.append(o)}
  if(!state.supported.includes(state.mode)){const o=make('option');o.value=state.mode;o.textContent=effects[state.mode]||`Effect ${state.mode}`;select.append(o)}
  select.value=state.mode;select.onchange=()=>{state.mode=Number(select.value);changed('mode')};row('RGB Effect',select);
  const color=make('input','lighting-color');color.type='color';color.value=hsvHex(state.h,state.s);color.setAttribute('aria-label','RGB Color');
  const hs=[];color.oninput=()=>{[state.h,state.s]=hexHS(color.value);hs.forEach(([input,field])=>input.value=state[field]);changed('color')};row('RGB Color',color);
  for(const [title,field] of [['色相','h'],['饱和度','s']]){const input=make('input');input.type='number';input.min=0;input.max=255;input.value=state[field];input.onchange=()=>{const v=Number(input.value);if(!Number.isInteger(v)||v<0||v>255)return;state[field]=v;color.value=hsvHex(state.h,state.s);changed('color')};hs.push([input,field]);row(title,input)}
  slider('RGB Brightness','v',state.max);slider('RGB Speed','speed');
 }
 if(state.backlight!==undefined){slider('背光亮度','backlight');const check=make('input');check.type='checkbox';check.checked=!!state.breathing;check.onchange=()=>{state.breathing=Number(check.checked);changed('breathing')};row('背光呼吸',check)}
 const save=make('button','primary');save.textContent='保存';save.onclick=async()=>{save.disabled=true;try{await flush();if(lastError)throw lastError;await device.send(9);notice('灯光已保存到设备。')}catch(e){notice('灯光保存失败：'+e.message)}finally{save.disabled=false}};
 const actions=make('div','lighting-actions');actions.append(save);form.append(actions);
}

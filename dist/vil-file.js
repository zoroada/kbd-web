// SPDX-License-Identifier: GPL-2.0-or-later
export function parseVil(text){
 const data=JSON.parse(text.replace(/^\uFEFF/,'').replace(/("uid"\s*:\s*)(\d+)(?=\s*[,}])/g,'$1"$2"'));
 if(data.version!==1||!Array.isArray(data.layout)||!data.layout.length||data.layout.length>32)throw Error('不是有效的 Vial .vil 配置');
 const rows=data.layout[0]?.length,cols=data.layout[0]?.[0]?.length;
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>32||cols>32)throw Error('VIL 矩阵尺寸无效');
 for(const layer of data.layout){if(!Array.isArray(layer)||layer.length!==rows)throw Error('VIL 各层矩阵不一致');for(const row of layer)if(!Array.isArray(row)||row.length!==cols)throw Error('VIL 各行矩阵不一致')}
 return data;
}
export function stringifyVil(data){
 const text=JSON.stringify(data,null,2);
 return text.replace(/("uid"\s*:\s*)"(\d+)"/,'$1$2');
}
export function decodeVilKey(value,codes){
 if(Number.isInteger(value)&&value>=0&&value<=65535)return value;
 if(typeof value!=='string')throw Error('VIL 键码无效');
 value=value.trim();if(Number.isInteger(codes[value]))return codes[value];
 if(/^(0x[\da-f]+|\d+)$/i.test(value)){const n=Number(value);if(n<=65535)return n}
 const user=/^USER(\d+)$/.exec(value);if(user&&+user[1]<256)return codes.QK_KB+Number(user[1]);
 const fn=/^([\w]+)\((.*)\)$/.exec(value);
 if(fn){const [,name,arg]=fn,bases={MO:'QK_MOMENTARY',TO:'QK_TO',DF:'QK_DEF_LAYER',PDF:'QK_PERSISTENT_DEF_LAYER',TG:'QK_TOGGLE_LAYER',OSL:'QK_ONE_SHOT_LAYER',TT:'QK_LAYER_TAP_TOGGLE',TD:'QK_TAP_DANCE',M:'QK_MACRO'};
  if(bases[name]&&/^\d+$/.test(arg)&&Number(arg)<(name==='TD'?256:name==='M'?128:32))return codes[bases[name]]+Number(arg);
  if(codes[name+'(kc)']!==undefined){const inner=decodeVilKey(arg,codes);if(inner>255)throw Error('VIL 组合键的基础键超出范围');return codes[name+'(kc)']|inner}
  const args=arg.split(',').map(s=>s.trim());
  const mods=expression=>{const parts=expression.split('|').map(x=>x.trim());if(parts.some(x=>!/^MOD_[A-Z]+$/.test(x)||!Number.isInteger(codes[x])))throw Error('VIL 修饰键无效');return parts.reduce((n,x)=>n|codes[x],0)};
  if(name==='OSM')return codes.QK_ONE_SHOT_MOD|mods(arg);
  if(name==='MT'&&args.length===2){const inner=decodeVilKey(args[1],codes);if(inner<=255)return codes.QK_MOD_TAP|(mods(args[0])<<8)|inner}

  if(name==='LT'&&args.length===2&&/^\d+$/.test(args[0])&&+args[0]<16){const inner=decodeVilKey(args[1],codes);if(inner<=255)return codes.QK_LAYER_TAP|(+args[0]<<8)|inner}
 }
 throw Error('无法识别 VIL 键码：'+value);
}
const koFields=['trigger','replacement','layers','trigger_mods','negative_mod_mask','suppressed_mods','options'],repeatFields=['keycode','alt_keycode','allowed_mods','options'];
export function vilToSnapshot(data,baseline,codes,encodeActions){
 const next=structuredClone(baseline),rows=data.layout[0].length,cols=data.layout[0][0].length;
 if(rows!==baseline.rows||cols!==baseline.cols||data.layout.length!==baseline.layers)throw Error('VIL 层数或矩阵尺寸与键盘不匹配');
 if(data.uid!==undefined&&BigInt(data.uid)!==BigInt('0x'+baseline.uid))throw Error('VIL 文件与当前键盘 UID 不匹配');
 if(data.vial_protocol!==undefined&&data.vial_protocol!==baseline.version)throw Error('VIL 协议版本与键盘不匹配');
 const key=v=>decodeVilKey(v,codes);
 next.keymap=data.layout.flat(2).flatMap(v=>{const n=key(v);return [n>>>8,n&255]});
 if(data.layout_options!==undefined)next.layoutOptions=data.layout_options;
 if(data.encoder_layout!==undefined){if(!Array.isArray(data.encoder_layout)||data.encoder_layout.length!==baseline.layers)throw Error('VIL 旋钮层数不匹配');next.encoders=baseline.encoders.map(([l,id,v])=>{const e=data.encoder_layout[l]?.[id];if(e===undefined)return [l,id,v];if(!Array.isArray(e)||e.length!==2)throw Error('VIL 旋钮格式无效');return [l,id,e.map(key)]})}
 if(data.macro!==undefined){if(!Array.isArray(data.macro)||data.macro.length>baseline.macros.length)throw Error('VIL 宏数量不匹配');next.macros=Array.from({length:baseline.macros.length},(_,i)=>encodeActions((data.macro[i]||[]).flatMap(a=>{
  if(!Array.isArray(a))throw Error('VIL 宏动作无效');const [type,...values]=a;
  if(type==='text'){if(values.length!==1||typeof values[0]!=='string')throw Error('VIL 文本动作无效');return [{type,value:values[0]}]}
  if(type==='delay'){if(values.length!==1)throw Error('VIL 延时动作无效');return [{type,value:values[0]}]}
  if(!['tap','down','up'].includes(type))throw Error('不支持的 VIL 宏动作：'+type);
  return values.map(v=>({type,value:key(v)}));
 })))}
 for(const [type,name] of ['tap_dance','combo','key_override','alt_repeat_key'].entries()){
  if(data[name]===undefined)continue;if(!Array.isArray(data[name])||data[name].length>baseline.dynamic[type].length)throw Error('VIL '+name+' 数量不匹配');
  data[name].forEach((v,i)=>{const fields=type===2?koFields:type===3?repeatFields:null;if(fields){if(!v||typeof v!=='object'||fields.some(f=>v[f]===undefined))throw Error('VIL 条目字段不完整');next.dynamic[type][i]=fields.map((f,j)=>j<2?key(v[f]):v[f])}else{if(!Array.isArray(v)||v.length!==5)throw Error('VIL 条目字段无效');next.dynamic[type][i]=v.map((n,j)=>type===1||j<4?key(n):n)}});
 }
 if(data.settings!==undefined){if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('VIL settings 无效');for(const [id,value] of Object.entries(data.settings))if(next.settings[id])next.settings[id][1]=value}
 return next;
}
export function snapshotToVil(snapshot,decodeActions){
 const d=snapshot,key=n=>'0x'+n.toString(16).padStart(4,'0');
 const layout=Array.from({length:d.layers},(_,l)=>Array.from({length:d.rows},(_,r)=>Array.from({length:d.cols},(_,c)=>{const i=((l*d.rows+r)*d.cols+c)*2;return key(d.keymap[i]*256+d.keymap[i+1])})));
 const count=d.encoders.length?Math.max(...d.encoders.map(e=>e[1]))+1:0;
 const encoder_layout=Array.from({length:d.layers},()=>Array.from({length:count},()=>['0x0000','0x0000']));for(const [l,id,v] of d.encoders)encoder_layout[l][id]=v.map(key);
 return {version:1,uid:BigInt('0x'+d.uid).toString(),layout,encoder_layout,layout_options:d.layoutOptions,macro:d.macros.map(m=>decodeActions(m).map(a=>[a.type,['tap','down','up'].includes(a.type)?key(Number(a.value)):a.type==='delay'?Number(a.value):a.value])),vial_protocol:d.version,via_protocol:9,tap_dance:d.dynamic[0].map(v=>v.map((n,i)=>i<4?key(n):n)),combo:d.dynamic[1].map(v=>v.map(key)),key_override:d.dynamic[2].map(v=>Object.fromEntries(koFields.map((f,i)=>[f,i<2?key(v[i]):v[i]]))),alt_repeat_key:d.dynamic[3].map(v=>Object.fromEntries(repeatFields.map((f,i)=>[f,i<2?key(v[i]):v[i]]))),settings:Object.fromEntries(Object.entries(d.settings).map(([id,v])=>[id,v[1]]))};
}

// SPDX-License-Identifier: GPL-2.0-or-later
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
export function setBoolean(value,field,checked){const mask=2**(field.bit??0);return (checked?(value|mask):(value&~mask))>>>0}
export async function mountSettings(host,device,{run,notice}){
 const schema=await (await fetch('qmk_settings.json')).json(),supported=new Set(await device.supportedSettings());
 const tabs=schema.tabs.map(t=>({...t,fields:t.fields.filter(f=>supported.has(f.qsid))})).filter(t=>t.fields.length);
 if(!tabs.length){host.append(el('p','muted','当前固件不支持动态 QMK 设置。'));return}
 host.classList.add('qmk-settings');
 const widths={},saved={},draft={};let active=0;
 for(const tab of tabs)for(const f of tab.fields)widths[f.qsid]=f.width||1;
 for(const [id,width] of Object.entries(widths))saved[id]=await device.setting(Number(id),width);
 Object.assign(draft,saved);
 const nav=el('div','qmk-tabs'),area=el('div','qmk-settings-body'),actions=el('div','qmk-settings-actions'),state=el('span','qmk-save-state');nav.setAttribute('role','tablist');
 const save=el('button','primary','Save'),undo=el('button','','Undo'),reset=el('button','','Reset');
 const changed=()=>Object.keys(saved).filter(id=>saved[id]!==draft[id]);
 function update(){const dirty=changed().length>0;save.disabled=undo.disabled=!dirty;state.textContent=dirty?'有未保存的修改':'已保存'}
 function draw(){area.replaceChildren();[...nav.children].forEach((b,i)=>{b.classList.toggle('active',i===active);b.setAttribute('aria-selected',String(i===active))});
  const form=el('div','qmk-form');
  for(const f of tabs[active].fields){
   const row=el('div','qmk-setting-row'),label=el('label','',f.title),input=el('input');input.id=`qmk-${f.qsid}-${f.bit??'value'}`;label.htmlFor=input.id;
   input.setAttribute('aria-label',f.title);
   if(f.type==='boolean'){input.type='checkbox';input.checked=!!(draft[f.qsid]&2**(f.bit??0));input.onchange=()=>{draft[f.qsid]=setBoolean(draft[f.qsid],f,input.checked);update()}}
   else{input.type='number';input.min=f.min??0;input.max=f.max??(2**(widths[f.qsid]*8)-1);input.step=1;input.value=draft[f.qsid];input.oninput=()=>{if(input.checkValidity()&&input.value!=='')draft[f.qsid]=Number(input.value);else draft[f.qsid]=NaN;update()}}
   row.append(label,input);form.append(row);
  }
  area.append(form);update();
 }
 tabs.forEach((tab,i)=>{const b=el('button','',tab.name);b.setAttribute('role','tab');b.onclick=()=>{active=i;draw()};nav.append(b)});
 save.onclick=()=>run(async()=>{
  const ids=changed();
  for(const id of ids){const n=draft[id];const fields=tabs.flatMap(t=>t.fields).filter(f=>String(f.qsid)===id&&f.type!=='boolean');if(!Number.isInteger(n)||n<0||n>2**(widths[id]*8)-1||fields.some(f=>n<(f.min??0)||n>(f.max??Infinity)))throw Error('请检查设置数值范围')}
  // Save only changed QSIDs, preserving other bits in shared settings words.
  try{for(const id of ids){await device.setting(Number(id),widths[id],draft[id]);saved[id]=draft[id]}}finally{update()}
  notice('QMK 设置已保存到键盘。');
 });
 undo.onclick=()=>{Object.assign(draft,saved);draw()};
 reset.onclick=()=>run(async()=>{if(!confirm('将设备全部 QMK 设置恢复为固件默认值？'))return;await device.vial(12);for(const [id,w] of Object.entries(widths))saved[id]=await device.setting(Number(id),w);Object.assign(draft,saved);draw();notice('QMK 设置已恢复为固件默认值。')});
 actions.append(state,save,undo,reset);host.append(nav,area,actions);draw();
}

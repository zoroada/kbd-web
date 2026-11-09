// SPDX-License-Identifier: GPL-2.0-or-later
// Option bits match vial-gui protocol/key_override.py and alt_repeat_key.py.
export function setBit(value,bit,enabled){return enabled?value|(1<<bit):value&~(1<<bit)}
export function buildAdvancedEntry(parent,type,values,{keyButton}){
 const draft=[...values],make=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e};
 const row=(title,content)=>{const e=make('div','advanced-row');e.append(make('label','advanced-label',title),content);parent.append(e)};
 function check(title,checked,change){const label=make('label','advanced-check'),input=make('input');input.type='checkbox';input.checked=checked;input.setAttribute('aria-label',title);input.onchange=()=>change(input.checked);label.append(input,make('span','',title));return {label,input}}
 function bitOptions(title,index,options){const group=make('div','advanced-options');for(const [bit,text] of options)group.append(check(text,!!(draft[index]&(1<<bit)),on=>draft[index]=setBit(draft[index],bit,on)).label);row(title,group)}
 function mods(title,index){const group=make('div','advanced-mods');for(const bit of [0,1,2,3,4,5,6,7]){const title=['LCtrl','LShift','LAlt','LGui','RCtrl','RShift','RAlt','RGui'][bit];group.append(check(title,!!(draft[index]&(1<<bit)),on=>draft[index]=setBit(draft[index],bit,on)).label)}row(title,group)}
 function key(title,index){row(title,keyButton(draft[index],code=>draft[index]=code,title))}
 const flags=type===2?6:3,enabledBit=type===2?7:3;
 row('Enable',check('启用',!!(draft[flags]&(1<<enabledBit)),on=>draft[flags]=setBit(draft[flags],enabledBit,on)).label);
 if(type===2){
  const container=make('div'),grid=make('div','advanced-layers'),checks=[];
  for(let bit=0;bit<16;bit++){const c=check(String(bit),!!(draft[2]&(1<<bit)),on=>draft[2]=setBit(draft[2],bit,on));checks.push(c.input);grid.append(c.label)}container.append(grid);
  const tools=make('div','advanced-layer-tools');for(const [text,value] of [['Enable all',65535],['Disable all',0]]){const b=make('button','',text);b.type='button';b.onclick=()=>{draft[2]=value;checks.forEach(c=>c.checked=!!value)};tools.append(b)}container.append(tools);row('Enable on layers',container);
  key('Trigger',0);mods('Trigger mods',3);mods('Negative mods',4);mods('Suppressed mods',5);key('Replacement',1);
  bitOptions('Options',6,[[0,'Activate when the trigger key is pressed down'],[1,'Activate when a necessary modifier is pressed down'],[2,'Activate when a negative modifier is released'],[3,'Activate on one modifier'],[5,"Don’t deactivate when another key is pressed down"],[4,"Don’t register the trigger key again after the override is deactivated"]]);
 }else{
  key('Last key',0);key('Alt key',1);mods('Allowed mods',2);
  bitOptions('Options',3,[[0,'Default to this alt key'],[1,'Bidirectional'],[2,'Ignore mod handedness']]);
 }
 return ()=>[...draft];
}

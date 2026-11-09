// SPDX-License-Identifier: GPL-2.0-or-later
// Match vial-gui create_user_keycodes / create_custom_user_keycodes.
export function installUserKeycodes(codes,labels,definition={}){
 const custom=Array.isArray(definition.customKeycodes)&&definition.customKeycodes.length?definition.customKeycodes:null;
 const count=custom?custom.length:16,base=codes.QK_KB;
 if(!Number.isInteger(base))return [];
 return Array.from({length:count},(_,i)=>{
  const id=`USER${String(i).padStart(2,'0')}`,item=custom?.[i]||{},code=base+i;
  codes[id]=code;
  if(typeof item.name==='string'&&item.name)codes[item.name]=code;
  labels[id]=custom?(item.shortName||id):`User ${i}`;
  const description=custom?(item.title||id):`User keycode ${i}`;
  return {id,code,label:labels[id],description,custom:!!custom};
 });
}

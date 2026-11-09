// SPDX-License-Identifier: GPL-2.0-or-later
// Each keyboard owns its cache. Promise sharing prevents duplicate HID reads.
export function installDeviceCache(device){
 if(device.viewCache)return device.viewCache;
 const entries=new Map(),listeners=new Set();
 const load=(key,read)=>{if(!entries.has(key)){const promise=Promise.resolve().then(read);entries.set(key,promise);promise.catch(()=>{if(entries.get(key)===promise)entries.delete(key)})}return entries.get(key)};
 const publish=type=>listeners.forEach(fn=>fn(type));
 const readMacros=device.macros.bind(device),writeMacros=device.saveMacros.bind(device),dynamic=device.dynamic.bind(device);
 device.macros=()=>load('macro',readMacros);
 device.saveMacros=async values=>{await writeMacros(values);entries.set('macro',Promise.resolve(values.map(v=>[...v])));publish('Macro')};
 device.dynamic=(type,index,values)=>{
  const key=`${type}:${index}`;
  if(values)return dynamic(type,index,values).then(result=>{entries.set(key,Promise.resolve([...values]));publish(type===0?'Tap Dance':type===1?'Combo':type===2?'Key Override':type===3?'Alt Repeat Key':null);return result});
  return load(key,()=>dynamic(type,index));
 };
 device.viewCache={subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)}};
 return device.viewCache;
}

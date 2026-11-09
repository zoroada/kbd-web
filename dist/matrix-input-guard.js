// SPDX-License-Identifier: GPL-2.0-or-later
// Matrix data arrives over HID; browser keyboard actions are unrelated to testing.
export function installMatrixInputGuard(target,isTesting){
 const held=new Set();
 const block=event=>{
  const id=event.code||event.key;
  if(!isTesting()&&!held.has(id))return;
  if(event.type==='keydown')held.add(id);
  if(event.type==='keyup')held.delete(id);
  event.preventDefault();
  event.stopImmediatePropagation();
 };
 for(const type of ['keydown','keypress','keyup'])target.addEventListener(type,block,{capture:true,passive:false});
 const reset=()=>held.clear();target.addEventListener('blur',reset);
 return ()=>{for(const type of ['keydown','keypress','keyup'])target.removeEventListener(type,block,true);target.removeEventListener('blur',reset);held.clear()};
}

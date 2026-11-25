// SPDX-License-Identifier: GPL-2.0-or-later
export async function saveFile(getContent,name){
 const ext=name.endsWith('.vil')?'.vil':'.json';let handle;
 try{
  if(window.showSaveFilePicker)handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:ext==='.vil'?'Vial 配置':'JSON 文件',accept:{'application/json':[ext]}}]});
  else{const chosen=prompt('保存文件名（保存目录由浏览器下载设置决定）',name);if(chosen===null)return;name=chosen.trim();if(!name)throw Error('文件名不能为空');if(!name.toLowerCase().endsWith(ext))name+=ext}
  const content=await getContent(),blob=new Blob([typeof content==='string'?content:JSON.stringify(content,null,2)],{type:'application/json;charset=utf-8'});
  if(handle){const writable=await handle.createWritable();try{await writable.write(blob);await writable.close()}catch(e){await writable.abort().catch(()=>{});throw e}}
  else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }catch(e){if(e.name!=='AbortError')throw e}
}

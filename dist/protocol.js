// SPDX-License-Identifier: GPL-2.0-or-later
// Wire formats ported from vial-kb/vial-gui protocol modules.
export const u16=(n)=>[n&255,n>>>8&255], be16=n=>[n>>>8&255,n&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
export const read16=(a,i=0)=>a[i]|a[i+1]<<8, read32=(a,i=0)=>new DataView(a.buffer,a.byteOffset+i,4).getUint32(0,true);
export function integer(value,max=65535){const n=Number(value);if(!Number.isInteger(n)||n<0||n>max)throw Error(`数值必须在 0–${max} 之间`);return n}
export class Transport {
 constructor(device,{timeout=700,retries=3,quiet=500,onRetry=()=>{}}={}){
  this.device=device;this.queue=Promise.resolve();this.dead=false;this.timeout=timeout;this.retries=retries;this.quiet=quiet;this.onRetry=onRetry;this.lastInput=0;this.recover=false;
  const c=device.collections.find(c=>c.usagePage===0xff60&&c.usage===0x61);
  if(!c)throw Error('设备没有 Vial Raw HID 接口');
  this.report=c.outputReports?.[0]?.reportId??0;this.inputReport=c.inputReports?.[0]?.reportId??0;
  device.addEventListener('inputreport',e=>{
   if(e.reportId!==undefined&&e.reportId!==this.inputReport)return;
   this.lastInput=Date.now();const a=new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength).slice();
   if(a.length!==32||!this.pending)return;
   const p=this.pending;
   // VIA responses echo the command; buffer replies also echo offset and length.
   if(p.bytes[0]!==254&&(a[0]!==p.bytes[0]||([14,18].includes(a[0])&&[1,2,3].some(i=>a[i]!==p.bytes[i]))))return;
   this.pending=null;p.resolve(a);
  });
 }
 sendBootloader(){
  const task=this.queue.then(async()=>{
   if(this.dead||this.device.opened===false)throw Error('USB 设备已断开，请重新连接');
   const packet=new Uint8Array(32);packet[0]=0x0b;
   await this.device.sendReport(this.report,packet);
   this.dead=true;
  });
  this.queue=task.catch(()=>{});return task;
 }
 async drain(){let remaining=this.quiet;const start=Date.now();while(remaining>0){await new Promise(r=>setTimeout(r,remaining));remaining=this.quiet-(Date.now()-Math.max(start,this.lastInput));if(Date.now()-start>3000)throw Error('设备持续发送迟到响应，请重新连接')}}
 retrySafe(bytes){return [1,2,4,5,7,8,9,12,13,14,15,17,18].includes(bytes[0])||(bytes[0]===254&&[0,1,2,3,4,5,9,10,11,13].includes(bytes[1]))}
 async attempt(packet,bytes){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{this.pending=null;const e=Error('设备响应超时');e.timeout=true;reject(e)},this.timeout);
  this.pending={bytes,resolve:a=>{clearTimeout(timer);resolve(a)}};
  this.device.sendReport(this.report,packet).catch(e=>{clearTimeout(timer);this.pending=null;reject(e)});
 })}
 send(bytes){const task=this.queue.then(async()=>{
  if(this.dead||this.device.opened===false)throw Error('USB 设备已断开，请重新连接');
  if(bytes.length>32)throw Error('数据包超出 32 字节');
  const packet=new Uint8Array(32);packet.set(bytes);
  if(this.recover){await this.drain();this.recover=false}
  const count=this.retrySafe(bytes)?this.retries+1:1;
  for(let i=0;i<count;i++){
   try{const a=await this.attempt(packet,bytes);if(i)await this.drain();return a}
   catch(e){if(!e.timeout){if(this.device.opened===false)this.dead=true;throw e}
    if(i+1===count){this.recover=true;throw Error(`命令 0x${bytes[0].toString(16)} 响应超时（已发送 ${count} 次），设备未被标记为断开；请重试操作`)}
    this.onRetry({command:bytes[0],attempt:i+1,total:count-1});await this.drain();
   }
  }
 });this.queue=task.catch(()=>{});return task}
}
export class Keyboard{
 constructor(t){this.t=t;this.counts=[0,0,0,0]}
 send(...a){return this.t.send(a.flat())}
 rebootToBootloader(){return this.t.sendBootloader()}
 vial(cmd,...a){return this.send(254,cmd,...a)}
 async init(definition){let a=await this.send(1);this.via=a[1]*256+a[2];a=await this.vial(0);this.version=read32(a);this.uid=Array.from(a.slice(4,12)).reverse().map(x=>x.toString(16).padStart(2,'0')).join('');if(this.via!==9||this.version>6)throw Error(`暂不支持 VIA ${this.via} / Vial ${this.version}，已停止写入`);if(!definition){a=await this.vial(1);const size=read32(a);if(!size||size>4*1024*1024)throw Error('键盘定义大小无效');const raw=new Uint8Array(size);for(let i=0;i<size;i+=32)raw.set((await this.vial(2,u32(i/32))).slice(0,Math.min(32,size-i)),i);definition=await new Response(new window["xz-decompress"].XzReadableStream(new Blob([raw]).stream())).json()}
 this.definition=definition;this.rows=integer(definition.matrix.rows,32);this.cols=integer(definition.matrix.cols,32);this.layers=(await this.send(17))[1];if(!this.rows||!this.cols||!this.layers||this.layers*this.rows*this.cols*2>65535)throw Error('矩阵或层数无效');this.keymap=await this.buffer(18,this.layers*this.rows*this.cols*2);this.layoutOptions=0;if(definition.layouts.labels){a=await this.send(2,2);this.layoutOptions=new DataView(a.buffer).getUint32(2,false)}if(this.version>=4){a=await this.vial(13,0);this.counts=Array.from(a.slice(0,4));if(this.version<5)this.counts[2]=0}return this}
 async buffer(cmd,size){const out=new Uint8Array(size);for(let i=0;i<size;i+=28){const n=Math.min(28,size-i),a=await this.send(cmd,be16(i),n);if(a[0]!==cmd)throw Error('缓冲区响应命令不匹配');out.set(a.slice(4,4+n),i)}return out}
 code(l,r,c){const i=((l*this.rows+r)*this.cols+c)*2;return this.keymap[i]*256+this.keymap[i+1]}
 async setKey(l,r,c,k){integer(l,this.layers-1);integer(r,this.rows-1);integer(c,this.cols-1);integer(k);await this.send(5,l,r,c,be16(k));const i=((l*this.rows+r)*this.cols+c)*2;this.keymap.set(be16(k),i)}
 async encoder(l,i){const a=await this.vial(3,l,i);return [a[0]*256+a[1],a[2]*256+a[3]]}
 async setEncoder(l,i,d,k){await this.vial(4,l,i,d,be16(integer(k)))}
 async dynamic(type,index,values){const formats=[[2,2,2,2,2],[2,2,2,2,2],[2,2,2,1,1,1,1],[2,2,1,1]],fmt=formats[type];integer(index,this.counts[type]-1);if(values){if(values.length!==fmt.length)throw Error('字段数量错误');const bytes=values.flatMap((v,i)=>fmt[i]===2?u16(integer(v)): [integer(v,255)]);await this.vial(13,2+type*2,index,bytes);return values}const a=await this.vial(13,1+type*2,index);if(a[0])throw Error('读取动态条目失败');let offset=1;return fmt.map(n=>{const v=n===2?read16(a,offset):a[offset];offset+=n;return v})}
 async macros(){this.macroCount=(await this.send(12))[1];const a=await this.send(13);this.macroSize=a[1]*256+a[2];if(!this.macroCount||!this.macroSize)return Array.from({length:this.macroCount},()=>[]);const bytes=await this.buffer(14,this.macroSize);const out=[];let part=[];for(const b of bytes){if(!b){out.push(part);part=[];if(out.length===this.macroCount)break}else part.push(b)}while(out.length<this.macroCount)out.push([]);return out}
 async saveMacros(list){if(list.length!==this.macroCount)throw Error('宏数量错误');const bytes=list.flatMap(a=>[...a,0]);if(bytes.length>this.macroSize)throw Error('宏存储空间不足');for(let i=0;i<bytes.length;i+=28){const chunk=bytes.slice(i,i+28);await this.send(15,be16(i),chunk.length,chunk)}}
 async supportedSettings(){if(this.version<4)return [];let current=0;const ids=new Set;for(let page=0;page<4096;page++){const a=await this.vial(9,u16(current));let next=current;for(let i=0;i<32;i+=2){const id=read16(a,i);if(id===65535)return [...ids];ids.add(id);next=Math.max(next,id)}if(next===current)throw Error('设置列表未前进');current=next}throw Error('设置列表过长')}
 async setting(id,width,value){if(value!==undefined){const bytes=u32(integer(value,2**(width*8)-1)).slice(0,width);const a=await this.vial(11,u16(id),bytes);if(a[0])throw Error('设置写入失败');return value}const a=await this.vial(10,u16(id));if(a[0])throw Error('设置读取失败');return a.slice(1,1+width).reduce((n,b,i)=>n+b*2**(8*i),0)}
 async lighting(id,bytes){return bytes?this.send(7,id,bytes):this.send(8,id)}
 async setOptions(n){await this.send(3,2,u32(n).reverse());this.layoutOptions=n}
}

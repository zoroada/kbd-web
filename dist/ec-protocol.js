export const normalizeAdc=value=>Math.max(0,Math.min(1024,value));
// Matches quantum/via.h: custom SET=0x14, GET=0x15, channel=0. All multi-byte EC fields use little endian.
export class EcProtocol {
 constructor(device){this.device=device}
 async request(get,id,payload=[]){
  const bytes=[get?0x15:0x14,0,id,...payload];
  const a=await this.device.t.send(bytes,{retry:get});
  if(a[0]!==bytes[0]||a[1]!==0||a[2]!==id)throw Error('固件不支持此静电容指令或参数无效');
  return a;
 }
 async offset(id,value){
  if(value!==undefined){if(!Number.isInteger(value)||value<50||value>1024)throw Error('偏移范围为 50–1024');await this.request(false,id,[value&255,value>>8])}
  const a=await this.request(true,id);return a[3]+a[4]*256;
 }
 async baselines(){
  const {rows,cols}=this.device,total=rows*cols*2,raw=new Uint8Array(total);
  for(let offset=0;offset<total;offset+=26){const size=Math.min(26,total-offset),a=await this.request(true,4,[offset&255,offset>>8,size]);if(a[3]!== (offset&255)||a[4]!== (offset>>8)||a[5]!==size)throw Error('ADC 分包响应不匹配');raw.set(a.slice(6,6+size),offset)}
  const view=new DataView(raw.buffer);return Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>view.getInt16((r*cols+c)*2,true)));
 }
 async key(row,col,value){
  if(!Number.isInteger(row)||row<0||row>=this.device.rows||!Number.isInteger(col)||col<0||col>=this.device.cols)throw Error('矩阵位置无效');
  if(value!==undefined){if(!Number.isInteger(value)||value<0||value>1024)throw Error('基准范围为 0–1024');await this.request(false,6,[row,col,value&255,value>>8])}
  const a=await this.request(true,6,[row,col]);if(a[3]!==row||a[4]!==col)throw Error('单键响应位置不匹配');return new DataView(a.buffer,a.byteOffset,a.byteLength).getInt16(5,true);
 }
 async saveCalibration(matrix){
  const {rows,cols}=this.device;
  if(!Array.isArray(matrix)||matrix.length!==rows||matrix.some(row=>!Array.isArray(row)||row.length!==cols||row.some(v=>!Number.isInteger(v))))throw Error('基准数据不完整，请先重新读取');
  const expected=matrix.map(row=>row.map(normalizeAdc)),raw=expected.flatMap(row=>row.flatMap(v=>[v&255,v>>8]));
  for(let offset=0;offset<raw.length;offset+=26){const bytes=raw.slice(offset,offset+26),a=await this.request(false,4,[offset&255,offset>>8,bytes.length,...bytes]);if(a[3]!== (offset&255)||a[4]!== (offset>>8)||a[5]!==bytes.length)throw Error('ADC 写入分包响应不匹配，未发送保存标记')}
  await this.request(false,1,[0x31,0x42,0x43,0x45]);
  return expected;
 }
 async calibrate(){await this.request(false,5,[1])}
}

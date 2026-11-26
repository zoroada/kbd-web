import {mountEcCalibration} from './ec-calibration.js?v=ec-offset-limits-19';
import {parseVil,stringifyVil,vilToSnapshot,snapshotToVil} from './vil-file.js';
import {saveFile} from './file-save.js';
import {mountLighting} from './lighting.js';
import {installUserKeycodes} from './user-keycodes.js';
import {installMatrixInputGuard} from './matrix-input-guard.js';
import {buildAdvancedEntry} from './advanced-entry.js';
import {updateMatrixKeys} from './matrix-state.js';
import {mountSettings} from './settings.js';
import {installDeviceCache} from './device-cache.js?v=override-repeat-2';
import {parseLayout,keyShape,layoutBounds,parseLayoutFile,layoutChoices,changeLayoutChoice,visibleLayout} from './layout.js?v=compound-keys-2';
import {mountPalette} from './palette.js?v=modifier-template-2';
// SPDX-License-Identifier: GPL-2.0-or-later
import {createLabeler,encoderDirection} from './key-labels.js';
import {Transport,Keyboard,integer,u16,read16} from './protocol.js?v=ec-live-26-11';
const $=s=>document.querySelector(s), el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
let userKeys=[],bootDevice=null;
let kb=null,previewDefinition=null,previewOptions=0,page=0,layer=0,selected=null,keydefs=[],codes={},macros=[],matrixTimer=null,matrixStart=null,testedKeys=new Set(),busy=false,settingsSchema,officialLabels={},encoderValues=new Map(),label=()=>'';
const pages=[['⌘','按键映射'],['↻','旋钮'],['≋','宏'],['☼','灯光'],['♧','Tap Dance'],['⌗','组合键'],['⇄','按键覆盖'],['↪','替代重复键'],['⚙','QMK 设置'],['▦','布局与测试'],['◇','安全与配置'],['◉','静电容校准']];
function log(s){$('#log').textContent=`${new Date().toLocaleTimeString()} ${s}\n`+$('#log').textContent}function notice(s){$('#notice').textContent=s;const local=$('#security-notice');if(local)local.textContent=s;log(s)}
async function run(fn){if(busy)return;busy=true;document.body.setAttribute('aria-busy','true');try{await fn()}catch(e){notice('操作失败：'+e.message);console.error(e)}finally{busy=false;document.body.removeAttribute('aria-busy')}}
function button(text,fn,cls=''){const b=el('button',cls,text);b.onclick=()=>run(fn);return b}let currentPaletteTab='Basic';let editorHost=null;function panel(title){const p=el('div','panel');if(title)p.append(el('h3','',title));(editorHost||$('#content')).append(p);return p}function field(parent,title,value,max=65535){const d=el('div','field'),i=el('input');i.type='number';i.min=0;i.max=max;i.value=value;d.append(el('label','',title),i);parent.append(d);return i}function select(parent,items,value){const s=el('select');items.forEach(([v,t])=>{const o=el('option','',t);o.value=v;s.append(o)});s.value=value;parent.append(s);return s}const hex=n=>'0x'+n.toString(16).padStart(4,'0');function parse(s){s=String(s).trim();if(s in codes)return codes[s];return integer(s)}
async function loadCodes(){codes=await (await fetch(`keycodes-v${kb.version>=6?6:5}.json`)).json();officialLabels=await (await fetch('vial-labels.json')).json();userKeys=installUserKeycodes(codes,officialLabels,kb.definition);label=createLabeler(codes,officialLabels);keydefs=parseLayout(kb.definition);installDeviceCache(kb);testedKeys.clear();encoderValues.clear();selected=null;layer=0}
function stopMatrix(){if(matrixTimer){clearInterval(matrixTimer);matrixTimer=null}}
installMatrixInputGuard(window,()=>matrixTimer!==null);
async function render(){stopMatrix();$('#disconnect').disabled=!kb;$('#bootloader').disabled=!kb;$('#device-safety').disabled=!kb;$('#security-button').disabled=false;if(!kb)$('#security-dialog')?.close();$('#content').replaceChildren();$('#crumb').textContent=pages[page][1];document.querySelectorAll('nav button').forEach((b,i)=>b.classList.toggle('active',Number(b.dataset.page)===page));if(!kb&&previewDefinition){renderLayoutPreview();return}if(!kb){$('#title').textContent='连接键盘或加载布局 JSON';$('#subtitle').textContent='通过 USB 连接设备，或打开本地 JSON 预览布局。';document.body.classList.remove('device-ready');const p=panel();p.classList.add('empty');p.append(button('连接键盘',connect,'primary'));return}document.body.classList.add('device-ready');$('#title').textContent=kb.definition.name||'你的键盘工作台';$('#subtitle').textContent=`设备已连接 · 写入操作实时保存到键盘 · ${kb.rows} × ${kb.cols} 矩阵 · ${kb.layers} 层 · Vial ${kb.version}`;if(page===0)await keymap();else if(page===1)await encoders();else if(page===2)await entryOverview('Macro');else if(page===3)await lighting();else if(page===4||page===5)await entryOverview(page===4?'Tap Dance':'Combo');else if(page>=6&&page<=7)await dynamicUI(page-4);else if(page===8)await settings();else if(page===9)await layoutUI();else if(page===11)await mountEcCalibration($('#content'),kb,{run,notice});else await security()}
pages.forEach(([icon,name],i)=>{const b=button(`${icon}　${name}`,async()=>{page=i;await render()});if(![1,2,4,5,6,7,10].includes(i))$('nav').append(b);b.dataset.page=i});
const securityButton=button('文件',openFileMenu);securityButton.id='security-button';securityButton.disabled=false;
const headerStart=el('div','header-start'),crumb=$('header>span');crumb.before(headerStart);headerStart.append(crumb,securityButton);
function openFileMenu(){return openSecurity()}
function fileActions(parent){
 const actions=el('div','file-actions');
 const load=el('label','file-action','加载已保存配置…');load.htmlFor='vil-file';
 const save=button('保存当前配置…',()=>saveFile(async()=>stringifyVil(snapshotToVil(await snapshot(),decodeMacro)),(kb.definition.name||'keyboard')+'.vil'),'file-action');save.disabled=!kb;
 const json=el('label','file-action','加载 VIA JSON…');json.htmlFor='layout-file';
 const definitions=button('下载 VIA 定义',()=>saveFile(async()=>{const response=await fetch('https://raw.githubusercontent.com/vial-kb/via-keymap-precompiled/main/via_keyboard_stack.json');if(!response.ok)throw Error('VIA 定义下载失败');return response.text()},'via_keyboard_stack.json'),'file-action');
 const dummy=el('label','file-action','加载离线 JSON…');dummy.htmlFor='offline-json-file';
 actions.append(load,save,json,definitions,dummy);parent.append(actions);
}
const safetyButton=button('◇　设备安全',openSecurity);safetyButton.id='device-safety';safetyButton.disabled=true;$('nav').append(safetyButton);
async function openSecurity(){
 const device=kb;
 const existing=$('#security-dialog');if(existing?.open){existing.focus();return}
 const dialog=el('dialog','security-dialog');dialog.id='security-dialog';
 const head=el('div','security-dialog-header'),title=el('h2','','文件'),close=el('button','','关闭');title.id='security-dialog-title';dialog.setAttribute('aria-labelledby',title.id);head.append(title,close);
 const feedback=el('p','security-feedback'),body=el('div','security-dialog-body');feedback.id='security-notice';feedback.setAttribute('role','status');
 dialog.append(head,feedback,body);document.body.append(dialog);
 const dismiss=()=>dialog.close();close.onclick=dismiss;dialog.addEventListener('close',()=>dialog.remove(),{once:true});
 const refresh=async()=>{if(kb!==device||!dialog.isConnected){dismiss();return}body.replaceChildren();await security(body,refresh)};
 dialog.showModal();try{await refresh()}catch(e){dismiss();throw e}
}
const bootButton=button('↥　进入 Boot 模式',rebootToBootloader);bootButton.id='bootloader';bootButton.disabled=true;$('nav').append(bootButton);
async function rebootToBootloader(){
 const device=kb;if(!device)throw Error('请先连接键盘');stopMatrix();
 if((await device.vial(5))[0]!==1){
  await device.vial(6);notice('进入 Boot 模式前需解锁，请按住安全页面显示的物理解锁按键。');
  let unlocked=false;
  for(let i=0;i<150;i++){
   if(kb!==device)throw Error('设备已断开');
   if((await device.vial(7))[0]===1){unlocked=true;break}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!unlocked)throw Error('物理解锁超时，未发送 Boot 指令');
 }
 bootDevice=device;
 try{
  await device.rebootToBootloader();
  if(kb===device)await disconnect();
  $('#status').textContent='Boot 模式';
  notice('已发送进入 Boot 模式指令，设备将断开并重新枚举。');
 }finally{bootDevice=null}
}
async function connect(){if(!navigator.hid)throw Error('浏览器不支持 WebHID，请使用桌面 Chrome 或 Edge');const ds=await navigator.hid.requestDevice({filters:[{usagePage:0xff60,usage:0x61}]});if(!ds.length)return;stopMatrix();const dev=ds[0];if(kb?.t?.device?.opened)await kb.t.device.close();kb=null;previewDefinition=null;notice('正在读取键盘定义与键位…');try{await dev.open();const next=new Keyboard(new Transport(dev,{onRetry:({command,attempt,total})=>log(`通讯超时，重传 0x${command.toString(16)}（${attempt}/${total}）`)}));await next.init();kb=next;await loadCodes();$('#status').textContent=dev.productName||'已连接';$('#connect').textContent='重新连接';notice('已读取真实设备。选择按键后，在下方选择键码写入。');await render()}catch(e){await dev.close().catch(()=>{});kb=null;await render();throw e}}
async function disconnect(){
 const device=kb;if(!device)return;
 stopMatrix();matrixStart=null;device.t.dead=true;
 try{if(device.t.device.opened)await device.t.device.close()}
 catch(e){if(device.t.device.opened){device.t.dead=false;throw e}}
 kb=null;selected=null;keydefs=[];encoderValues.clear();testedKeys.clear();macros=[];layer=0;page=0;previewDefinition=null;previewOptions=0;
 if($('#modal').open)$('#modal').close();
 $('#status').textContent='未连接';$('#connect').textContent='连接键盘 ↗';
 notice('已断开设备连接。');await render();
}
$('#disconnect').onclick=()=>run(disconnect);
$('#connect').onclick=()=>run(connect);navigator.hid?.addEventListener('disconnect',e=>{if(kb?.t?.device===e.device){if(bootDevice===kb)return;stopMatrix();kb.t.dead=true;kb=null;$('#status').textContent='设备已断开';notice('设备已断开，请重新连接。');render()}});
const vilInput=el('input','file-picker-input');vilInput.id='vil-file';vilInput.type='file';vilInput.accept='.vil,application/json';
const vilLabel=el('label','file-picker','读取 .vil');vilLabel.htmlFor=vilInput.id;$('#layout-file').before(vilInput);
vilInput.onclick=()=>{vilInput.value=''};
vilInput.onchange=async()=>{
 const file=vilInput.files[0];if(!file)return;
 while(busy)await new Promise(resolve=>setTimeout(resolve,50));
 await run(async()=>{if(file.size>4*1024*1024)throw Error('VIL 文件不能超过 4 MB');const data=parseVil(await file.text());await showVilFile(data,file.name)});
};
async function showVilFile(data,name){
 const dialog=el('dialog','vil-file-dialog'),head=el('div','key-picker-header'),title=el('strong','',name),close=el('button','','关闭');head.append(title,close);
 dialog.append(head,el('p','muted',`${data.layout.length} 层 · ${data.layout[0].length} × ${data.layout[0][0].length} 矩阵 · ${(data.macro||[]).length} 个宏`));
 const layerChoice=select(dialog,data.layout.map((_,i)=>[i,'Layer '+i]),0),matrix=el('div','vil-matrix');dialog.append(matrix);
 const draw=()=>{matrix.replaceChildren();for(const row of data.layout[Number(layerChoice.value)]){const line=el('div','vil-matrix-row');row.forEach(code=>line.append(el('span','',String(code))));matrix.append(line)}};layerChoice.onchange=draw;draw();
 const details=el('details'),summary=el('summary','','完整配置'),text=el('textarea');text.readOnly=true;text.value=stringifyVil(data);details.append(summary,text);dialog.append(details);
 const actions=el('div','actions'),save=button('另存为 .vil',()=>saveFile(()=>stringifyVil(data),name));actions.append(save);
 const device=kb;
 if(device)actions.append(button('导入当前键盘',async()=>{
  if(kb!==device)throw Error('键盘连接已变化，请重新读取文件');
  if(!confirm('将此 VIL 配置写入当前键盘？'))return;
  const baseline=await snapshot();const next=vilToSnapshot(data,baseline,codes,encodeMacro);validateSnapshot(next);await restore(next);
  dialog.close();dialog.remove();await loadCodes();await render();notice('VIL 配置已导入键盘。');
 },'primary'));
 else dialog.append(el('p','muted','当前为文件预览；连接对应键盘后重新读取，可将配置导入设备。VIL 不包含物理布局，以上按矩阵位置显示。'));
 dialog.append(actions);document.body.append(dialog);close.onclick=()=>{dialog.close();dialog.remove()};dialog.addEventListener('cancel',()=>dialog.remove(),{once:true});dialog.showModal();
}
const offlineJSON=el('input','file-picker-input');offlineJSON.id='offline-json-file';offlineJSON.type='file';offlineJSON.accept='.json,application/json';document.body.append(offlineJSON);
offlineJSON.onclick=()=>{offlineJSON.value=''};
offlineJSON.onchange=async()=>{const file=offlineJSON.files[0];if(!file)return;while(busy)await new Promise(r=>setTimeout(r,50));await run(async()=>{
 if(file.size>4*1024*1024)throw Error('JSON 文件不能超过 4 MB');
 const definition=parseLayoutFile(await file.text()),dialog=el('dialog','vil-file-dialog'),head=el('div','security-dialog-header'),close=el('button','','关闭');head.append(el('h2','',definition.name||file.name),close);dialog.append(head);
 dialog.append(el('p','muted','离线布局预览'));
 const saved=[previewDefinition,keydefs,previewOptions];
 try{previewDefinition=definition;keydefs=parseLayout(definition);previewOptions=0;drawBoard(dialog,false,true)}finally{[previewDefinition,keydefs,previewOptions]=saved}
 dialog.querySelectorAll('.key,.encoder-key').forEach(b=>{b.onclick=null;b.tabIndex=-1});
 close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
})};
$('header label[for="layout-file"]')?.remove();
const layoutFile=$('#layout-file');
function layoutPickerLabel(){const label=el('label','file-picker','加载布局 JSON');label.htmlFor='layout-file';return label}
layoutFile.onclick=()=>{layoutFile.value=''};
layoutFile.onchange=async()=>{
 const file=layoutFile.files[0];if(!file)return;
 // The native picker opens immediately. Only parsing waits for an active operation.
 while(busy)await new Promise(resolve=>setTimeout(resolve,50));
 await run(async()=>{
 if(file.size>4*1024*1024)throw Error('布局文件不能超过 4 MB');
 notice('正在读取布局 JSON：'+file.name);
 const definition=parseLayoutFile(await file.text());
 if(kb&&(definition.matrix.rows!==kb.rows||definition.matrix.cols!==kb.cols))throw Error('JSON 矩阵尺寸与已连接键盘不匹配');
 keydefs=parseLayout(definition);previewOptions=0;selected=null;page=0;
 if(kb){kb.definition={...kb.definition,name:definition.name||kb.definition.name,layouts:definition.layouts};notice('布局已载入，键值来自已连接键盘。')}
 else{previewDefinition=definition;$('#status').textContent='JSON 布局预览';notice('布局预览：显示矩阵位置与旋钮方向，连接设备后可读取真实键值。')}
 await render();
 });
};
function renderLayoutPreview(){
 document.body.classList.add('device-ready');$('#title').textContent=previewDefinition.name||'JSON 布局预览';$('#subtitle').textContent=`本地 JSON · ${previewDefinition.matrix.rows} × ${previewDefinition.matrix.cols} 矩阵 · 尚未连接设备`;
 const p=panel();p.classList.add('mapping-panel');drawLayoutChoices(p);drawBoard(p,false,true);const info=el('p','muted','点击按键查看矩阵位置；圆形按键表示 JSON 定义的旋钮方向。');info.id='selection';p.append(info);
}
function drawLayoutChoices(parent){
 const definition=kb?kb.definition:previewDefinition,labels=definition?.layouts?.labels||[];
 if(!labels.length){const row=el('div','layout-choices');row.append(el('span','layout-choices-title','Layout'),el('span','muted','默认布局（当前 JSON 未定义可选布局）'));const load=layoutPickerLabel();row.append(load);parent.append(row);return;}
 const row=el('div','layout-choices');row.append(el('span','layout-choices-title','Layout'));
 for(const choice of layoutChoices(labels,kb?kb.layoutOptions:previewOptions)){
  const group=el('label','layout-choice');group.append(el('span','',choice.title));
  const control=el(typeof labels[choice.index]==='string'?'input':'select');
  if(control.tagName==='INPUT'){control.type='checkbox';control.checked=choice.value===1}
  else{choice.options.forEach((name,i)=>{const option=el('option','',name);option.value=i;control.append(option)});control.value=choice.value}
  control.onchange=()=>run(async()=>{const value=control.type==='checkbox'?Number(control.checked):Number(control.value),packed=changeLayoutChoice(labels,kb?kb.layoutOptions:previewOptions,choice.index,value);try{const resume=page===9&&!!matrixTimer;if(kb)await kb.setOptions(packed);else previewOptions=packed;selected=null;await render();if(resume&&matrixStart)await matrixStart()}catch(e){if(control.type==='checkbox')control.checked=choice.value===1;else control.value=choice.value;throw e}});
  group.append(control);row.append(group);
 }
 parent.append(row);
}
function layerBar(p){
 const bar=el('div','toolbar layers');bar.setAttribute('role','group');bar.setAttribute('aria-label','Layer');bar.append(el('span','layer-label','Layer'));
 for(let i=0;i<kb.layers;i++){
  const b=button(String(i),async()=>{layer=i;selected=null;await render()},i===layer?'active':'');
  b.setAttribute('aria-label',`切换到第 ${i} 层`);b.setAttribute('aria-pressed',String(i===layer));bar.append(b);
 }
 p.append(bar);
}
function drawModifierLegend(button,code,k){
 const template=Object.keys(codes).find(n=>n.endsWith('(kc)')&&(code&0xff00)===codes[n]);
 if(!template)return;
 const host=button.querySelector('.compound-legend')||button;host.replaceChildren();
 const title=(officialLabels[template]||template).replace(/\s*\(kc\)/,'').replace(/_T$/,'');
 host.append(el('span','modifier-name',title));
 const base=el('span','modifier-base',code&255?label(code&255):'');
 base.setAttribute('role','button');base.setAttribute('aria-label','选择基础按键');
 base.onclick=event=>{event.stopPropagation();run(()=>openKeyPicker(code&255,async value=>{if(value>255){notice('请选择基础按键');return}selected=k;await applyCode((code&0xff00)|value)},'选择基础按键',{basicOnly:true}))};
 host.append(base);button.classList.add('modifier-key');
}
function drawBoard(p,test=false,preview=false,adc=false){
 const wrap=el('div','boardWrap'),board=el('div','keyboard');
 const definition=preview?previewDefinition:kb.definition;
 const defs=visibleLayout(keydefs,definition.layouts.labels||[],preview?previewOptions:kb.layoutOptions).filter(k=>test?!k.encoder:true),bounds=layoutBounds(defs),unit=test?51:61.2,keyGap=test?5:6;
 board.style.width=bounds.width*unit+'px';board.style.height=bounds.height*unit+'px';
 for(const k of defs){
  if(!preview&&!k.encoder&&(k.row>=kb.rows||k.col>=kb.cols))continue;
  if(k.encoder&&(test||![0,1].includes(k.col)))continue;
  const code=preview?undefined:k.encoder?encoderValues.get(k.row)?.[k.col]:kb.code(layer,k.row,k.col);
  const b=el('button',k.encoder?'encoder-key layout-encoder':'key');
  if(k.encoder){b.append(el('span','encoder-legend',preview?`E${k.row+1}`:code===undefined?'…':label(code)),el('span','encoder-direction',encoderDirection(k.col)));b.dataset.encoder=k.row;b.dataset.direction=k.col;b.setAttribute('aria-label',`旋钮 ${k.row+1} ${encoderDirection(k.col)} ${code===undefined?'':label(code).replaceAll('\n',' ')}`)}
  else{if(test&&!adc&&testedKeys.has(`${k.row},${k.col}`))b.classList.add('tested');b.textContent=adc?'—':preview?(previewDefinition?.previewLabels?.[`${k.row},${k.col}`]??`${k.row},${k.col}`):label(code);b.dataset.coord=k.row+','+k.col}
  if(selected&&!!selected.encoder===!!k.encoder&&selected.row===k.row&&selected.col===k.col)b.classList.add('selected');
  if(adc){b.classList.add('adc-key');b.setAttribute('aria-label',`矩阵 ${k.row},${k.col}，ADC 未读取`)}
  b.title=adc?`矩阵 ${k.row},${k.col} · ADC 未读取`:k.encoder?`旋钮 ${k.row+1} · ${encoderDirection(k.col)} · JSON (${k.x}, ${k.y})`:`矩阵 ${k.row},${k.col} · ${preview?'布局位置':hex(code)}`;
  Object.assign(b.style,{left:(k.x-bounds.minX)*unit+'px',top:(k.y-bounds.minY)*unit+'px',width:k.w*unit-keyGap+'px',height:k.h*unit-keyGap+'px'});
  const shape=keyShape(k,unit,keyGap);
  if(!k.encoder&&shape.compound){
   b.classList.add('compound-key');
   const legend=el('span','compound-legend',b.textContent);b.textContent='';
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');
   svg.innerHTML=`<path class="shape-shadow" d="${shape.fill}" transform="translate(0 3)"/><path class="shape-fill" d="${shape.fill}"/><path class="shape-outline" d="${shape.outline}"/>`;
   b.append(svg,legend);
  }
  if(!preview&&!test&&!k.encoder)drawModifierLegend(b,code,k);
  if(k.r){b.style.transformOrigin=`${(k.rx-k.x)*unit}px ${(k.ry-k.y)*unit}px`;b.style.transform=`rotate(${k.r}deg)`}
  b.onclick=()=>{if(test)return;if(preview){$('#selection').textContent=k.encoder?`旋钮 ${k.row+1} · ${encoderDirection(k.col)} · 坐标 ${k.x},${k.y}`:`矩阵 ${k.row},${k.col} · 坐标 ${k.x},${k.y} · 尺寸 ${k.w} × ${k.h}`;return;}const code=k.encoder?encoderValues.get(k.row)?.[k.col]:kb.code(layer,k.row,k.col);selected=k;document.querySelectorAll('.key,.encoder-key').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');$('#selection').textContent=k.encoder?`旋钮 ${k.row+1} · ${encoderDirection(k.col)} · ${label(code)}`:`按键 ${k.row},${k.col} · ${label(code)}`};
  board.append(b);
 }
 wrap.append(board);p.append(wrap);
}
async function keymap(){
 const p=panel();p.classList.add('mapping-panel');const controls=el('div','mapping-controls');layerBar(controls);drawLayoutChoices(controls);p.append(controls);drawBoard(p);
 p.append(el('p','muted','点击按键或旋钮方向，再从下方选择要写入的键值。'));
 const edit=panel();edit.classList.add('selector-panel');const selection=el('p','selection-status',selected?.encoder?`当前旋钮 ${selected.row+1} · ${encoderDirection(selected.col)}`:selected?`当前按键：${selected.row},${selected.col}`:'当前未选择按键');selection.id='selection';edit.append(selection);
 await selector(edit,currentPaletteTab);
 for(const id of [...new Set(keydefs.filter(k=>k.encoder).map(k=>k.row))])encoderValues.set(id,await kb.encoder(layer,id));
 const replacement=el('div');drawBoard(replacement);p.querySelector('.boardWrap').replaceWith(replacement.firstChild);
}
async function cardSummaries(type,device=kb,format=label){
 if(type==='macro'){const macroData=await device.macros();return macroData.map(bytes=>decodeMacro(bytes).map(a=>`${{text:'Tx',tap:'T',down:'D',up:'U',delay:'⏱'}[a.type]}  ${a.type==='text'?a.value:a.type==='delay'?a.value+' ms':format(parse(a.value)).replaceAll('\n',' ')}`))}
 if(type==='repeat'){const entries=[];for(let i=0;i<device.counts[3];i++){const v=await device.dynamic(3,i);entries.push(v[0]||v[1]?[`K  ${format(v[0]).replaceAll('\n',' ')||'—'}`,`A  ${format(v[1]).replaceAll('\n',' ')||'—'}`,(v[3]&8)?'已启用':'未启用']:[])}return entries}
 if(type==='override'){const entries=[];for(let i=0;i<device.counts[2];i++){const v=await device.dynamic(2,i);entries.push(v[0]||v[1]?[`T  ${format(v[0]).replaceAll('\n',' ')||'—'}`,`R  ${format(v[1]).replaceAll('\n',' ')||'—'}`,(v[6]&128)?'已启用':'未启用']:[])}return entries}
 const t=type==='tap'?0:1,entries=[];for(let i=0;i<device.counts[t];i++){const v=await device.dynamic(t,i);entries.push(v.slice(0,4).some(n=>n)||v[t===0?3:4]?type==='tap'?v.slice(0,4).map((n,j)=>`${['Tap','Hold','Double','Tap-Hold'][j]}  ${format(n).replaceAll('\n',' ')||'—'}`).concat(`${v[4]} ms`):[v.slice(0,4).filter(n=>n).map(n=>format(n).replaceAll('\n',' ')).join(' + '),'→ '+(format(v[4])||'—')]:[])}return entries;
}
async function selector(host,initialTab){
 // Basic key selection must not wait for macro USB reads. Macro loads on demand.
 const device=kb,format=label;
 return mountPalette(host,{codes,label,userKeys,openKeyPicker,layers:kb.layers,macroCount:kb.macroCount,tapCount:kb.counts[0],comboCount:kb.counts[1],overrideCount:kb.counts[2],repeatCount:kb.counts[3],initialTab,onTabChange:tab=>{currentPaletteTab=tab},act:run,pick:applyCode,readCards:type=>cardSummaries(type,device,format),subscribe:device.viewCache.subscribe,editCard:openEntry});
}
async function entryOverview(tab){const p=panel();await selector(p,tab)}
async function openEntry(type,index){
 const modal=$('#modal');modal.classList.toggle('advanced-editor',type==='override'||type==='repeat');modal.classList.toggle('macro-editor',type==='macro');$('#modalBody').replaceChildren();$('#modalTitle').textContent=type==='macro'?`编辑 M${index}`:type==='tap'?`编辑 TD(${index})`:type==='repeat'?`编辑 Alt Repeat Key ${index}`:type==='override'?`编辑 Key Override ${index}`:`编辑 Combo ${index}`;
 editorHost=$('#modalBody');try{if(type==='macro')await macroUI(index);else await dynamicUI(type==='tap'?0:type==='override'?2:type==='repeat'?3:1,index)}finally{editorHost=null}
 if(!modal.open)modal.showModal();
}
async function applyCode(code){
  const written=selected;
  if(!written)throw Error('请先选择一个按键或旋钮方向');
  if(written.encoder){await kb.setEncoder(layer,written.row,written.col,code);notice(`已写入 Layer ${layer} / 旋钮 ${written.row+1} ${encoderDirection(written.col)} → ${label(code)}`)}
  else{await kb.setKey(layer,written.row,written.col,code);notice(`已写入 Layer ${layer} / ${written.row},${written.col} → ${label(code)}`)}
  // Update only the changed key: retain the selector, active tab and scroll position.
  const target=written.encoder?document.querySelector(`.layout-encoder[data-encoder="${written.row}"][data-direction="${written.col}"]`):document.querySelector(`.key[data-coord="${written.row},${written.col}"]`);
  if(written.encoder){const values=encoderValues.get(written.row);if(values)values[written.col]=code;if(target)target.querySelector('.encoder-legend').textContent=label(code)}else if(target){target.classList.remove('modifier-key');(target.querySelector('.compound-legend')||target).textContent=label(code);drawModifierLegend(target,code,written);}
  if(target)target.title=label(code)+' · '+hex(code);
  $('#selection').textContent=(written.encoder?`旋钮 ${written.row+1} · ${encoderDirection(written.col)}`:`按键 ${written.row},${written.col}`)+' · '+label(code);
  if(selected===written&&target){
   const keys=[...target.closest('.keyboard').querySelectorAll('.key,.layout-encoder')].sort((a,b)=>a.offsetTop-b.offsetTop||a.offsetLeft-b.offsetLeft);
   const next=keys[keys.indexOf(target)+1];
   if(next)next.click();
   else{target.classList.remove('selected');selected=null;$('#selection').textContent='已到布局末尾，请选择需要继续修改的按键。'}
  }

}
async function encoders(){const p=panel('旋钮映射');layerBar(p);const ids=[...new Set(keydefs.filter(k=>k.encoder).map(k=>k.row))];if(!ids.length){p.append(el('p','','设备定义没有旋钮。'));return}for(const id of ids){const values=await kb.encoder(layer,id),box=el('div','panel');box.append(el('h3','',`旋钮 ${id}`));const a=field(box,'方向 0（固件定义）',values[0]),b=field(box,'方向 1（固件定义）',values[1]);box.append(button('写入旋钮',async()=>{await kb.setEncoder(layer,id,0,parse(a.value));await kb.setEncoder(layer,id,1,parse(b.value));notice('旋钮映射已写入')}));p.append(box)}}
function keyPickerButton(value,onChange,title='选择按键'){
 const b=el('button','key-value-button',label(value)||'▽');b.type='button';b.value=value;b.title=title+' · '+hex(value);b.setAttribute('aria-label',title+'：'+(label(value).replaceAll('\n',' ')||'空按键'));
 b.onclick=()=>run(()=>openKeyPicker(Number(b.value),code=>{b.value=code;b.textContent=label(code)||'▽';b.title=title+' · '+hex(code);b.setAttribute('aria-label',title+'：'+(label(code).replaceAll('\n',' ')||'空按键'));onChange?.(code)},title));return b;
}
async function openKeyPicker(value,onChange,title,options={}){
 const dialog=el('dialog','key-picker-dialog'),head=el('div','key-picker-header'),current=el('span','key-picker-current',label(value)||'▽'),close=el('button','','关闭');
 head.append(el('strong','',title),current,close);const host=el('div','key-picker-content');dialog.append(head,host);document.body.append(dialog);
 const dismiss=()=>{dialog.close();dialog.remove()};close.onclick=dismiss;dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss()});dialog.showModal();
 const device=kb,format=label;
 try{await mountPalette(host,{codes,label,userKeys,openKeyPicker,layers:device.layers,macroCount:device.macroCount,tapCount:device.counts[0],comboCount:device.counts[1],overrideCount:device.counts[2],repeatCount:device.counts[3],initialTab:'Basic',basicOnly:!!options.basicOnly,act:run,pick:async code=>{integer(code);await onChange(code);dismiss()},readCards:type=>cardSummaries(type,device,format),subscribe:device.viewCache.subscribe,allowEdit:false,editCard:openEntry})}
 catch(e){dismiss();throw e}
}
const dynamicNames=[['轻点','长按','双击','双击后长按','判定时间（ms）'],['输入键 1','输入键 2','输入键 3','输入键 4','输出键'],['触发键','替换键','生效层位掩码','必需修饰位','排除修饰位','抑制修饰位','选项位（128 为启用）'],['原按键','替代按键','允许修饰位','选项位（8 为启用）']];
async function dynamicUI(type,initialIndex=0){
 const p=panel(['Tap Dance','Combo','Key Override','Alt Repeat Key'][type]);if(!kb.counts[type]){p.append(el('p','','当前固件未提供此功能。'));return}
 const s=select(p,Array.from({length:kb.counts[type]},(_,i)=>[i,String(i)]),initialIndex);s.setAttribute('aria-label','编号');const body=el('div');p.append(body);
 async function load(reset=false){const index=Number(s.value);const values=reset?[[0,0,0,0,200],[0,0,0,0,0],[0,0,0,0,0,0,0],[0,0,0,0]][type].slice():[...await kb.dynamic(type,index)];body.replaceChildren();
  if(type===2||type===3){const read=buildAdvancedEntry(body,type,values,{keyButton:keyPickerButton});const actions=el('div','actions');actions.append(button('重置',()=>load(true)),button('保存',async()=>{await kb.dynamic(type,Number(s.value),read());notice('配置已保存');if($('#modal').open)$('#modal').close()},'primary'));body.append(actions);return}
  const inputs=values.map((value,i)=>{
   const isKey=type===0?i<4:type===1?true:i<2;
   if(!isKey)return field(body,dynamicNames[type][i],value,(type===2&&i>=3||type===3&&i>=2)?255:65535);
   const row=el('div','field'),name=dynamicNames[type][i],key=keyPickerButton(value,null,name);row.append(el('label','',name),key);body.append(row);return key;
  });
  const actions=el('div','actions');actions.append(button('重置',()=>load(true)),button('保存',async()=>{await kb.dynamic(type,Number(s.value),inputs.map((input,i)=>integer(input.value,(type===2&&i>=3||type===3&&i>=2)?255:65535)));notice('配置已保存');if($('#modal').open)$('#modal').close()},'primary'));body.append(actions);
 }
 s.onchange=()=>run(load);await load();
}
function encodeMacro(actions){const out=[];for(const a of actions){if(a.type==='text'){const bytes=[...new TextEncoder().encode(a.value)];if(bytes.some(b=>b===0||b<=3))throw Error('文本不能包含宏控制字符');out.push(...bytes)}else if(a.type==='delay'){if(kb.version<2)throw Error('固件不支持延时');const n=integer(a.value,65024);out.push(1,4,n%255+1,Math.floor(n/255)+1)}else{let k=parse(a.value);const op={tap:1,down:2,up:3}[a.type];if(!op)throw Error('未知宏动作');if(kb.version>=2)out.push(1);if(k>255){if(kb.version<5)throw Error('固件不支持扩展宏键码');if(!(k&255))k=(k>>8)|0xff00;out.push(op+4,...u16(k))}else{if(!k)throw Error('宏动作不能使用空键码');out.push(op,k)}}}return out}
function decodeMacro(bytes){const a=[];let text=[];const flush=()=>{if(text.length){a.push({type:'text',value:new TextDecoder().decode(new Uint8Array(text))});text=[]}};for(let i=0;i<bytes.length;){let op=kb.version>=2?(bytes[i]===1?bytes[i+1]:0):(bytes[i]<=3?bytes[i]:0);if(!op){text.push(bytes[i++]);continue}flush();i+=kb.version>=2?2:1;if(op===4){a.push({type:'delay',value:(bytes[i]-1)+(bytes[i+1]-1)*255});i+=2}else if(op>=1&&op<=7){let k=op>=5?read16(bytes,i):bytes[i];i+=op>=5?2:1;if(k>0xff00)k=(k&255)<<8;a.push({type:['tap','down','up'][(op-1)%4],value:hex(k)})}else throw Error('无法解析的宏操作')}flush();return a}
async function macroUI(initialIndex=0){
 const p=panel();p.classList.add('macro-workspace');macros=await kb.macros();if(!kb.macroCount){p.append(el('p','','固件未启用宏。'));return}
 let index=initialIndex;const drafts=new Map(),tabs=el('div','macro-tabs'),body=el('div','macro-rows'),footer=el('div','macro-footer'),memory=el('span','muted');let actions=[];
 const tabButtons=macros.map((_,i)=>{const b=button('M'+i,()=>{drafts.set(index,actions);index=i;load()});tabs.append(b);return b});p.append(tabs,body,footer);
 function usage(){try{const size=macros.reduce((sum,m,i)=>sum+(drafts.has(i)?encodeMacro(drafts.get(i)).length:m.length)+1,0);memory.textContent=`宏内存：${size} / ${kb.macroSize} 字节`}catch(e){memory.textContent=e.message}}
 const editText=button('编辑文本…',()=>{
  const dialog=el('dialog','macro-text-editor'),title=el('h3','','编辑 M'+index+' 文本'),input=el('textarea'),error=el('p','danger'),buttons=el('div','actions');
  input.setAttribute('aria-label','宏动作 JSON');input.spellcheck=false;
  input.value=JSON.stringify(actions.map(a=>[a.type,a.type==='text'?a.value:a.type==='delay'?Number(a.value):a.value]),null,2);
  const close=()=>{dialog.close();dialog.remove()};
  const apply=button('应用',()=>{try{
   const list=JSON.parse(input.value);if(!Array.isArray(list))throw Error('请输入动作数组');
   const next=list.flatMap(item=>{
    if(!Array.isArray(item)||!['text','tap','down','up','delay'].includes(item[0]))throw Error('动作格式无效');
    const [type,...values]=item;if(type==='text'){if(values.length!==1||typeof values[0]!=='string')throw Error('文本动作需要字符串');return [{type,value:values[0]}]}
    if(type==='delay'){if(values.length!==1)throw Error('延时动作需要一个数值');return [{type,value:integer(values[0],65024)}]}
    return values.map(value=>({type,value:hex(parse(value))}));
   });encodeMacro(next);actions=next;draw();close();
  }catch(e){error.textContent=e.message}});
  buttons.append(button('取消',close),apply);dialog.append(title,input,error,buttons);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 });
 const add=button('+ 添加动作',()=>{actions.push({type:'text',value:''});draw()});
 const enter=button('轻点 Enter',()=>{actions.push({type:'tap',value:hex(codes.KC_ENTER??40)});draw()});
 const revert=button('重置',()=>{actions=[];draw()});
 const save=button('保存',async()=>{
  if((await kb.vial(5))[0]!==1)throw Error('请先在安全页面完成物理解锁');
  drafts.set(index,actions);const next=macros.map((m,i)=>drafts.has(i)?encodeMacro(drafts.get(i)):[...m]);
  await kb.saveMacros(next);macros=next;drafts.clear();notice('宏已保存');if($('#modal').open)$('#modal').close();
 },'primary');footer.append(editText,memory,add,enter,revert,save);
 function move(i,delta){const j=i+delta;if(j<0||j>=actions.length)return;[actions[i],actions[j]]=[actions[j],actions[i]];draw()}
 function draw(){
  drafts.set(index,actions);tabButtons.forEach((b,i)=>b.classList.toggle('active',i===index));$('#modalTitle').textContent='编辑 M'+index;body.replaceChildren();
  actions.forEach((a,i)=>{
   const row=el('div','macro-action'),arrows=el('div','macro-move'),up=button('▲',()=>move(i,-1)),down=button('▼',()=>move(i,1));
   up.disabled=i===0;down.disabled=i===actions.length-1;up.setAttribute('aria-label','上移动作');down.setAttribute('aria-label','下移动作');arrows.append(up,down);row.append(arrows);
   const type=select(row,[['text','Text'],['tap','Tap'],['down','Down'],['up','Up'],['delay','Delay (ms)']],a.type);
   type.onchange=()=>{a.type=type.value;a.value=a.type==='text'?'':a.type==='delay'?100:'0x0004';draw()};
   const value=el('div','macro-value');
   if(['tap','down','up'].includes(a.type))value.append(keyPickerButton(parse(a.value),code=>{a.value=hex(code);usage()},'宏动作按键'));
   else{const input=el('input');input.type=a.type==='delay'?'number':'text';if(a.type==='delay'){input.min=0;input.max=65024}input.value=a.value;input.setAttribute('aria-label',a.type==='delay'?'延时（毫秒）':'输入文本');input.oninput=()=>{a.value=input.value;usage()};value.append(input)}
   const remove=button('×',()=>{actions.splice(i,1);draw()},'macro-delete');remove.setAttribute('aria-label','删除动作');row.append(value,remove);body.append(row);
  });usage();
 }
 function load(){actions=drafts.get(index)??decodeMacro(macros[index]);draw()}load();
}
async function lighting(){await mountLighting(panel('灯光配置'),kb,{notice})}
async function settings(){await mountSettings(panel(),kb,{run,notice})}
async function layoutUI(){
 const device=kb,q=panel('布局与矩阵测试');drawLayoutChoices(q);drawBoard(q,true);
 q.append(el('p','muted','按住：蓝色 · 已按过：绿色。测试期间屏蔽网页键盘操作，请使用鼠标停止测试；切换布局保留测试记录。'));
 const clearPressed=()=>q.querySelectorAll('.key').forEach(b=>b.classList.remove('pressed'));
 matrixStart=async()=>{
  if((await device.vial(5))[0]!==1)throw Error('请先到安全页面解锁设备');
  stopMatrix();
  if(2+device.rows*Math.ceil(device.cols/8)>32)throw Error('矩阵超过单包容量');
  matrixTimer=setInterval(()=>{if(busy)return;run(async()=>{
   try{const data=await device.send(2,3);if(!q.isConnected||kb!==device)return;updateMatrixKeys(q.querySelectorAll('.key'),data,device.rows,device.cols,testedKeys)}
   catch(e){stopMatrix();clearPressed();throw e}
  })},100);document.activeElement?.blur?.();notice('矩阵测试进行中，键盘输入已屏蔽，请使用鼠标操作。');
 };
 const actions=el('div','actions');actions.append(button('开始测试',matrixStart),button('停止测试',()=>{stopMatrix();clearPressed();notice('测试已停止，已测试记录保留。')}),button('清除测试记录',()=>{testedKeys.clear();q.querySelectorAll('.key').forEach(b=>b.classList.remove('tested'));notice('测试记录已清除。')}));q.append(actions);
}
async function security(host=null,refresh=render){
 const device=kb;
 const securityPanel=title=>{if(!host)return panel(title);const box=el('div','panel');box.append(el('h3','',title));host.append(box);return box};
 const lock=securityPanel('安全锁'),status=el('p','',device?'正在读取安全锁状态…':'设备未连接'),positions=el('p','muted',device?'':'连接键盘后可查看物理解锁按键。');lock.append(status,positions);
 const requireDevice=()=>{if(!device||kb!==device)throw Error('请先连接键盘')};
 const unlock=button('开始物理解锁',async()=>{
  requireDevice();await device.vial(6);notice('请持续按住上述物理按键。');
  for(let i=0;i<150;i++){requireDevice();const value=await device.vial(7);if(value[0]===1){notice('解锁成功');await refresh();return}await new Promise(resolve=>setTimeout(resolve,200))}
  throw Error('解锁等待超时，请重新尝试');
 }),setLock=button('锁定设备',async()=>{requireDevice();await device.vial(8);notice('设备已锁定');await refresh()});
 unlock.disabled=setLock.disabled=!device;lock.append(unlock,setLock);
 fileActions(securityPanel('备份与恢复'));
 const protocol=securityPanel('设备与协议');protocol.append(el('p','',device?`UID ${device.uid} · VIA ${device.via} · Vial ${device.version}`:'设备未连接'));
 const exportDefinition=button('导出设备定义 JSON',()=>{requireDevice();return download(device.definition,'vial-definition.json')});exportDefinition.disabled=!device;protocol.append(exportDefinition,el('p','muted','进入 Boot 模式后，请使用对应固件工具刷写。'));
 if(device){try{
  const value=await device.vial(5);if(kb!==device)return;
  status.textContent=value[0]===1?'设备当前已解锁':'设备当前已锁定';const coords=[];
  for(let i=2;i<32;i+=2)if(value[i]!==255&&value[i+1]!==255)coords.push(`${value[i]},${value[i+1]}`);
  positions.textContent='物理解锁需持续按住矩阵位置：'+(coords.join('、')||'无');
 }catch(e){status.textContent='安全锁状态读取失败：'+e.message}}
}
function parseVilOrBackup(text){const data=JSON.parse(text.replace(/^\uFEFF/,''));return data.format==='vial-studio-1'?data:parseVil(text)}
function download(data,name='vial-studio-backup.json'){return saveFile(()=>data,name)}
async function snapshot(){const data={format:'vial-studio-1',uid:kb.uid,rows:kb.rows,cols:kb.cols,layers:kb.layers,version:kb.version,keymap:Array.from(kb.keymap),layoutOptions:kb.layoutOptions,macros:await kb.macros(),dynamic:[],encoders:[],settings:{}};for(let t=0;t<4;t++){const entries=[];for(let i=0;i<kb.counts[t];i++)entries.push(await kb.dynamic(t,i));data.dynamic.push(entries)}for(const id of [...new Set(keydefs.filter(k=>k.encoder).map(k=>k.row))])for(let l=0;l<kb.layers;l++)data.encoders.push([l,id,await kb.encoder(l,id)]);const schema=await (await fetch('qmk_settings.json')).json(),supported=new Set(await kb.supportedSettings()),widths={};for(const tab of schema.tabs)for(const f of tab.fields)if(supported.has(f.qsid))widths[f.qsid]=f.width||1;for(const [id,w] of Object.entries(widths))data.settings[id]=[w,await kb.setting(Number(id),w)];return data}
function validateSnapshot(d){if(d.format!=='vial-studio-1'||d.uid!==kb.uid||d.rows!==kb.rows||d.cols!==kb.cols||d.layers!==kb.layers||d.version!==kb.version)throw Error('备份的设备、协议版本或矩阵不匹配');if(!Array.isArray(d.keymap)||d.keymap.length!==kb.keymap.length)throw Error('键位数据长度不匹配');d.keymap.forEach(x=>integer(x,255));if(!Array.isArray(d.macros)||!Array.isArray(d.dynamic)||d.dynamic.length!==4||!Array.isArray(d.encoders)||typeof d.settings!=='object')throw Error('备份字段不完整');d.macros.forEach(a=>{if(!Array.isArray(a))throw Error('宏结构错误');a.forEach(x=>{integer(x,255);if(!x)throw Error('宏内容不能包含终止符')})});for(const e of d.encoders){if(!Array.isArray(e)||e.length!==3||!Array.isArray(e[2])||e[2].length!==2)throw Error('旋钮结构错误');integer(e[0],kb.layers-1);integer(e[1],255);e[2].forEach(x=>integer(x))}for(const [id,v] of Object.entries(d.settings)){integer(id);if(!Array.isArray(v)||v.length!==2||![1,2,4].includes(v[0]))throw Error('设置字段错误');integer(v[1],2**(v[0]*8)-1)}d.dynamic.forEach((a,t)=>{if(a.length!==kb.counts[t])throw Error('动态条目数量不匹配');a.forEach(v=>{if(v.length!==[5,5,7,4][t])throw Error('动态字段数量不匹配');v.forEach((x,i)=>integer(x,(t===2&&i>=3||t===3&&i>=2)?255:65535))})});integer(d.layoutOptions,4294967295)}
async function restore(d){await kb.macros();if(d.macros.length!==kb.macroCount||d.macros.flatMap(a=>[...a,0]).length>kb.macroSize)throw Error('宏数量或容量不匹配');if((await kb.vial(5))[0]!==1)throw Error('恢复前请先解锁设备');for(let l=0;l<kb.layers;l++)for(let r=0;r<kb.rows;r++)for(let c=0;c<kb.cols;c++){const i=((l*kb.rows+r)*kb.cols+c)*2,n=d.keymap[i]*256+d.keymap[i+1];if(n!==kb.code(l,r,c))await kb.setKey(l,r,c,n)}for(const [l,id,v] of d.encoders)for(let dir=0;dir<2;dir++)await kb.setEncoder(l,id,dir,v[dir]);await kb.setOptions(d.layoutOptions);await kb.saveMacros(d.macros);for(let t=0;t<4;t++)for(let i=0;i<d.dynamic[t].length;i++)await kb.dynamic(t,i,d.dynamic[t][i]);for(const [id,[w,v]] of Object.entries(d.settings))await kb.setting(Number(id),w,v)}
$('#close').onclick=()=>{$('#modal').close();run(render)};render();

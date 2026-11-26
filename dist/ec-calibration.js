import {EcProtocol,normalizeAdc} from './ec-protocol.js?v=ec-little-endian-5';
import {parseLayout,visibleLayout,layoutBounds,keyShape} from './layout.js?v=compound-keys-2';
export function parseAdcJson(text,rows,cols) {
 let data;try{data=JSON.parse(text)}catch{throw Error('JSON 格式无效，请按示例填写，例如 {"0,0":100}')}
 if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length)throw Error('请使用矩阵坐标作为键名，例如 {"0,0":100}');
 const result=Object.fromEntries(['baseline','actuation','release'].map(kind=>[kind,Array.from({length:rows},()=>Array(cols).fill(undefined))]));
 for(const [coord,values] of Object.entries(data)){
  const match=/^(0|[1-9]\d*),(0|[1-9]\d*)$/.exec(coord);if(!match)throw Error(`坐标 ${coord} 无效，应为“行,列”`);
  const [,r,c]=match.map(Number);if(r>=rows||c>=cols)throw Error(`坐标 ${coord} 超出 ${rows} × ${cols} 矩阵`);
  if(!Number.isInteger(values)||values<0||values>1024)throw Error(`坐标 ${coord} 需要一个 0–1024 的基准 ADC 整数`);
  result.baseline[r][c]=values;
 }
 return result;
}

async function mountAdcBoard(parent,device,make,notice,run) {
 const api=new EcProtocol(device);
 const section=make('div',null,'panel');
 const toolbar=make('div',null,'ec-adc-toolbar'),calibrate=make('button','校准基准 ADC','primary'),calibrationState=make('span',null,'muted');calibrationState.setAttribute('role','status');
 toolbar.append(make('h3','每键 ADC'),calibrate,calibrationState);section.append(toolbar);parent.append(section);
 const progress=make('progress',null,'ec-calibration-progress');progress.max=5000;progress.value=0;progress.hidden=true;progress.setAttribute('aria-label','校准等待进度');toolbar.after(progress);
 calibrate.onclick=()=>{const dialog=make('dialog',null,'ec-calibration-reminder');dialog.append(make('h3','基准 ADC 校准'),make('p','请松开所有按键，校准期间不要按任何按键。'));const cancel=make('button','取消'),start=make('button','开始校准','primary');dialog.append(cancel,start);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});cancel.onclick=()=>dialog.close();start.onclick=()=>{dialog.close();run(async()=>{calibrate.disabled=true;reload.disabled=true;saveCalibration.disabled=true;progress.hidden=false;progress.value=0;const started=performance.now();const tick=()=>{const elapsed=Math.min(5000,performance.now()-started);progress.value=elapsed;calibrationState.textContent=`正在校准，请勿按键… ${Math.ceil((5000-elapsed)/1000)} 秒`};tick();const timer=setInterval(tick,50);try{await api.calibrate();const remaining=5000-(performance.now()-started);if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));progress.value=5000;clearInterval(timer);calibrationState.textContent='正在读取校准值…';await refresh();calibrationState.textContent='已读取校准后的 ADC';notice('5 秒校准等待结束，已重新读取基准 ADC。')}catch(e){calibrationState.textContent='校准或读取失败，请重试';throw e}finally{clearInterval(timer);progress.hidden=true;calibrate.disabled=false;reload.disabled=false;saveCalibration.disabled=false}})};dialog.showModal();cancel.focus()};
 const status=make('p','尚未读取 ADC 数据；“—”表示无数据。','muted');status.setAttribute('role','status');section.append(status);
 const wrap=make('div',null,'boardWrap'),board=make('div',null,'keyboard ec-adc-board');wrap.append(board);section.append(wrap);
 const keys=visibleLayout(parseLayout(device.definition),device.definition.layouts.labels||[],device.layoutOptions).filter(k=>!k.encoder),bounds=layoutBounds(keys),unit=61.2,gap=6;
 board.style.width=bounds.width*unit+'px';board.style.height=bounds.height*unit+'px';
 const cache=device.ecAdcData||(device.ecAdcData={}),cells=[];
 const offsets=device.ecAdcOffsets||(device.ecAdcOffsets={actuation:200,release:100});
 for(const k of keys){const b=make('div','—','key ec-adc-key');Object.assign(b.style,{left:(k.x-bounds.minX)*unit+'px',top:(k.y-bounds.minY)*unit+'px',width:k.w*unit-gap+'px',height:k.h*unit-gap+'px'});
  const shape=keyShape(k,unit,gap);let legend=b;
  if(shape.compound){b.classList.add('compound-key');legend=make('span','—','compound-legend');b.textContent='';const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');svg.innerHTML=`<path class="shape-shadow" d="${shape.fill}" transform="translate(0 3)"/><path class="shape-fill" d="${shape.fill}"/><path class="shape-outline" d="${shape.outline}"/>`;b.append(svg,legend)}
  if(k.r){b.style.transformOrigin=`${(k.rx-k.x)*unit}px ${(k.ry-k.y)*unit}px`;b.style.transform=`rotate(${k.r}deg)`}
  board.append(b);cells.push({k,b,legend});
 }
 const metrics=[['actuation','触发'],['release','释放'],['baseline','基准']];const ranges=[];

 const draw=()=>{for(const {k,b,legend} of cells){legend.replaceChildren();const descriptions=[];for(const [kind,name] of metrics.filter(([kind])=>kind==='baseline')){const baseline=cache.baseline?.[k.row]?.[k.col],value=kind==='baseline'?(baseline===undefined?undefined:normalizeAdc(baseline)):baseline===undefined?undefined:Math.min(1024,baseline+offsets[kind]),row=make('span',null,'ec-adc-metric ec-adc-'+kind);row.append(make('strong',value===undefined?'—':String(value)));legend.append(row);descriptions.push(`${name} ${value===undefined?'未读取':value}`)}b.title=`矩阵 ${k.row},${k.col} · ${descriptions.join(' · ')}`;b.setAttribute('aria-label',b.title)}status.textContent=metrics.some(([kind])=>cache[kind])?'显示基准 ADC 数据。':'尚未读取 ADC 数据；“—”表示无数据。'};
 const sliders=make('div',null,'ec-offset-sliders');
 const syncLimits=()=>{for(const item of ranges){const isAct=item.kind==='actuation';const min=isAct?Math.max(60,Math.ceil((offsets.release+1)/10)*10):50;const max=isAct?1020:Math.min(1010,Math.floor((offsets.actuation-1)/10)*10);item.range.min=min;item.range.max=Math.max(min,max);item.range.disabled=min>max;item.range.value=offsets[item.kind];item.output.textContent='+'+offsets[item.kind]}};
 for(const [kind,name] of metrics.slice(0,2)){
  const label=make('label',null,'ec-offset-control ec-adc-'+kind),range=make('input'),output=make('output');range.type='range';range.min=50;range.max=1020;range.step=10;range.value=offsets[kind];range.disabled=true;range.setAttribute('aria-label',name+'相对基准的偏移');output.textContent='+'+range.value;
  range.oninput=()=>{output.textContent='+'+range.value};
  range.onchange=()=>run(async()=>{const value=Number(range.value);if((kind==='actuation'&&value<=offsets.release)||(kind==='release'&&value>=offsets.actuation)){syncLimits();throw Error('释放偏移必须小于触发偏移')}for(const item of ranges)item.range.disabled=true;try{offsets[kind]=await api.offset(kind==='actuation'?2:3,value);notice(name+'偏移已写入并读取确认。')}finally{syncLimits()}});
  ranges.push({kind,range,output});label.append(make('span',name+'偏移'),range,output);sliders.append(label);
 }
 wrap.before(sliders,make('p','偏移相对于每键基准 ADC：按下阈值 = 基准 + 触发偏移，释放阈值 = 基准 + 释放偏移。例如基准 100、触发偏移 500，则按下阈值为 100 + 500 = 600；释放偏移 400，则释放阈值为 100 + 400 = 500。','muted ec-offset-note'),make('p','每次调整 10，释放偏移必须小于触发偏移。滑块最大 1020（不超过 1024），松开后写入并保存。','muted ec-offset-note'));

 const refresh=async()=>{status.textContent='正在读取基准 ADC…';const baseline=await api.baselines(),actuation=await api.offset(2),release=await api.offset(3);cache.baseline=baseline;offsets.actuation=actuation;offsets.release=release;syncLimits();draw()};
 const saveCalibration=make('button','保存校准 ADC');saveCalibration.disabled=true;saveCalibration.onclick=()=>run(async()=>{saveCalibration.disabled=true;try{calibrationState.textContent='正在写入 ADC…';cache.baseline=await api.saveCalibration(cache.baseline);draw();calibrationState.textContent='ADC 已发送，标记指令已应答';notice('网页当前基准 ADC 已分包发送，随后已发送标记 0x45434231。')}finally{saveCalibration.disabled=false}});const actions=make('div',null,'ec-adc-actions');toolbar.append(actions);actions.append(calibrate,saveCalibration);
 const reload=make('button','读取 ADC');reload.onclick=()=>run(async()=>{reload.disabled=true;try{await refresh();notice('已读取基准 ADC，未执行校准。')}finally{reload.disabled=false}});actions.append(reload);reload.className='ec-reload';
 for(const {k,b} of cells){b.tabIndex=0;b.setAttribute('role','button');const edit=()=>{const dialog=make('dialog',null,'ec-calibration-reminder'),input=make('input'),save=make('button','保存','primary'),cancel=make('button','取消');input.type='number';input.min=0;input.max=1024;input.value=cache.baseline?.[k.row]?.[k.col]===undefined?'':normalizeAdc(cache.baseline[k.row][k.col]);input.setAttribute('aria-label','基准 ADC');dialog.append(make('h3',`按键 ${k.row},${k.col} · 基准 ADC`),input,cancel,save);document.body.append(dialog);cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});save.onclick=()=>run(async()=>{if(input.value==='')throw Error('请填写基准 ADC');const value=await api.key(k.row,k.col,Number(input.value));cache.baseline??=Array.from({length:device.rows},()=>[]);cache.baseline[k.row][k.col]=value;draw();dialog.close();notice('单键基准已写入并读取确认。')});dialog.showModal();input.focus()};b.onclick=edit;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();edit()}}}
 draw();await refresh();saveCalibration.disabled=false;

}

export async function mountEcCalibration(host,device,{run,notice}) {
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e};
 return mountAdcBoard(host,device,make,notice,run);
}

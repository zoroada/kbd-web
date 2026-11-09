// SPDX-License-Identifier: GPL-2.0-or-later
export function parseLayout(def){let out=[],y=0,x=0,w=1,h=1,r=0,rx=0,ry=0,align=4,x2=0,y2=0,w2=0,h2=0;for(const row of def.layouts.keymap){if(!Array.isArray(row))continue;x=rx;for(const item of row){if(typeof item==='object'){if(item.a!==undefined)align=item.a;if(item.rx!==undefined){rx=item.rx;x=rx}if(item.ry!==undefined){ry=item.ry;y=ry}x+=item.x||0;y+=item.y||0;if(item.w!==undefined)w=w2=item.w;if(item.h!==undefined)h=h2=item.h;for(const name of ['x2','y2','w2','h2']){if(item[name]!==undefined){if(name==='x2')x2=item[name];if(name==='y2')y2=item[name];if(name==='w2')w2=item[name];if(name==='h2')h2=item[name]}}if(item.r!==undefined)r=item.r;continue}const rawLabels=item.split('\n'),maps=[[0,6,2,8,9,11,3,5,1,4,7,10],[1,7,-1,-1,9,11,4,-1,-1,-1,-1,10],[3,-1,5,-1,9,11,-1,-1,4,-1,-1,10],[4,-1,-1,-1,9,11,-1,-1,-1,-1,-1,10],[0,6,2,8,10,-1,3,5,1,4,7,-1],[1,7,-1,-1,10,-1,4,-1,-1,-1,-1,-1],[3,-1,5,-1,10,-1,-1,-1,4,-1,-1,-1],[4,-1,-1,-1,10,-1,-1,-1,-1,-1,-1,-1]],lines=[];rawLabels.forEach((v,i)=>{const index=maps[align]?.[i];if(index>=0)lines[index]=v});const coord=lines[0]?.split(',').map(Number);if(coord?.length===2&&coord.every(Number.isInteger))out.push({x,y,w,h,x2,y2,w2:w2||w,h2:h2||h,r,rx,ry,row:coord[0],col:coord[1],encoder:lines[4]==='e',option:lines[8]});x+=w;w=h=1;x2=y2=w2=h2=0}y++}return out}

// Crop unused JSON coordinate offsets while retaining rotation and relative positions.
export function layoutBounds(keys){
 if(!keys.length)return {minX:0,minY:0,width:1,height:1};
 const points=keys.flatMap(k=>{
  const angle=(k.r||0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  return keyRectangles(k).flatMap(q=>[[q.x,q.y],[q.x+q.w,q.y],[q.x,q.y+q.h],[q.x+q.w,q.y+q.h]]).map(([x,y])=>({x:k.rx+(x-k.rx)*cos-(y-k.ry)*sin,y:k.ry+(x-k.rx)*sin+(y-k.ry)*cos}));
 });
 const minX=Math.min(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y));
 return {minX,minY,width:Math.max(...points.map(p=>p.x))-minX,height:Math.max(...points.map(p=>p.y))-minY};
}

export function validateLayoutDefinition(definition){
 if(!definition||!definition.matrix||!Array.isArray(definition.layouts?.keymap))throw Error('需要 Vial 布局 JSON，包含 matrix 和 layouts.keymap');
 const {rows,cols}=definition.matrix;
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<1||cols<1||rows>32||cols>32)throw Error('矩阵行列必须为 1–32 的整数');
 const keys=parseLayout(definition);
 if(!keys.length||keys.length>2048)throw Error('布局没有有效按键，或按键数量过多');
 for(const k of keys){
  if(![k.x,k.y,k.w,k.h,k.x2,k.y2,k.w2,k.h2,k.r,k.rx,k.ry].every(Number.isFinite)||k.w<=0||k.h<=0||k.w2<=0||k.h2<=0||Math.abs(k.x2)>100||Math.abs(k.y2)>100||k.w2>100||k.h2>100||Math.abs(k.x)>1000||Math.abs(k.y)>1000||k.w>100||k.h>100)throw Error('布局位置或尺寸无效');
  if(k.row<0||k.col<0||(!k.encoder&&(k.row>=rows||k.col>=cols))||(k.encoder&&(k.row>255||![0,1].includes(k.col))))throw Error('按键矩阵位置或旋钮方向无效');
 }
 return definition;
}

// Accept Vial/VIA definitions, raw Keyboard Layout Editor JSON and QMK info.json.
export function normalizeLayoutJSON(input){
 if(input?.layouts?.keymap){const def={...input,matrix:input.matrix&&{...input.matrix}};if(!def.matrix){const keys=parseLayout(def).filter(k=>!k.encoder);if(!keys.length)throw Error('布局缺少 matrix，且按键标签中没有可推断的行列坐标');def.matrix={rows:Math.max(...keys.map(k=>k.row))+1,cols:Math.max(...keys.map(k=>k.col))+1}}return validateLayoutDefinition(def)}
 const qmk=input?.layouts&&Object.values(input.layouts).find(v=>Array.isArray(v?.layout));
 if(qmk){const rows=qmk.layout.map(k=>[{x:k.x||0,y:k.y||0,w:k.w||1,h:k.h||1,rx:k.rx||0,ry:k.ry||0,r:k.r||0},k.matrix?.join(',')||'']);
  // Encode each absolute QMK key as a fresh KLE cluster.
  rows.forEach((row,i)=>{row[0].rx=qmk.layout[i].x||0;row[0].ry=qmk.layout[i].y||0;row[0].x=0;row[0].y=0});
  return normalizeLayoutJSON({name:input.keyboard_name||input.name,layouts:{keymap:rows}});
 }
 const raw=Array.isArray(input)?input:Array.isArray(input?.keymap)?input.keymap:null;
 if(raw){let visualRow=0,maxCols=0;const labels={},rows=[];
  for(const source of raw){if(!Array.isArray(source)){rows.push(source);continue}let col=0;const row=source.map(item=>{if(typeof item!=='string')return item;const coord=`${visualRow},${col++}`;labels[coord]=item;return coord});maxCols=Math.max(maxCols,col);rows.push(row);visualRow++}
  return validateLayoutDefinition({name:input.name||'KLE JSON 布局',matrix:{rows:visualRow,cols:maxCols},layouts:{keymap:rows},previewLabels:labels});
 }
 throw Error('不支持此 JSON 结构。请选择 Vial/VIA 键盘定义、KLE 布局 JSON 或 QMK info.json；键位备份请使用“安全与配置”中的恢复配置。');
}
export function parseLayoutFile(text){let input;try{input=JSON.parse(text.replace(/^\uFEFF/,''))}catch(e){throw Error('JSON 语法错误：'+e.message)}return normalizeLayoutJSON(input)}

// Match LayoutEditor.pack/unpack: the last choice occupies the lowest bits.
export function layoutChoices(labels=[],packed=0){
 let offset=0;const result=[];
 for(let i=labels.length-1;i>=0;i--){const item=labels[i],options=typeof item==='string'?['关闭','开启']:item.slice(1),bits=typeof item==='string'?1:Math.ceil(Math.log2(Math.max(1,options.length)));
  result[i]={index:i,title:typeof item==='string'?item:item[0],options,bits,offset,value:Math.floor((packed>>>0)/2**offset)%2**bits};offset+=bits;
 }
 if(offset>32)throw Error('布局选项超过协议的 32 位容量');return result;
}
export function changeLayoutChoice(labels,packed,index,value){const choice=layoutChoices(labels,packed)[index];if(!choice||!Number.isInteger(value)||value<0||value>=choice.options.length)throw Error('布局选项无效');return ((packed>>>0)-choice.value*2**choice.offset+value*2**choice.offset)>>>0}
export function visibleLayout(keys,labels=[],packed=0){
 const choices=layoutChoices(labels,packed),groups=new Map();
 for(const k of keys){if(!k.option)continue;const [index,option]=k.option.split(',').map(Number);const bounds=layoutBounds([k]),id=`${index}:${option}`,old=groups.get(id);groups.set(id,{x:Math.min(old?.x??Infinity,bounds.minX),y:Math.min(old?.y??Infinity,bounds.minY)})}
 return keys.flatMap(k=>{if(!k.option)return [k];const [index,option]=k.option.split(',').map(Number);if(option!==(choices[index]?.value??0))return [];const base=groups.get(`${index}:0`),current=groups.get(`${index}:${option}`);if(!base||!current)return [k];const dx=current.x-base.x,dy=current.y-base.y;return [{...k,x:k.x-dx,y:k.y-dy,rx:k.rx-dx,ry:k.ry-dy}]});
}

// KLE describes an ISO Enter as the union of two rectangles, as Vial does.
export function keyRectangles(k){
 const rects=[{x:k.x,y:k.y,w:k.w,h:k.h}];
 if((k.x2||0)!==0||(k.y2||0)!==0||(k.w2??k.w)!==k.w||(k.h2??k.h)!==k.h)
  rects.push({x:k.x+(k.x2||0),y:k.y+(k.y2||0),w:k.w2??k.w,h:k.h2??k.h});
 return rects;
}
export function keyShape(k,unit=51,gap=5){
 const rects=keyRectangles(k).map(q=>({x:(q.x-k.x)*unit,y:(q.y-k.y)*unit,w:q.w*unit-gap,h:q.h*unit-gap}));
 const xs=[...new Set(rects.flatMap(q=>[q.x,q.x+q.w]))].sort((a,b)=>a-b),ys=[...new Set(rects.flatMap(q=>[q.y,q.y+q.h]))].sort((a,b)=>a-b);
 const occupied=(i,j)=>i>=0&&j>=0&&i<xs.length-1&&j<ys.length-1&&rects.some(q=>(xs[i]+xs[i+1])/2>q.x&&(xs[i]+xs[i+1])/2<q.x+q.w&&(ys[j]+ys[j+1])/2>q.y&&(ys[j]+ys[j+1])/2<q.y+q.h);
 const edges=[];
 for(let i=0;i<xs.length-1;i++)for(let j=0;j<ys.length-1;j++)if(occupied(i,j)){
  if(!occupied(i,j-1))edges.push([[xs[i],ys[j]],[xs[i+1],ys[j]]]);
  if(!occupied(i+1,j))edges.push([[xs[i+1],ys[j]],[xs[i+1],ys[j+1]]]);
  if(!occupied(i,j+1))edges.push([[xs[i+1],ys[j+1]],[xs[i],ys[j+1]]]);
  if(!occupied(i-1,j))edges.push([[xs[i],ys[j+1]],[xs[i],ys[j]]]);
 }
 // Trace the union boundary before rounding, so overlapping rectangles have no seams.
 const paths=[],same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 while(edges.length){
  const first=edges.shift(),points=[first[0]];let end=first[1];
  while(!same(end,points[0])){
   points.push(end);const next=edges.findIndex(e=>same(e[0],end));
   if(next<0)throw Error('Invalid key outline');end=edges.splice(next,1)[0][1];
  }
  const corners=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];return (p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0])});
  const rounded=corners.map((p,i)=>{
   const a=corners[(i+corners.length-1)%corners.length],b=corners[(i+1)%corners.length];
   const before=Math.hypot(a[0]-p[0],a[1]-p[1]),after=Math.hypot(b[0]-p[0],b[1]-p[1]),radius=Math.min(7,before/2,after/2);
   return {p,start:[p[0]+(a[0]-p[0])*radius/before,p[1]+(a[1]-p[1])*radius/before],end:[p[0]+(b[0]-p[0])*radius/after,p[1]+(b[1]-p[1])*radius/after]};
  });
  paths.push(rounded.map((c,i)=>`${i?'L':'M'}${c.start}Q${c.p} ${c.end}`).join(' ')+'Z');
 }
 const fill=paths.join(' ');
 return {fill,outline:fill,compound:rects.length>1};
}

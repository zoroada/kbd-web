// SPDX-License-Identifier: GPL-2.0-or-later
export function matrixKeyDown(data,rows,cols,row,col){
 const width=Math.ceil(cols/8);
 if(data.length<2+rows*width)throw Error('矩阵响应长度不足');
 if(row<0||row>=rows||col<0||col>=cols)return false;
 return !!(data[2+row*width+width-1-Math.floor(col/8)]&(1<<(col%8)));
}
export function updateMatrixKeys(elements,data,rows,cols,tested){
 for(const key of elements){const [row,col]=key.dataset.coord.split(',').map(Number);const down=matrixKeyDown(data,rows,cols,row,col);
  if(down)tested.add(key.dataset.coord);
  key.classList.toggle('tested',tested.has(key.dataset.coord));key.classList.toggle('pressed',down);
 }
}

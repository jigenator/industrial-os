import test from 'node:test';import assert from 'node:assert/strict';
import {ambientField} from '../elements/ambient-field/ambient-field.mjs';
import {span,lineWidth,resolveColor} from '../foundation/cells.mjs';
import {hash} from '../foundation/seeded.mjs';
import {ambientLoad,ambientLoadDuration} from './ambient-load.mjs';
const field=(w,h)=>ambientField(Array.from({length:h},()=>[span(' '.repeat(w))]));
const expand=lines=>lines.map(line=>line.flatMap(s=>Array.from(s.text).map(ch=>({ch,...s.style}))));
// Independent literal v20 oracle, public-safe geometry only; no mockup imports or assets.
function oracle(w,h,t){
 const mix=(a,b,k)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-k)+parseInt(b.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('');
 const grid=Array.from({length:h},(_,y)=>Array.from({length:w},()=>({ch:' ',bg:mix('#000000','#1c1c1c',0.6*(1-y/Math.max(1,h-1))),fg:'#cfcfcf'})));
 const ink=(y,k)=>mix(grid[y][0].bg,'#ffffff',k),p=(start,dur)=>Math.max(0,Math.min(1,(t-start)/dur));
 const sweep=(t%16000)/4000,band=sweep<1?Math.round(sweep*(h+6))-3:-99;
 for(let y=1;y<h;y++)for(let x=0;x<w;x++){
  const gx=x>=4&&(x-4)%8===0,gy=y>=3&&(y-3)%4===0,col=Math.floor((x-4)/8),row=Math.floor((y-3)/4);
  const v=gx&&p(30*col,500)*h>y,hor=gy&&p(60*row,500)*w>x,lift=Math.max(0,1-Math.abs(y-band)/3)*0.05;
  if(v||hor){grid[y][x].ch=v&&hor?'┼':v?'│':'─';grid[y][x].fg=ink(y,0.045+lift);}
  else if(y%2===0&&(x+(y%4?2:0))%4===0){const k=p(500+hash(x,y,5)*500,300);if(k>0){grid[y][x].ch='·';grid[y][x].fg=ink(y,(0.11+lift)*k);}}
 }
 const scramble='▓▒░#%&*+=<>/\\|ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
 [[3,11],[1,12],[10,9],[13,6]].forEach(([gc,gr],n)=>{
  const x=4+gc*8,y=3+gr*4,start=700+60*n,label=`${'ABCDEFGHJKLMN'[gr]}${String(gc+1).padStart(2,'0')}`;
  if(t<start||y+2>=h||x-2<0||x+6>=w)return;
  const put=(x,y,ch)=>Object.assign(grid[y][x],{ch,fg:ink(y,0.2)}),arm=Math.min(2,Math.floor((t-start)/60));
  put(x,y,'┼');for(let d=1;d<=arm;d++){put(x-d,y,'─');put(x+d,y,'─');}if(arm>=1){put(x,y-1,'│');put(x,y+1,'│');}
  Array.from(label).forEach((ch,i)=>{const r=hash(i,200+n,17),dt=t-start-150;let glyph=ch;if(dt<0)glyph=' ';else if(dt<r*300)glyph=dt>=r*300*0.35?scramble[Math.floor(hash(Math.floor(t/70),i,201+n)*scramble.length)]:' ';put(x+2+i,y+1,glyph);});
 });return grid;
}
test('exact v20 grid reach, staggered dots, registration arms/decode and initial sweep',()=>{
 const input=field(118,54),original=structuredClone(input);
 for(const t of [0,50,180,300,500,650,700,760,850,900,1020,1100,1200,1330,1700,2500,3999,4000]){
  const got=expand(ambientLoad(input,{time:t})),expected=oracle(118,54,t);
  for(let y=0;y<54;y++)for(let x=0;x<118;x++){assert.equal(got[y][x].ch,expected[y][x].ch,`glyph ${t}/${x}/${y}`);assert.equal(resolveColor(got[y][x].bg),expected[y][x].bg);if(got[y][x].ch!==' ')assert.equal(resolveColor(got[y][x].fg),expected[y][x].fg,`ink ${t}/${x}/${y}`);}
 }
 assert.deepEqual(input,original);assert.equal(ambientLoadDuration(input),4000);
});
test('ambient load is bounded, motion-off/complete settled, state cells and regions protected',()=>{
 const input=field(40,16);input[3][4]=span('┼',{fg:'critical'});
 assert.deepEqual(ambientLoad(input,{animate:false}),input);assert.deepEqual(ambientLoad(input,{time:ambientLoadDuration(input)}),input);
 const out=expand(ambientLoad(input,{time:0,region:{left:4,top:3,rows:1,cols:1}}));assert.equal(out[3][4].fg,'critical');assert.equal(out[7][4].ch,'┼');assert.throws(()=>ambientLoad(input,{time:-1}));assert.throws(()=>ambientLoad(input,{time:0,unknown:true}));
 for(let width=1;width<=160;width++){const lines=ambientLoad(field(width,12),{time:500});for(const line of lines)assert.equal(lineWidth(line),width);}
});

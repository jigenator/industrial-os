import { resolveColor } from './cells.mjs';

// One canonical geometry for the static field and its load projection.
export const AMBIENT_GRID = Object.freeze({
  pitchX: 8, pitchY: 4, offsetX: 4, offsetY: 3,
  gridLift: 0.045, dotLift: 0.11, markLift: 0.2,
  gridRun: 500, columnLag: 30, rowLag: 60,
  dotStart: 500, dotSpread: 500, dotRun: 300,
  markStart: 700, markLag: 60, armStep: 60, labelLag: 150, labelRun: 300, sweepPeriod: 16000, sweepRun: 4000,
});
export const AMBIENT_MARKS = Object.freeze([[3,11],[1,12],[10,9],[13,6]].map(([column,row], index) => Object.freeze({
  x: AMBIENT_GRID.offsetX + column * AMBIENT_GRID.pitchX,
  y: AMBIENT_GRID.offsetY + row * AMBIENT_GRID.pitchY,
  label: `${'ABCDEFGHJKLMN'[row]}${String(column+1).padStart(2,'0')}`,
  start: AMBIENT_GRID.markStart + index * AMBIENT_GRID.markLag,
  seed: 200 + index,
})));
export function ambientPosition(x, y) {
  if (![x,y].every(Number.isInteger)) throw new RangeError('ambient coordinates must be integers');
  return {
    gx: x >= AMBIENT_GRID.offsetX && (x-AMBIENT_GRID.offsetX)%AMBIENT_GRID.pitchX===0,
    gy: y >= AMBIENT_GRID.offsetY && (y-AMBIENT_GRID.offsetY)%AMBIENT_GRID.pitchY===0,
    column: Math.floor((x-AMBIENT_GRID.offsetX)/AMBIENT_GRID.pitchX),
    row: Math.floor((y-AMBIENT_GRID.offsetY)/AMBIENT_GRID.pitchY),
    dot: y%2===0 && (x+(y%4?2:0))%4===0,
  };
}
export function ambientInk(background, proportion) {
  const bg=resolveColor(background);
  if(typeof proportion!=='number'||!Number.isFinite(proportion)||proportion<0||proportion>1)throw new RangeError('ambient lift must be 0–1');
  return '#'+[1,3,5].map(i=>Math.round(parseInt(bg.slice(i,i+2),16)*(1-proportion)+255*proportion).toString(16).padStart(2,'0')).join('');
}

export function ambientSweepLift(row,height,time,period=AMBIENT_GRID.sweepPeriod,run=AMBIENT_GRID.sweepRun) {
  if(!Number.isInteger(height)||height<1||height>1000||!Number.isInteger(row)||row<0||row>=height||!Number.isFinite(time)||time<0||!Number.isFinite(period)||period<=0||!Number.isFinite(run)||run<=0||run>period)throw new RangeError('invalid ambient sweep frame');
  const phase=(time%period)/run,band=phase<1?Math.round(phase*(height+6))-3:-99;
  return Math.max(0,1-Math.abs(row-band)/3)*0.05;
}
export function ambientRegistrations(lines) {
  const cells=lines.map(line=>line.flatMap(s=>Array.from(s.text)));
  return AMBIENT_MARKS.filter(mark=>cells[mark.y]?.[mark.x]==='┼'&&Array.from(mark.label).every((ch,i)=>cells[mark.y+1]?.[mark.x+2+i]===ch));
}

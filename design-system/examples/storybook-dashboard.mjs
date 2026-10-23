import { typeUnit } from '../elements/type-unit/type-unit.mjs';
import { activityStrip } from '../elements/activity-strip/activity-strip.mjs';
import { planCounter } from '../elements/plan-counter/plan-counter.mjs';
import { activityTrace } from '../elements/activity-trace/activity-trace.mjs';
import { alertTicker } from '../elements/alert-ticker/alert-ticker.mjs';
import { ambientField } from '../elements/ambient-field/ambient-field.mjs';
import { call } from './storybook-usage.mjs';
const blocks = Array.from({length:21},(_,i)=>({start:new Date(172800000+i*28800000).toISOString(),you:i%4,agents:i%6,future:i>19}));
const element = (id, render, variants) => ({id, kind:'component', title:id.replaceAll('-',' ').toUpperCase(), summary:'Supplied dashboard fixture, never live data.', module:`elements/${id}/${id}.mjs`,contract:`elements/${id}/README.md`,rules:['Inputs are fixtures. Unknown is never zero.','Pure foundation lines; hosts own input and motion.'],variants,specimen(v,width){const options={width};return {lines:render(v.input,options),calls:[call(render.name,v.input,options)],facts:[]};}});
export const DASHBOARD_STORIES = [
 element('type-unit',typeUnit,[...['type.pr','type.todo','type.linear','type.msg','type.email'].map(color=>({name:color.slice(5).toUpperCase(),note:'Source identity color, not urgency.',input:{label:'EXAMPLE UNIT',color,state:'ok',total:6,waiting:2,fresh:3,remaining:0.5,age:'1d',limit:'3d'}})),...['planned','stale','auth','error','config_error','disabled','loading','unknown'].map(state=>({name:({planned:'WIP',config_error:'CFG',disabled:'OFF',loading:'LOAD',unknown:'UNK',error:'ERR'})[state] ?? state.toUpperCase(),note:'Explicit source health.',input:{label:'EXAMPLE UNIT',state,total:null}}))]),
 element('activity-strip',activityStrip,[{name:'WEEK',note:'21 eight-hour fixture blocks.',input:{blocks,total:{you:10,agents:12},previous:{you:12,agents:16}}}]),
 element('plan-counter',planCounter,[{name:'COUNTS',note:'null means unknown.',input:{today:4,inbox:null,later:0}}]),
 element('activity-trace',activityTrace,[{name:'FLAT',note:'No observations, no invented activity.',input:[]},{name:'OBSERVED',note:'Demonstration observations.',input:[0,1,2,3,2,0]}]),
 element('alert-ticker',alertTicker,[{name:'EMPTY',note:'v1 has no alerts.',input:[]}]),
 {...element('ambient-field',ambientField,[{name:'FIELD',note:'Blank space only.',input:null}]),specimen(v,width){const input=Array.from({length:14},()=>[{text:' '.repeat(width),style:{}}]);return {lines:ambientField(input),calls:[call('ambientField',input)],facts:[]};}},
];

import { DASHBOARD_INKS } from './dashboard-colors.mjs';

// Source identity, never health or urgency. Unknown names stay neutral.
export const TYPE_COLORS = Object.freeze({
  'type.pr': '#7533ff',
  'type.todo': DASHBOARD_INKS.bone,
  'type.linear': '#5e6ad2',
  'type.msg': '#00a3a6',
  'type.email': '#dec093',
});
export function typeColor(token) {
  return typeof token === 'string' && Object.hasOwn(TYPE_COLORS, token) ? TYPE_COLORS[token] : DASHBOARD_INKS.bone;
}

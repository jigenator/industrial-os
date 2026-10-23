import { PI_CHROME } from './signal-colors.mjs';

// Source identity, never health or urgency. Unknown names stay neutral.
export const TYPE_COLORS = Object.freeze({
  'type.pr': '#7533ff',
  'type.todo': PI_CHROME.bone,
  'type.linear': '#5e6ad2',
  'type.msg': '#00a3a6',
  'type.email': '#dec093',
});
export function typeColor(token) {
  return typeof token === 'string' && Object.hasOwn(TYPE_COLORS, token) ? TYPE_COLORS[token] : PI_CHROME.bone;
}

import { ACID_BLACK } from './palette.mjs';
import { SIGNAL_COLORS, mixOver } from './signal-colors.mjs';

// Source identity, never health. Neutral is the secondary ink with the same used/mid mix rule.
export const USAGE_NEUTRAL = Object.freeze({ lit: ACID_BLACK.secondary, used: mixOver('secondary', 0.2), mid: mixOver('secondary', 0.5) });
export const USAGE_COLORS = Object.freeze(Object.fromEntries(['gpt', 'cld', 'kmi'].map((id) => [
  `usage.${id}`, Object.freeze({ lit: SIGNAL_COLORS[id], used: SIGNAL_COLORS[`${id}Used`], mid: SIGNAL_COLORS[`${id}Mid`] }),
])));
export function usageColors(token) {
  return typeof token === 'string' && Object.hasOwn(USAGE_COLORS, token) ? USAGE_COLORS[token] : USAGE_NEUTRAL;
}

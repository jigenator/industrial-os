// Storybook catalog: every element with named state variants, every motion with named examples (and one
// composed motion example), then the foundation's color data as stories with named views. Pure and I/O-free.
// Every specimen comes from the real renderer, motion, or foundation data; the usage text is built from the
// same arguments that drew it, so what the storybook shows is what the call returns. Element and motion
// values are labeled demonstration fixtures.
import { ELEMENT_STORIES } from './storybook-elements.mjs';
import { MOTION_STORIES } from './storybook-motions.mjs';
import { COLOR_STORY, SIGNAL_STORY } from './storybook-colors.mjs';
import { literal } from './storybook-usage.mjs';

export const STORIES = Object.freeze([...ELEMENT_STORIES, ...MOTION_STORIES, COLOR_STORY, SIGNAL_STORY]);

// A motion preview is only worth running when its frames differ in the current color mode. Motions that
// change only color (scan, pulse, the dim reveal, and others) would redraw identical plain text.
export function canPlay(story, variant, mode) {
  return story.kind === 'motion' && (mode === 'TRUECOLOR' || variant.plainVisible === true);
}

// Parameter rows for a motion example: each option's value here and its exported default. A region the
// example finds in its rendered body is shown as such.
export function motionParameters(story, variant) {
  const { defaults, units } = story.motion;
  return Object.keys(defaults).map((name) => {
    const unit = units[name] ? ` ${units[name]}` : '';
    const fromBody = name === 'region' && variant.region !== undefined;
    const value = fromBody ? 'from the body' : `${literal(variant.options[name] ?? defaults[name])}${unit}`;
    return { name, value, defaultValue: `${literal(defaults[name])}${unit}`, set: fromBody || Object.hasOwn(variant.options, name) };
  });
}

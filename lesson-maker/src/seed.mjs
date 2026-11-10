import { readFileSync } from 'node:fs';
import { fromDoc } from './lesson.mjs';
import { validatePng } from './png.mjs';
// The slide types and layouts the schema allows, in the order the form shows them.
export const TYPES = [
  'Initial question',
  'First principle',
  'Worked example',
  'Learner practice',
  'Feedback',
  'Transfer / recap',
  'Section title',
];
export const LAYOUTS = ['points-image', 'image-sentence', 'title', 'title-image', 'statement', 'before-after'];
export const LAYOUT_NAMES = [
  'Points + image',
  'Image + sentence',
  'Title',
  'Title + image',
  'Statement',
  'Before / after',
];
// The bundled example lesson (the browser-caching lesson from wireframe v19): the --plain snapshot and the
// tests' fixture.
export const EXAMPLE_PATH = new URL('../examples/browser-caching.lesson.json', import.meta.url);
const example = JSON.parse(readFileSync(EXAMPLE_PATH, 'utf8'));
export const exampleDoc = () => structuredClone(example);
// The example's pictures are loaded with it, so a snapshot or test shows them without reading files itself.
export function seed() {
  const lesson = fromDoc(exampleDoc());
  for (const byField of Object.values(lesson.pictures))
    for (const p of Object.values(byField)) {
      const bytes = readFileSync(new URL('../examples/' + p.file, import.meta.url));
      Object.assign(p, { bytes, ...validatePng(bytes), name: p.file.split('/').pop() });
    }
  return lesson;
}

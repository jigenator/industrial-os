// IndustrialOS colors: a reference collection kept apart from Acid / Black. Ramp contract: README.md.
export const INDUSTRIALOS_COLORS = Object.freeze([
  { id: 'acid-lime', name: 'Acid lime', hex: '#C0FE04', family: 'lime', role: 'Primary accent, call to action and focus' },
  { id: 'acid-lime-link', name: 'Acid link on dark', hex: '#E5FF45', family: 'lime', role: 'Link on dark backgrounds' },
  { id: 'acid-lime-pale', name: 'Acid highlight text', hex: '#EAFC88', family: 'lime', role: 'Accent text on dark backgrounds' },
  { id: 'signal-red', name: 'Signal red', hex: '#F24723', family: 'red-orange', role: 'Error and critical emphasis' },
  { id: 'signal-orange', name: 'Signal orange', hex: '#FF5C00', family: 'orange', role: 'Alternate error emphasis' },
  { id: 'violet', name: 'Violet', hex: '#5200FF', family: 'violet', role: 'Saturated accent and chrome' },
  { id: 'indigo', name: 'Indigo', hex: '#3F01FB', family: 'indigo', role: 'Secondary accent and list bullets' },
  { id: 'link-blue', name: 'Light-background link blue', hex: '#0000F8', family: 'blue', role: 'Link on light backgrounds' },
  { id: 'field-black', name: 'Field black', hex: '#000000', family: 'neutral', role: 'Main background' },
  { id: 'input-black', name: 'Input black', hex: '#0E0E0E', family: 'neutral', role: 'Input and option background' },
  { id: 'surface-grey', name: 'Surface', hex: '#1C1C1C', family: 'neutral', role: 'Raised surface and panel' },
  { id: 'input-hover-grey', name: 'Input hover', hex: '#1F1F1F', family: 'neutral', role: 'Input and option hover' },
  { id: 'structure-grey', name: 'Structure', hex: '#555555', family: 'neutral', role: 'Scrollbar thumb and decorative tick marks' },
  { id: 'muted-grey', name: 'Muted text', hex: '#717171', family: 'neutral', role: 'Muted foreground and decorative strokes' },
  { id: 'light-paper', name: 'Light section', hex: '#F6F6F6', family: 'neutral', role: 'Light section background' },
  { id: 'paper-white', name: 'White', hex: '#FFFFFF', family: 'neutral', role: 'Primary foreground' },
  { id: 'magenta', name: 'Magenta', hex: '#FF15BD', family: 'magenta', role: 'Accent fill' },
  { id: 'lavender', name: 'Lavender', hex: '#9C84F5', family: 'violet', role: 'Accent fill' },
  { id: 'steel-blue', name: 'Steel blue', hex: '#48617F', family: 'blue', role: 'Body fill and corner marks' },
  { id: 'pale-blue', name: 'Pale ice blue', hex: '#95B8D1', family: 'blue', role: 'Small accent marks' },
  { id: 'yellow', name: 'Yellow', hex: '#F8ED34', family: 'yellow', role: 'Center tile accent' },
  { id: 'mint', name: 'Mint green', hex: '#8DF3BC', family: 'mint', role: 'Badge accent' },
].map(Object.freeze));

// Mix encoded 8-bit sRGB channels, not linear-light or perceptually uniform values.
export function shadeRamp(hex) {
  if (typeof hex !== 'string' || hex.length !== 7 || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new TypeError('shadeRamp hex must be an exact #RRGGBB string');
  }
  const base = hex.toUpperCase();
  const channels = [1, 3, 5].map((offset) => parseInt(base.slice(offset, offset + 2), 16));
  const mix = (target, proportion) => '#' + channels.map((channel) =>
    Math.round(channel * (1 - proportion) + target * proportion).toString(16).padStart(2, '0'),
  ).join('').toUpperCase();
  return Object.freeze([
    { id: 'dark-75', label: 'BLACK 75%', kind: 'derived', hex: mix(0, 0.75) },
    { id: 'dark-40', label: 'BLACK 40%', kind: 'derived', hex: mix(0, 0.4) },
    { id: 'base', label: 'BASE', kind: 'base', hex: base },
    { id: 'light-40', label: 'WHITE 40%', kind: 'derived', hex: mix(255, 0.4) },
    { id: 'light-75', label: 'WHITE 75%', kind: 'derived', hex: mix(255, 0.75) },
  ].map(Object.freeze));
}

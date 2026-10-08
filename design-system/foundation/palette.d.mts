export const ACID_BLACK: Readonly<{
  field: '#000000'; surface: '#1c1c1c'; primary: '#ffffff'; secondary: '#cfcfcf';
  accent: '#c0fe04'; decorative: '#717171'; structural: '#555555'; warning: '#d79e52'; critical: '#f24723';
}>;
export type PaletteRole = keyof typeof ACID_BLACK;

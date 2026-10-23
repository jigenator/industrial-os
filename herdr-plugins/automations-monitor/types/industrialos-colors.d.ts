// The design system ships colocated .d.mts declarations for the subpaths other TypeScript consumers use,
// but not yet for foundation/industrialos-colors. This declares only what the monitor reads from it; the
// values stay in the design system. Remove this file once the package declares the subpath itself.
declare module '@industrial-os/design-system/foundation/industrialos-colors' {
  export const INDUSTRIALOS_COLORS: ReadonlyArray<Readonly<{ id: string; name: string; hex: `#${string}`; family: string; role: string }>>;
}

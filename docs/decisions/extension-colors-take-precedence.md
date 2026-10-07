# The Pi extensions' colors take precedence over the design-system palette

Status: superseded on 2026-10-07 by [the design system as an in-repo package that owns the colors](in-repo-design-system-package.md). The design system is now the source of every color; the extensions mirror it until they migrate. This record is kept as history.
Date/evidence: 2026-10-07, stated by the maintainer. pi-status-bar, then in its own repository and since moved to `pi/status-bar/`, is the first implementation of the Industrial OS visual style and its design doc already listed its palette as the reference; claude-interrupt declares the same acid, black, white, grey, and dark-grey values as constants in `src/index.ts`; `design-system/foundation/palette.mjs` lists nine roles with the same values.
Supersedes / superseded by: superseded by [in-repo design-system package](in-repo-design-system-package.md).

## Problem

The same colors exist in three places with no import between them. When they disagree, something has to be the authority. The design system is a reference kit that was written after the status bar and models it; its palette is the derived copy, not the source.

## Choice and alternatives

**Chosen:** the Pi extensions are the authority. pi-status-bar is the reference implementation of the style; claude-interrupt shares its values. When a value differs, the extension's value is correct, `design-system/foundation/palette.mjs` changes to match in its own commit with its own checks, and the design doc changes only if a role's meaning changes.

**Rejected: the design-system palette as the single source.** It would be the natural single source of truth for a library, but no extension imports it, the Pi host installs an extension from its own folder, and the style was settled in the status bar first. Making the copy the authority would invert the real flow of decisions.

**Rejected: an import or generated file.** Nothing can be imported between projects today; see [standalone packages](standalone-packages.md). A generated file needs a generator and a check, which no value change has yet justified.

## Consequences and verification

- `docs/design.md` lists the roles, names the extensions as the authority, and points to `palette.mjs` as the readable mirror of every value; it does not hold a third copy of the values.
- Each extension declares its colors as named constants in one place.
- The design system's `palette.mjs` is a mirror; its tests check its own consistency, not agreement with the extensions.
- The same rule covers status-bar's colors beyond the nine roles. `design-system/foundation/signal-colors.mjs` mirrors them as literal values, not new roles; status-bar's `C` palette is their authority, and the same review comparison applies.
- Verification is a review comparison of each extension's constants against `palette.mjs`, using the design doc only to map a constant to its role. No automated comparison exists.

## Revisit when

A palette value changes for the first time after pi-status-bar's move into `pi/status-bar/`. That change will show whether three hand-kept copies are tolerable or whether a tested comparison or a generated file is worth its cost.

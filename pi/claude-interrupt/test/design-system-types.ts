// Compile-only declaration contract, checked by npm run typecheck (not a runtime test).
import { resolveColor, resolveStyle, span, type Style } from "@industrial-os/design-system/foundation/cells";
import { markerPlate } from "@industrial-os/design-system/elements/transcript-marker";
import { flash } from "@industrial-os/design-system/motions/flash";
import { ping } from "@industrial-os/design-system/motions/ping";
import { wipe } from "@industrial-os/design-system/motions/wipe";

const concrete: `#${string}` = resolveColor("accent");
const transparent: Style = { fg: concrete, bg: "default", bold: true };
const line = markerPlate("outline", { background: "default", outputPad: 0 });
resolveStyle(transparent);
flash([line], { time: 80, outlineBackground: "default" });
ping([line], { time: 160, offStyle: transparent });
wipe([line], { time: 2800, fromStyle: transparent });
// @ts-expect-error only palette roles, RGB strings and explicit defaults are styles
span("A", { fg: "not-a-role" });
// @ts-expect-error bold is boolean, never a string
span("A", { bold: "true" });
// @ts-expect-error unknown motion options must not typecheck
flash([line], { time: 0, interval: 80 });
// @ts-expect-error plate states are explicit
markerPlate("settled");

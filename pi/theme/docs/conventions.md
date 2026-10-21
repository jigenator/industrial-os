# Engineering conventions

Follow [root conventions](../../../docs/conventions.md) and the [Pi guide](../../AGENTS.md).

- **Variables are design-system keys.** A variable's name is the key it has in `ACID_BLACK`, `SIGNAL_COLORS` or `PI_CHROME`, and its value is that key's lowercase `#rrggbb`; a name that is in two of them is rejected as ambiguous. Check: `test/theme.test.mjs`.
- **Tokens name variables.** No literal color, OKHSL value, index or terminal default appears under `colors` or `export`, so every value traces to the design system. Check: `test/theme.test.mjs`.
- **Pin what the design decides, not every token.** The check pins the bone border, acid's six tokens and the state roles; other tokens may change with a design update. Check: the pinned token tests.
- **Use Pi's own validator.** Do not restate Pi's schema in the check. Check: `test/theme.test.mjs` imports it from the installed host.

## Adoption gaps

| Gap | Evidence | Next change and check |
| --- | --- | --- |
| The check reaches Pi by internal paths | Pi 1.3.0 exports no theme validator | Switch to a public export if Pi adds one |
| No automated installed-Pi load check | Pi's RPC mode does not load themes | The interactive check in [contributing](../CONTRIBUTING.md#full-validation-sequence) |
| No 256-color or light-terminal check | Truecolor in Herdr only | An authorized check in those terminals |

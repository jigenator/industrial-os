// Preloaded by the golden harness into the monitor and the fake tatsu: `Date.now()` and `new Date()` return
// GOLDEN_NOW, so a frame does not depend on when it is drawn. Dates built from a value, and timers, are unchanged.
const fixed = Number(process.env.GOLDEN_NOW);
if (!Number.isInteger(fixed)) throw new Error('GOLDEN_NOW must be epoch milliseconds');

globalThis.Date = new Proxy(Date, {
  construct: (RealDate, args: unknown[]) => (args.length ? Reflect.construct(RealDate, args) : new RealDate(fixed)),
  get: (RealDate, key, receiver) => (key === 'now' ? () => fixed : Reflect.get(RealDate, key, receiver)),
});

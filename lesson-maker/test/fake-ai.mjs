// A stand-in for the Pi bridge: each request waits until the test answers it.
export function fakeAi() {
  const calls = [];
  const wait = (kind, request) =>
    new Promise((resolve, reject) => {
      const call = { kind, ...request, done: false };
      call.answer = (value) => {
        call.done = true;
        // A run may answer with just its text, or with its text and context use.
        resolve(kind === 'run' && typeof value === 'string' ? { text: value } : value);
      };
      call.fail = (error) => {
        call.done = true;
        reject(error);
      };
      request.signal?.addEventListener('abort', () => call.fail(Error('Stopped')), { once: true });
      calls.push(call);
    });
  return {
    models: [
      { key: 'test/fast', provider: 'test', id: 'fast', name: 'Fast' },
      { key: 'test/careful', provider: 'test', id: 'careful', name: 'Careful' },
    ],
    defaultModel: 'test/fast',
    imagegen: true,
    // No aim check unless a test sets one.
    judge: null,
    calls,
    open: () => calls.filter((c) => !c.done),
    run: (request) => wait('run', request),
    generateImage: (request) => wait('image', request),
    dispose() {},
  };
}
// Lets answered requests finish: their promise chains run on the microtask and immediate queues.
export async function settle() {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
}
// For real file reads and writes, which can take longer than a few turns while other test files run.
export async function until(check, ms = 2000) {
  for (const end = Date.now() + ms; !check() && Date.now() < end;) await new Promise((r) => setTimeout(r, 5));
}
// Marks the state connected to the fake bridge and hands the bridge to the scheduler.
export function connect(s, jobs, ai = fakeAi()) {
  Object.assign(s.ai, { status: 'ready', models: ai.models, model: ai.defaultModel, imagegen: true });
  jobs.connect(ai);
  return ai;
}

// The bridge to the locally installed Pi: its models, logins and the imagegen extension. Pi is loaded at run time
// from the `pi` on PATH (or LESSON_MAKER_PI, a package folder), so this project keeps no dependency of its own.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACKAGE = '@earendil-works/pi-coding-agent';
// The skill behind the Xiaohei picture style.
export const XIAOHEI_SKILL = 'ian-xiaohei-illustrations';
// Pi's built-in tools that only read: never write, edit or bash.
const READ_ONLY_TOOLS = ['read', 'ls', 'find', 'grep'];
// Requests think at this level, not Pi's default: at high, gemini-3.8-flash took over 80 s exploring folders on a
// request that needed no files; at low it made the change in 13 s.
// What each effort asks imagegen for; low leaves imagegen's own defaults.
const IMAGE_EFFORT = {
  low: {},
  medium: { thinking: 'medium', quality: 'medium' },
  high: { thinking: 'high', quality: 'high' },
};

// Which imagegen backend pictures use, from LESSON_MAKER_IMAGE_BACKEND: unset or subscription is imagegen's own
// default (the ChatGPT/Codex login, so no backend is sent); api is the OpenAI Images API, billed per image, which
// imagegen calls with OPENAI_API_KEY from this process's environment. Only the key's presence is checked here; its
// value is never read or shown. Anything else throws, so a typo cannot fall back to the subscription.
export function imageBackend(env = process.env) {
  const value = env.LESSON_MAKER_IMAGE_BACKEND;
  if (value === undefined || value === 'subscription') return {};
  if (value !== 'api') throw Error(`LESSON_MAKER_IMAGE_BACKEND must be subscription or api, not "${value}"`);
  if (!env.OPENAI_API_KEY) throw Error('LESSON_MAKER_IMAGE_BACKEND=api needs OPENAI_API_KEY in the environment');
  return { backend: 'api' };
}
// What imagegen is asked for one picture; backend is imageBackend's answer. 1536x1024 suits both backends.
export const imagegenParams = ({ prompt, outputPath, effort = 'low' }, backend = {}) => ({
  prompt,
  outputPath,
  outputFormat: 'png',
  size: '1536x1024',
  background: 'opaque',
  ...IMAGE_EFFORT[effort],
  ...backend,
});

export function findPi(env = process.env) {
  const named = (dir) => {
    try {
      return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name === PACKAGE;
    } catch {
      return false;
    }
  };
  if (env.LESSON_MAKER_PI) return named(env.LESSON_MAKER_PI) ? env.LESSON_MAKER_PI : null;
  for (const dir of (env.PATH || '').split(delimiter)) {
    const bin = join(dir, 'pi');
    if (!dir || !existsSync(bin)) continue;
    for (let at = dirname(realpathSync(bin)); at !== dirname(at); at = dirname(at)) if (named(at)) return at;
  }
  return null;
}

// The lesson agents' standing instructions; each request adds its own task, the lesson and the chat.
export const SYSTEM_PROMPT = [
  'You work inside Lesson Maker, a terminal app for writing slide lessons. A lesson has a lesson plan (outcomes,',
  'prerequisites, teaching principles and progression) and sections of slides, optionally split into subsections.',
  'Agents write lessons and people edit on top of them.',
  'Follow the lesson plan: every slide serves a step of the progression and obeys the teaching principles.',
  'Write plain text: no Markdown emphasis or headings. New lines are fine; list points one per line, each may start',
  'with "- ". When you mention a slide, use its position and title, such as Slide 6 "Trusting a copy for one',
  'hour", never its id. Keep replies short.',
].join(' ');

// Pi's own extensions would add their prompts and tools to every lesson edit, so only three kinds load: those that
// register model providers (so every model Pi offers is available), and the ones that register imagegen and
// TypeSafe's typesafe_evaluate (for the aim check). Each session lists only the tools it uses.
const wanted = (base) => {
  const runtime = base.runtime,
    providers = new Set(
      [...(runtime.pendingProviderRegistrations || []), ...(runtime.pendingNativeProviderRegistrations || [])].map(
        (r) => r.extensionPath,
      ),
    );
  return base.extensions.filter(
    (e) =>
      providers.has(e.path) ||
      providers.has(e.resolvedPath) ||
      e.tools.has('imagegen') ||
      e.tools.has('typesafe_evaluate'),
  );
};

export async function connectPi({ cwd, env = process.env } = {}) {
  const backend = imageBackend(env),
    root = findPi(env);
  if (!root) throw Error('Pi was not found on PATH; install Pi or set LESSON_MAKER_PI to its package folder');
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')),
    entry = manifest.exports?.['.']?.import || manifest.main;
  const pi = await import(pathToFileURL(join(root, entry)).href);
  const agentDir = pi.getAgentDir();
  // The operator asked for a Jev aim check before every send, which is the operator opt-in pi-typesafe's tool requires;
  // this process alone, and only the aim check's sessions get the tool.
  process.env.PI_TYPESAFE_ENABLED = '1';
  const options = {
    cwd,
    agentDir,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
    systemPrompt: SYSTEM_PROMPT,
  };
  // The first load reads every installed extension once to find the wanted ones; later loads read only those. It
  // also finds the picture-style skill where Pi has it installed; no session lists skills in its prompt.
  let paths = [],
    skill = null;
  const first = new pi.DefaultResourceLoader({
    ...options,
    noSkills: false,
    skillsOverride(base) {
      skill = base.skills.find((x) => x.name === XIAOHEI_SKILL) || null;
      return { ...base, skills: [] };
    },
    extensionsOverride(base) {
      const extensions = wanted(base);
      paths = extensions.map((e) => e.path);
      return { ...base, extensions };
    },
  });
  await first.reload();
  const runtime = await pi.ModelRuntime.create();
  const settings = pi.SettingsManager.create(cwd, agentDir);
  // Each session gets its own loader: sessions sharing one share extension contexts, and disposing one session
  // leaves the others' extension tools (imagegen) stale.
  const open = async (session, loader) => {
    if (!loader) {
      loader = new pi.DefaultResourceLoader({ ...options, noExtensions: true, additionalExtensionPaths: paths });
      await loader.reload();
    }
    return pi.createAgentSession({
      cwd,
      agentDir,
      resourceLoader: loader,
      sessionManager: pi.SessionManager.inMemory(),
      settingsManager: settings,
      modelRuntime: runtime,
      ...session,
    });
  };
  // Providers that extensions add register when a session binds them, so the model list is read after this one.
  const { session: home } = await open({ tools: [] }, first);
  const available = await runtime.getAvailable();
  const models = available.map((m) => ({ key: `${m.provider}/${m.id}`, provider: m.provider, id: m.id, name: m.name }));
  const preferred = `${settings.getDefaultProvider?.()}/${settings.getDefaultModel?.()}`;
  const imagegen = first.getExtensions().extensions.some((e) => e.tools.has('imagegen'));
  const typesafe = first.getExtensions().extensions.some((e) => e.tools.has('typesafe_evaluate'));
  let calls = 0;

  return {
    models,
    defaultModel: models.some((m) => m.key === preferred) ? preferred : (models[0]?.key ?? null),
    imagegen: Boolean(imagegen),
    // The Xiaohei skill's folder and SKILL.md, or null when Pi does not have it.
    xiaohei: skill && { dir: skill.baseDir, file: skill.filePath },
    // One fresh session per request: requests run side by side and keep no hidden history between them.
    // onActivity hears what the model is doing, so the chat can say: { kind: 'thinking' }, { kind: 'writing', name,
    // count } while it writes a tool call's input, { kind: 'tool', name, args } and { kind: 'tool-done', name, args,
    // error } around each tool run. reading adds Pi's own read-only file tools (read, ls, find, grep), so the model
    // can look at reference files.
    async run({
      model,
      effort = 'low',
      prompt,
      tools = [],
      reading = false,
      signal,
      onText = () => {},
      onActivity = () => {},
    }) {
      const chosen = available.find((m) => `${m.provider}/${m.id}` === model);
      if (!chosen) throw Error(`Model ${model} is not available in Pi`);
      const { session } = await open({
        model: chosen,
        thinkingLevel: effort,
        tools: [...(reading ? READ_ONLY_TOOLS : []), ...tools.map((t) => t.name)],
        customTools: tools.map((t) => ({
          name: t.name,
          label: t.name,
          description: t.description,
          parameters: t.parameters,
          async execute(_id, params, toolSignal) {
            const text = await t.execute(params, toolSignal);
            return { content: [{ type: 'text', text }], details: {} };
          },
        })),
      });
      let last = null,
        text = '',
        writing = 0;
      const running = new Map();
      const stop = () => session.abort().catch(() => {});
      signal?.addEventListener('abort', stop, { once: true });
      const unsubscribe = session.subscribe((event) => {
        const update = event.type === 'message_update' ? event.assistantMessageEvent : null;
        if (update?.type === 'text_delta') {
          text += update.delta;
          onText(text);
        }
        if (update?.type === 'thinking_delta') onActivity({ kind: 'thinking' });
        if (update?.type === 'toolcall_start') writing = 0;
        if (update?.type === 'toolcall_delta')
          onActivity({
            kind: 'writing',
            name: update.partial?.content?.[update.contentIndex]?.name,
            count: (writing += update.delta.length),
          });
        if (event.type === 'tool_execution_start') {
          running.set(event.toolCallId, event.args);
          onActivity({ kind: 'tool', name: event.toolName, args: event.args });
        }
        // The end event carries no arguments, so they are kept from the start.
        if (event.type === 'tool_execution_end') {
          const args = running.get(event.toolCallId);
          running.delete(event.toolCallId);
          onActivity({ kind: 'tool-done', name: event.toolName, args, error: event.isError });
        }
        if (event.type === 'message_start' && event.message?.role === 'assistant') text = '';
        if (event.type === 'message_end' && event.message?.role === 'assistant') last = event.message;
      });
      try {
        if (signal?.aborted) throw Error('Stopped');
        await session.prompt(prompt);
        if (signal?.aborted) throw Error('Stopped');
        if (last?.stopReason === 'error') throw Error(last.errorMessage || 'The model returned an error');
        if (last?.stopReason === 'aborted') throw Error('Stopped');
        return { text: session.getLastAssistantText?.() ?? text, context: session.getContextUsage?.() ?? null };
      } finally {
        unsubscribe();
        signal?.removeEventListener('abort', stop);
        session.dispose();
      }
    },
    // The Google API key Pi has stored, for reading slides aloud (Pi has no speech models of its own), or null.
    async googleKey() {
      return (await runtime.getAuth('google').catch(() => null))?.auth?.apiKey || null;
    },
    // One TypeSafe (Jev) evaluation through pi-typesafe's tool, or null when Pi does not have it. Returns the
    // evaluation (answers keyed by question) or throws pi-typesafe's own message, which carries no key or state.
    judge: typesafe
      ? async ({ state, questions, signal }) => {
          const { session } = await open({ tools: ['typesafe_evaluate'] });
          try {
            const tool = session.agent.state.tools.find((t) => t.name === 'typesafe_evaluate');
            const result = await tool.execute(`lesson-maker-${++calls}`, { state, questions }, signal, undefined);
            if (!result?.details?.answers) throw Error('TypeSafe returned no answers');
            return result.details;
          } finally {
            session.dispose();
          }
        }
      : null,
    // Generates one PNG with imagegen at its saved default model and returns where it went and what made it.
    async generateImage({ prompt, outputPath, signal, effort = 'low' }) {
      if (!imagegen) throw Error('The imagegen extension is not installed in Pi');
      const { session } = await open({ tools: ['imagegen'] });
      try {
        const tool = session.agent.state.tools.find((t) => t.name === 'imagegen');
        const result = await tool.execute(
          `lesson-maker-${++calls}`,
          imagegenParams({ prompt, outputPath, effort }, backend),
          signal,
          undefined,
        );
        const details = result?.details;
        if (!details?.savedPath) {
          const message = result?.content?.find((c) => c.type === 'text')?.text;
          throw Error(message || 'imagegen returned no image');
        }
        return { file: details.savedPath, model: details.imageModel, prompt: details.prompt };
      } finally {
        session.dispose();
      }
    },
    dispose() {
      home.dispose();
    },
  };
}

// Reading reference documents for the lesson agents: HTML or Markdown from a file or an artifact, as plain text a
// page at a time, and the caller's own artifacts. Artifacts come through the artifact CLI named by
// LESSON_MAKER_ARTIFACT_CLI, never the network; without it artifacts are unavailable. Links are accepted only for
// LESSON_MAKER_ARTIFACT_HOST; a bare 12-character id always is.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

export const PAGE = 40000;
const artifactCli = () => process.env.LESSON_MAKER_ARTIFACT_CLI?.trim() || '';
const UNAVAILABLE = 'artifacts are unavailable: LESSON_MAKER_ARTIFACT_CLI is not set';
// An artifact id from a bare id or a link on the configured host (optionally /vN), else null.
function artifactId(source) {
  const host = process.env.LESSON_MAKER_ARTIFACT_HOST?.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const link = host ? `(?:https://${host}/)?` : '';
  return new RegExp(`^${link}([A-Za-z0-9]{12})(/v\\d+)?/?$`).exec(source.trim());
}
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };

// Text an agent can read: no scripts, styles, inline images or tags; one block per line, list items as "- ". Pages
// that build their slides in script keep that text in string literals, so readable ones are added after the page.
export function htmlText(html) {
  const scripts = [];
  for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi))
    for (const [literal] of body
      .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, '')
      .matchAll(/"(?:[^"\\\n]|\\.){12,}"/g)) {
      let value;
      try {
        value = markupText(JSON.parse(literal));
      } catch {
        continue;
      }
      // Words, not code, ids or file names.
      if (value.split(/\s+/).length >= 3 && /[a-z]{3}/i.test(value) && !/[{};]\s*$|=>|function\b/.test(value))
        scripts.push(value);
    }
  const page = markupText(html),
    extra = [...new Set(scripts)].filter((value) => !page.includes(value));
  return extra.length ? `${page}\n\n# Text in the page's scripts\n\n${extra.join('\n\n')}` : page;
}
function markupText(html) {
  return html
    .replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<img\b[^>]*?\balt\s*=\s*"([^"]*)"[^>]*>/gi, (_, alt) => (alt.trim() ? ` [image: ${alt.trim()}] ` : ' '))
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(h[1-6])\b[^>]*>/gi, '\n\n# ')
    .replace(
      /<\/?(p|div|section|article|header|footer|main|aside|h[1-6]|ul|ol|tr|table|blockquote|pre|br|hr)\b[^>]*>/gi,
      '\n',
    )
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) =>
      code[0] === '#'
        ? String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)))
        : (ENTITIES[code.toLowerCase()] ?? whole),
    )
    .replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, '[inline data]')
    .replace(/[ \t\f\v\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const run = (args) =>
  new Promise((done, fail) =>
    execFile(artifactCli(), args, { timeout: 330000, maxBuffer: 4 << 20 }, (error, stdout, stderr) => {
      if (!error) return done(stdout);
      let message = stderr.trim() || error.message;
      try {
        message = JSON.parse(stdout).error?.message || message;
      } catch {
        /* Not JSON: keep stderr. */
      }
      fail(Error(error.code === 'ENOENT' ? 'the artifact CLI was not found' : message));
    }),
  );

// Documents read this session, by source, so paging through one downloads it once.
// shortcut: an artifact changed during the session keeps its first text, restart the app to see a new version.
const cache = new Map();
async function load(source, cwd) {
  const artifact = artifactId(source);
  if (artifact) {
    if (!artifactCli()) throw Error(UNAVAILABLE);
    const dir = await mkdtemp(join(tmpdir(), 'lesson-artifact-')),
      file = join(dir, artifact[1]);
    const out = JSON.parse(await run(['artifacts', 'download', source.trim(), '--output', file, '--json']));
    const type = out.data?.contentType || '';
    if (/^image\//.test(type)) return { picture: file, type };
    try {
      const text = await readFile(file, 'utf8');
      return { text: /html/.test(type) ? htmlText(text) : text, type };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  const path = resolve(cwd, source.replace(/^~(?=\/)/, process.env.HOME || '~'));
  if ((await stat(path)).size > 64 << 20) throw Error('the file is larger than 64 MiB');
  const text = await readFile(path, 'utf8');
  return { text: /\.html?$/i.test(extname(path)) ? htmlText(text) : text, type: extname(path) };
}

// One page of a document, saying where it stops and how to read on.
export async function readDocument({ source, offset = 0 }, cwd = process.cwd()) {
  if (typeof source !== 'string' || !source.trim()) return 'Not read: give a file path or an artifact link or id';
  try {
    const key = artifactId(source) ? source.trim() : resolve(cwd, source);
    if (!cache.has(key)) cache.set(key, load(source, cwd));
    const doc = await cache.get(key).catch((error) => {
      cache.delete(key);
      throw error;
    });
    if (doc.picture)
      return `${source} is an image (${doc.type}); it was saved to ${doc.picture}: use read on it to see it.`;
    const start = Math.max(0, Math.floor(Number(offset) || 0)),
      end = Math.min(doc.text.length, start + PAGE),
      more = end < doc.text.length ? ` Call again with offset ${end} for the rest.` : ' This is the end.';
    return `[${source}: characters ${start}-${end} of ${doc.text.length}.${more}]\n${doc.text.slice(start, end)}`;
  } catch (error) {
    return `Not read: ${error.code === 'ENOENT' ? 'no such file' : error.message}`;
  }
}

// The caller's own artifacts, newest first: what the artifact CLI's `artifacts list` shows.
export async function listArtifacts({ limit = 30 } = {}) {
  try {
    if (!artifactCli()) throw Error(UNAVAILABLE);
    const n = String(Math.max(1, Math.min(100, Math.floor(Number(limit) || 30))));
    const files =
      JSON.parse(await run(['artifacts', 'list', '--no-expired', '--json', '--limit', n])).data?.files || [];
    return files.length
      ? files.map((f) => `${f.hostedUrl}  ${f.filename}  ${f.fileType}  ${f.uploadedAt.slice(0, 10)}`).join('\n')
      : 'No artifacts.';
  } catch (error) {
    return `Not listed: ${error.message}`;
  }
}

// Pure display, activity and ordering rules. No host or project imports.
export const KEYS = ['sp_panes', 'sp_agents', 'sp_au', 'sp_name_active', 'sp_name', 'sp_name_stale', 'sp_quiet'];
export const QUIET_MS = 48 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const PAD = '\u2800';
const segments = new Intl.Segmenter('en', { granularity: 'grapheme' });
export const sanitize = (text) => text.replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').trim();
const wide = (n) => n >= 0x1100 && (n <= 0x115f || n === 0x2329 || n === 0x232a ||
  (n >= 0x2e80 && n <= 0xa4cf && n !== 0x303f) || (n >= 0xac00 && n <= 0xd7a3) ||
  (n >= 0xf900 && n <= 0xfaff) || (n >= 0xfe10 && n <= 0xfe19) ||
  (n >= 0xfe30 && n <= 0xfe6f) || (n >= 0xff00 && n <= 0xff60) ||
  (n >= 0xffe0 && n <= 0xffe6) || (n >= 0x20000 && n <= 0x3fffd));
export function clusterWidth(cluster) {
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(cluster) && !cluster.includes('\ufe0e')) return 2;
  const base = [...cluster].find((c) => !/[\p{Mark}\p{Cf}]/u.test(c));
  return base ? (wide(base.codePointAt(0)) ? 2 : 1) : 0;
}
export const width = (text) => [...segments.segment(text)].reduce((n, s) => n + clusterWidth(s.segment), 0);
export function fitLabel(raw, cells, exact = false) {
  const text = sanitize(raw);
  // Bound code points too: Herdr truncates at 80, even for zero-width marks.
  if (width(text) <= cells && [...text].length <= 60) return text + (exact ? PAD.repeat(cells - width(text)) : (text ? '' : PAD));
  let out = '', used = 0, points = 0;
  for (const { segment } of segments.segment(text)) {
    const w = clusterWidth(segment), count = [...segment].length;
    if (used + w > cells - 1 || points + count > 60) break;
    out += segment; used += w; points += count;
  }
  return out + (exact ? PAD.repeat(cells - 1 - used) : '') + '…';
}
const count = (n, suffix) => String(Math.min(99, n)).padStart(2, '0') + suffix;
export function au(panes) {
  let sum = 0;
  for (const pane of panes.filter((p) => p.agent === 'pi')) {
    const values = [pane.tokens?.g2_au, pane.tokens?.g2_au0].filter((v) => v !== undefined);
    if (!values.length || values.some((v) => !/^\d{2}AU$/.test(v))) return '??AU';
    // Normally exactly one key is present; conflicting variants are unknown, never double counted.
    if (new Set(values).size !== 1) return '??AU';
    sum += Number(values[0].slice(0, 2));
  }
  return count(sum, 'AU');
}
// Herdr 0.9.3 gives a top-level space row (sidebar width - divider - scrollbar) - indent 1 - 2 cells:
// 31 at the locked width of 36 with a scrollbar (src/ui/sidebar.rs expanded_sidebar_sections,
// src/client/shell/sidebar.rs render_workspace_rows). The icon, ` `, NNPN and ` · ` take 9, leaving 22.
export const NAME_CELLS = 22;
export const STALE_NAME_CELLS = 15;
export const QUIET_CELLS = NAME_CELLS - STALE_NAME_CELLS - 3;
export function tokens(workspace, panes, last, now) {
  const quiet = !workspace.focused && now - last >= QUIET_MS;
  const result = { sp_panes: count(workspace.pane_count, 'PN') };
  if (quiet) {
    result.sp_name_stale = fitLabel(workspace.label, STALE_NAME_CELLS, true);
    result.sp_quiet = (Math.min(99, Math.floor((now - last) / DAY_MS)) + 'd').padStart(QUIET_CELLS, PAD);
  } else {
    result[workspace.focused ? 'sp_name_active' : 'sp_name'] = fitLabel(workspace.label, NAME_CELLS);
    result.sp_agents = count(panes.filter((p) => p.agent != null).length, 'AG');
    result.sp_au = au(panes);
  }
  return result;
}
export const ACTIVITY_EVENTS = new Set(['workspace.created', 'pane.created', 'pane.closed', 'pane.agent_detected', 'pane.focused', 'tab.focused', 'workspace.focused']);
export function activityWorkspace(event) {
  if (!ACTIVITY_EVENTS.has(event.event)) return null;
  return event.data?.workspace_id ?? event.data?.pane?.workspace_id ?? event.data?.workspace?.workspace_id ?? null;
}
export function advanceHistory(history, workspaces, panes, activity, now) {
  const next = Object.assign(Object.create(null), structuredClone(history));
  const busy = new Set(panes.filter((p) => ['working', 'blocked'].includes(p.agent_status)).map((p) => p.workspace_id));
  for (const w of workspaces) {
    const prev = next[w.workspace_id];
    const last = !prev || w.focused || busy.has(w.workspace_id) || activity.has(w.workspace_id) ? now : Math.min(now, prev.last);
    next[w.workspace_id] = { last, seen: now };
  }
  const present = new Set(workspaces.map((w) => w.workspace_id));
  for (const [id, entry] of Object.entries(next)) if (!present.has(id) && now - entry.seen > 30 * DAY_MS) delete next[id];
  return next;
}
export function units(workspaces, history, now) {
  const members = new Map();
  for (const w of workspaces) if (w.worktree) {
    const key = w.worktree.repo_key;
    if (!members.has(key)) members.set(key, []);
    members.get(key).push(w);
  }
  const grouped = new Set([...members].filter(([, ws]) => ws.length >= 2 && ws.some((w) => !w.worktree.is_linked_worktree)).map(([key]) => key));
  const emitted = new Set(), result = [];
  for (const w of workspaces) {
    const key = w.worktree?.repo_key;
    if (grouped.has(key) && emitted.has(key)) continue;
    const ws = grouped.has(key) ? members.get(key) : [w];
    emitted.add(key);
    // Herdr draws the first non-linked parent followed by children in user order.
    const parent = ws.find((m) => m.worktree && !m.worktree.is_linked_worktree) ?? ws[0];
    const ordered = [parent, ...ws.filter((m) => m !== parent)];
    const last = Math.max(...ws.map((m) => history[m.workspace_id]?.last ?? now));
    result.push({ ids: ordered.map((m) => m.workspace_id), focused: ws.some((m) => m.focused), last,
      quiet: ws.every((m) => !m.focused && now - (history[m.workspace_id]?.last ?? now) >= QUIET_MS) });
  }
  return result;
}
export function sortPlan(workspaces, history, now, previousSignature, lastMove = -Infinity) {
  const all = units(workspaces, history, now);
  const quiet = all.filter((u) => u.quiet).sort((a, b) => b.last - a.last || a.ids.toSorted().join().localeCompare(b.ids.toSorted().join(), 'en'));
  // Signature covers which spaces exist and the quiet order, so a created or closed space re-sorts; it excludes
  // user ordering of non-quiet units and age changes that keep the quiet order, so drags otherwise stay.
  const present = workspaces.map((w) => w.workspace_id).sort();
  const signature = JSON.stringify({ present, quiet: quiet.map((u) => [...u.ids].sort()) });
  if (signature === previousSignature || now - lastMove < 60_000) return { signature: previousSignature, moves: [] };
  const desired = [...all.filter((u) => !u.quiet), ...quiet].flatMap((u) => u.ids);
  if (desired.join('\0') === workspaces.map((w) => w.workspace_id).join('\0')) return { signature, moves: [] };
  // Moving only quiet units to the end preserves all non-quiet user order and never moves the focused unit.
  return { signature, moves: quiet.map((u) => ({ workspace_ids: u.ids })) };
}
const record = (x) => x && typeof x === 'object' && !Array.isArray(x);
const id = (x) => typeof x === 'string' && x.length > 0 && x.length <= 128;
const status = (x) => ['idle', 'working', 'blocked', 'done', 'unknown'].includes(x);
export function validateLists(workspaces, panes, { allowCountMismatch = false } = {}) {
  if (!Array.isArray(workspaces) || !Array.isArray(panes) || workspaces.length > 4096 || panes.length > 16384) return false;
  const ids = new Set();
  for (const w of workspaces) {
    if (!record(w) || !id(w.workspace_id) || ids.has(w.workspace_id) || typeof w.label !== 'string' || w.label.length > 4096 ||
      typeof w.focused !== 'boolean' || !Number.isSafeInteger(w.pane_count) || w.pane_count < 0 || !status(w.agent_status)) return false;
    if (w.worktree != null && (!record(w.worktree) || typeof w.worktree.repo_key !== 'string' || !w.worktree.repo_key || w.worktree.repo_key.length > 4096 || typeof w.worktree.is_linked_worktree !== 'boolean')) return false;
    ids.add(w.workspace_id);
  }
  const paneIds = new Set();
  for (const p of panes) {
    if (!record(p) || !id(p.pane_id) || paneIds.has(p.pane_id) || !ids.has(p.workspace_id) || !status(p.agent_status) ||
      (p.agent != null && !id(p.agent)) || (p.tokens !== undefined && (!record(p.tokens) || Object.keys(p.tokens).length > 32 || Object.values(p.tokens).some((v) => typeof v !== 'string' || [...v].length > 80)))) return false;
    paneIds.add(p.pane_id);
  }
  // Two separate reads may span a mutation; reject inconsistent counts rather than displaying invented totals.
  const counts = new Map();
  for (const p of panes) counts.set(p.workspace_id, (counts.get(p.workspace_id) ?? 0) + 1);
  return workspaces.filter((w) => w.focused).length <= 1 && (allowCountMismatch || workspaces.every((w) => (counts.get(w.workspace_id) ?? 0) === w.pane_count));
}

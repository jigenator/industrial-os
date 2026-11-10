// Reading slides aloud. Gemini's speech model turns a slide's speaker notes into a WAV and macOS afplay plays it.
// Pi has no speech models, so this is the one module that calls Google itself (with the key Pi has stored) and runs
// a program of its own; its audio lives in a private temporary folder that it removes.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { order, slideById, spokenText, selectSlide } from './model.mjs';

export { spokenText };

export const SPEECH_MODEL = 'gemini-3.8-flash-tts';
// Gemini's 30 prebuilt voices with Google's one-word style (ai.google.dev speech generation) and gender (Cloud TTS
// Chirp 3 HD, the same voices).
export const VOICES = [
  ['Zephyr', 'female', 'bright'],
  ['Puck', 'male', 'upbeat'],
  ['Charon', 'male', 'informative'],
  ['Kore', 'female', 'firm'],
  ['Fenrir', 'male', 'excitable'],
  ['Leda', 'female', 'youthful'],
  ['Orus', 'male', 'firm'],
  ['Aoede', 'female', 'breezy'],
  ['Callirrhoe', 'female', 'easy-going'],
  ['Autonoe', 'female', 'bright'],
  ['Enceladus', 'male', 'breathy'],
  ['Iapetus', 'male', 'clear'],
  ['Umbriel', 'male', 'easy-going'],
  ['Algieba', 'male', 'smooth'],
  ['Despina', 'female', 'smooth'],
  ['Erinome', 'female', 'clear'],
  ['Algenib', 'male', 'gravelly'],
  ['Rasalgethi', 'male', 'informative'],
  ['Laomedeia', 'female', 'upbeat'],
  ['Achernar', 'female', 'soft'],
  ['Alnilam', 'male', 'firm'],
  ['Schedar', 'male', 'even'],
  ['Gacrux', 'female', 'mature'],
  ['Pulcherrima', 'female', 'forward'],
  ['Achird', 'male', 'friendly'],
  ['Zubenelgenubi', 'male', 'casual'],
  ['Vindemiatrix', 'female', 'gentle'],
  ['Sadachbia', 'male', 'lively'],
  ['Sadaltager', 'male', 'knowledgeable'],
  ['Sulafat', 'female', 'warm'],
].map(([name, gender, style]) => ({ name, gender, style }));
// The operator's choice.
export const DEFAULT_VOICE = 'Orus';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${SPEECH_MODEL}:generateContent`;
// Recent slides' audio, so stepping back or reading a slide again starts at once.
const KEEP = 8;
// Voice speeds the speed button steps through.
export const SPEEDS = [1, 1.5, 2, 3, 4];
// afplay starts sounding a little after it starts; a restart backs up this much so no word is lost.
const BACK_UP = 1;

// How long a WAV plays at 1x, in seconds, or null for anything that is not one.
export function seconds(wav) {
  if (wav.length < 44 || wav.toString('latin1', 0, 4) !== 'RIFF') return null;
  const data = wav.indexOf('data', 12),
    byteRate = wav.readUInt32LE(28);
  return data < 0 || !byteRate ? null : (wav.length - data - 8) / byteRate;
}
// How often the share of a slide already heard (s.reading.heard) is brought up to date while it plays.
const HEARD_MS = 250;

// The same WAV from a time on: its header with the shorter data after it.
export function fromSecond(wav, seconds) {
  if (wav.length < 44 || wav.toString('latin1', 0, 4) !== 'RIFF') return wav;
  const data = wav.indexOf('data', 12),
    byteRate = wav.readUInt32LE(28),
    block = wav.readUInt16LE(32);
  if (data < 0 || !byteRate || !block) return wav;
  const start = data + 8,
    skip = Math.min(wav.length - start, Math.floor((Math.max(0, seconds) * byteRate) / block) * block),
    head = Buffer.from(wav.subarray(0, start)),
    body = wav.subarray(start + skip);
  head.writeUInt32LE(body.length, data + 4);
  head.writeUInt32LE(head.length - 8 + body.length, 4);
  return Buffer.concat([head, body]);
}

// One WAV for one text, from Gemini's speech model.
export async function synthesize(text, { key, signal, voice = DEFAULT_VOICE }) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Error(body?.error?.message || `Google speech request failed (${response.status})`);
  const data = body?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw Error('Google returned no audio');
  return Buffer.from(data, 'base64');
}

// Plays one WAV at a time with afplay; pause and resume stop and continue the player process.
export function createPlayer() {
  let folder = null,
    current = null,
    count = 0;
  return {
    async play(wav, rate = 1) {
      folder ??= await mkdtemp(join(tmpdir(), 'lesson-maker-voice-'));
      const file = join(folder, `${++count}.wav`);
      await writeFile(file, wav, { mode: 0o600 });
      const child = spawn('afplay', ['-r', String(rate), '-q', '1', file], { stdio: 'ignore' });
      const started = Date.now();
      let pausedAt = null,
        pausedFor = 0;
      const done = new Promise((resolve) => {
        child.on('error', (error) => resolve(error.message));
        child.on('exit', (code, signal) => resolve(code === 0 ? null : signal ? 'stopped' : `afplay exited ${code}`));
      }).finally(() => rm(file, { force: true }));
      current = child;
      return {
        done,
        pause() {
          pausedAt ??= Date.now();
          child.kill('SIGSTOP');
        },
        resume() {
          if (pausedAt !== null) pausedFor += Date.now() - pausedAt;
          pausedAt = null;
          child.kill('SIGCONT');
        },
        // Seconds of the clip heard so far.
        position: () => (((pausedAt ?? Date.now()) - started - pausedFor) / 1000) * rate,
        stop: () => {
          child.kill('SIGCONT');
          child.kill('SIGTERM');
        },
      };
    },
    dispose() {
      current?.kill('SIGCONT');
      current?.kill('SIGTERM');
      // At once: the process exits right after disposing.
      if (folder) rmSync(folder, { recursive: true, force: true });
    },
  };
}

// Reads the current slide, or presents from it: each slide is read in turn and the selected slide follows the
// voice, with the next slide's audio prepared while the current one plays. s.reading says what is happening.
export function createReader(
  s,
  {
    key = async () => null,
    speak = synthesize,
    player = createPlayer(),
    onChange = () => {},
    every = (fn, ms) => {
      const timer = setInterval(fn, ms);
      return () => clearInterval(timer);
    },
  } = {},
) {
  const cache = new Map();
  let run = 0,
    playing = null,
    pending = null,
    unwatch = () => {};
  // Follows how much of the slide has been heard, for the spoken-word highlight: Gemini gives no word timings, so
  // this is the share of the clip's time played (offset is where a restarted clip began in the whole one).
  function watch(handle, offset, total) {
    unwatch();
    if (!total || !handle.position) return;
    unwatch = every(() => {
      const heard = Math.min(1, Math.max(0, (offset + handle.position()) / total));
      if (s.reading && heard !== s.reading.heard) {
        s.reading.heard = heard;
        onChange();
      }
    }, HEARD_MS);
  }
  function audio(text, signal) {
    const voice = s.voice || DEFAULT_VOICE,
      id = `${voice}\n${text}`;
    if (!cache.has(id)) {
      const made = key().then((k) => {
        if (!k) throw Error('Pi has no Google API key; log in to Google in Pi to read slides aloud');
        return speak(text, { key: k, signal, voice });
      });
      made.catch(() => cache.delete(id));
      cache.set(id, made);
      if (cache.size > KEEP) cache.delete(cache.keys().next().value);
    }
    return cache.get(id);
  }
  const neighbour = (id, step) => {
    const all = order(s),
      i = all.findIndex((x) => x.id === id);
    return all[i + step] || null;
  };
  // byVoice: the presentation reached this slide by itself, not because the author chose it.
  async function read(id, mode, byVoice = false) {
    const mine = ++run;
    unwatch();
    playing?.stop();
    playing = null;
    pending?.abort();
    pending = new AbortController();
    const slide = slideById(s, id),
      text = spokenText(slide);
    s.reading = {
      mode,
      slideId: id,
      status: 'loading',
      paused: s.reading?.mode === mode && s.reading.paused,
      heard: 0,
    };
    // Presenting, the editor follows the voice.
    if (mode === 'present') selectSlide(s, id);
    // A slide with nothing to read that the author chose ends the presentation there; skipping it would move the
    // author off the slide they picked, so a new empty slide could never be opened.
    if (!text && mode === 'present' && !byVoice) {
      s.reading = null;
      s.notice = 'Stopped presenting: this slide has nothing to read';
      onChange();
      return;
    }
    onChange();
    if (!text) return finished(mine);
    let wav;
    try {
      wav = await audio(text, pending.signal);
    } catch (error) {
      if (mine !== run) return;
      Object.assign(s.reading, { status: 'error', message: error.message });
      if (mode === 'slide') {
        s.notice = `Could not read the slide aloud: ${error.message}`;
        s.reading = null;
      }
      onChange();
      return;
    }
    if (mine !== run) return;
    // The next slide's voice is prepared while this one plays.
    const next = mode === 'present' && neighbour(id, 1);
    if (next && spokenText(next)) audio(spokenText(next)).catch(() => {});
    let failed,
      offset = 0;
    const total = seconds(wav);
    // A speed change restarts the clip from where it was, at the new speed.
    for (;;) {
      const handle = await player.play(wav, s.speechRate || 1);
      if (mine !== run) return handle.stop();
      playing = handle;
      s.reading.status = 'playing';
      if (s.reading.paused) handle.pause();
      watch(handle, offset, total);
      onChange();
      failed = await handle.done;
      unwatch();
      if (mine !== run) return;
      playing = null;
      if (handle.restartAt === undefined) break;
      offset += handle.restartAt;
      wav = fromSecond(wav, handle.restartAt);
    }
    if (!failed) s.reading.heard = 1;
    if (failed && failed !== 'stopped') {
      Object.assign(s.reading, { status: 'error', message: failed });
      onChange();
      return;
    }
    finished(mine);
  }
  function finished(mine) {
    if (mine !== run || !s.reading) return;
    const { mode, slideId } = s.reading,
      next = mode === 'present' && neighbour(slideId, 1);
    if (next) return read(next.id, mode, true);
    s.reading = mode === 'present' ? { ...s.reading, status: 'done' } : null;
    if (mode === 'slide') s.notice = 'Finished reading the slide aloud';
    onChange();
  }
  return {
    readSlide: (id) => read(id, 'slide'),
    present: (id) => read(id, 'present'),
    // Space: pause or resume; after a failure or at the end, read the current slide again.
    toggle() {
      const r = s.reading;
      if (!r) return;
      if (r.status === 'error' || r.status === 'done') return read(r.slideId, r.mode);
      r.paused = !r.paused;
      if (playing) r.paused ? playing.pause() : playing.resume();
      onChange();
    },
    // A new voice: the slide being read starts again in it.
    revoice() {
      if (s.reading) read(s.reading.slideId, s.reading.mode);
    },
    // Pauses, as when the author starts typing; toggle resumes.
    pause() {
      if (!s.reading || s.reading.paused) return;
      s.reading.paused = true;
      playing?.pause();
      onChange();
    },
    // The next voice speed, at once: a playing clip goes on from where it was.
    faster() {
      s.speechRate = SPEEDS[(SPEEDS.indexOf(s.speechRate) + 1) % SPEEDS.length];
      if (playing) {
        playing.restartAt = Math.max(0, playing.position() - BACK_UP);
        playing.stop();
      }
      onChange();
      return s.speechRate;
    },
    step(by) {
      const r = s.reading,
        next = r && neighbour(r.slideId, by);
      if (next) read(next.id, r.mode);
    },
    stop() {
      run++;
      unwatch();
      playing?.stop();
      playing = null;
      pending?.abort();
      s.reading = null;
      onChange();
    },
    dispose() {
      run++;
      unwatch();
      pending?.abort();
      player.dispose();
    },
  };
}

import { useSettingsStore, type SoundProfile } from "./settings-store";

let ctx: AudioContext | null = null;

function getCtx() {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === "closed") ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function getProfile(): SoundProfile {
  try {
    return useSettingsStore.getState().soundProfile;
  } catch {
    return 1;
  }
}

// ── helpers ──

function sine(start: number, freq: number, gain: number, dur: number) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur - 0.02);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur);
}

function square(start: number, freq: number, gain: number, dur: number) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur - 0.04);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur);
}

function triangle(start: number, freq: number, gain: number, dur: number) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur - 0.03);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(start);
  osc.stop(start + dur);
}

// ── success chime ──

function chimeProfile1() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  sine(t, 1047, 0.3, 0.12);
  sine(t + 0.07, 1319, 0.3, 0.12);
}

function chimeProfile2() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  triangle(t, 660, 0.25, 0.3);
}

function chimeProfile3() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  sine(t, 1319, 0.3, 0.1);
  sine(t + 0.05, 1760, 0.3, 0.1);
}

// ── fail sound ──

function failProfile1() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  sine(t, 400, 0.25, 0.18);
  sine(t + 0.1, 320, 0.25, 0.18);
}

function failProfile2() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  triangle(t, 220, 0.15, 0.25);
}

function failProfile3() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  square(t, 180, 0.2, 0.15);
}

// ── rest timer end beep ──

function beepProfile1() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  square(t, 440, 0.4, 0.4);
  square(t + 0.05, 660, 0.4, 0.4);
  square(t + 0.4, 660, 0.4, 0.5);
  square(t + 0.45, 880, 0.4, 0.5);
}

function beepProfile2() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  triangle(t, 440, 0.25, 0.35);
  triangle(t + 0.15, 550, 0.25, 0.35);
  triangle(t + 0.3, 660, 0.25, 0.4);
}

function beepProfile3() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  square(t, 880, 0.5, 0.3);
  square(t + 0.08, 1100, 0.5, 0.3);
  square(t + 0.3, 880, 0.5, 0.3);
  square(t + 0.38, 1100, 0.5, 0.3);
}

// ── public API ──

export function playChime(profile?: SoundProfile) {
  try {
    const p = profile ?? getProfile();
    if (p === 2) chimeProfile2();
    else if (p === 3) chimeProfile3();
    else chimeProfile1();
  } catch {
    // Audio not available
  }
}

export function playFail(profile?: SoundProfile) {
  try {
    const p = profile ?? getProfile();
    if (p === 2) failProfile2();
    else if (p === 3) failProfile3();
    else failProfile1();
  } catch {
    // Audio not available
  }
}

export function playBeep(profile?: SoundProfile) {
  try {
    const p = profile ?? getProfile();
    if (p === 2) beepProfile2();
    else if (p === 3) beepProfile3();
    else beepProfile1();
  } catch {
    // Audio not available
  }
}

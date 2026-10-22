const MUTE_KEY = "smartegg-alarm-sound-muted";

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedContext) {
    const fallback = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctor = window.AudioContext ?? fallback;
    if (!Ctor) return null;
    sharedContext = new Ctor();
  }
  if (sharedContext.state === "suspended") void sharedContext.resume();
  return sharedContext;
}

export function isAlarmSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) !== "1";
}

export function setAlarmSoundEnabled(enabled: boolean): void {
  window.localStorage.setItem(MUTE_KEY, enabled ? "0" : "1");
}

function tone(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
  gain.gain.setValueAtTime(0.16, start + duration - 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  const context = getContext();
  if (context && context.state === "suspended") void context.resume();
}

export function playAlarmSound(): void {
  const context = getContext();
  if (!context || !isAlarmSoundEnabled()) return;
  const start = context.currentTime + 0.02;
  const pattern: Array<[frequency: number, offset: number]> = [
    [880, 0],
    [659.25, 0.18],
    [880, 0.36],
    [659.25, 0.54],
    [880, 0.72],
  ];
  for (const [frequency, offset] of pattern) {
    tone(context, frequency, start + offset, 0.2);
  }
}
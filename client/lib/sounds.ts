// Web Audio one-shot player for the table's sound vocabulary. No dependency:
// fixed sprite set, instant retrigger, one master gain for mute. Missing
// files decode to silent no-ops so a partial asset set never breaks play.
//
// Assets: Kenney "Casino Audio" (CC0, kenney.nl/assets/casino-audio),
// transcoded to mp3 — see round-12-plan-execution.md R12.3 for the manifest.
const SPRITES = {
  deal: "/sounds/deal.mp3",
  draw: "/sounds/draw.mp3",
  place: "/sounds/place.mp3",
  peek: "/sounds/peek.mp3",
  match: "/sounds/match.mp3",
  penalty: "/sounds/penalty.mp3",
  check: "/sounds/check.mp3",
  yourTurn: "/sounds/your-turn.mp3",
  timerTail: "/sounds/timer-tail.mp3",
  roundOver: "/sounds/round-over.mp3",
  chat: "/sounds/chat.mp3",
  shuffle: "/sounds/shuffle.mp3",
} as const;
export type SpriteName = keyof typeof SPRITES;

const MUTE_KEY = "check:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<SpriteName, AudioBuffer>();

/** Sound defaults OFF; the header button is the invitation. */
export const isMuted = (): boolean => {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MUTE_KEY) !== "0";
};

export const setMuted = (muted: boolean) => {
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
};

export const initSounds = () => {
  if (ctx || typeof window === "undefined") return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = isMuted() ? 0 : 1;
  master.connect(ctx.destination);
  // Autoplay policy: resume on the first gesture.
  const unlock = () => {
    ctx?.resume();
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  for (const [name, url] of Object.entries(SPRITES)) {
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((ab) => ctx!.decodeAudioData(ab))
      .then((buf) => buffers.set(name as SpriteName, buf))
      .catch(() => {}); // asset absent: this sprite stays silent
  }
};

export const play = (name: SpriteName) => {
  if (!ctx || !master || ctx.state !== "running") return;
  const buf = buffers.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(master);
  src.start();
};

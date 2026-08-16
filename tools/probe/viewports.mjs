// The device matrix.
//
// Phones get two rows, not one. `h-screen` is overridden to `100dvh` in
// globals.css, so the frame grows and shrinks by the height of the browser's
// URL bar while the content, sized in `svh` and fixed pixels, does not move.
// A board can fit one of those states and overflow the other, and testing only
// the taller one is how #82 was first miscalled as the board never having fit.
//
// Heights are the browser viewport, not the device screen: screen height minus
// the URL bar, and minus the Android navigation bar where there is one.

export const VIEWPORTS = [
  { name: "pixel5-nobar", width: 393, height: 801 },
  { name: "pixel5-bar", width: 393, height: 745 },
  { name: "iphone-se", width: 375, height: 667 },
  { name: "ipad-portrait", width: 820, height: 1080 },
  { name: "laptop-short", width: 1280, height: 500 },
  { name: "laptop", width: 1440, height: 780 },
  { name: "desktop", width: 1920, height: 1080 },
];

/** The cells a pull request runs. The full sweep is for the nightly job. Any
 *  cell that has ever failed belongs in here permanently. */
export const SMOKE = new Set([
  "pixel5-bar",
  "pixel5-nobar",
  "iphone-se",
  "laptop-short",
  "desktop",
]);

export const resolve = (names) => {
  if (!names || names === "smoke") {
    return VIEWPORTS.filter((v) => SMOKE.has(v.name));
  }
  if (names === "all") return VIEWPORTS;
  const wanted = new Set(String(names).split(","));
  const picked = VIEWPORTS.filter((v) => wanted.has(v.name));
  const unknown = [...wanted].filter(
    (n) => !VIEWPORTS.some((v) => v.name === n),
  );
  if (unknown.length) {
    throw new Error(
      `unknown viewport: ${unknown.join(", ")}\nknown: ${VIEWPORTS.map((v) => v.name).join(", ")}`,
    );
  }
  return picked;
};

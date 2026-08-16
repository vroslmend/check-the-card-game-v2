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
  // Browser viewports, not screen sizes. The number a device is sold with is
  // the screen; what matters is what is left after the browser and the OS have
  // taken theirs, and the gap between the two is where this breaks. A 1080p
  // desktop gives about 910, not 1080, and testing 1080 missed a live bug.
  { name: "iphone-se", width: 375, height: 553 },
  { name: "iphone-15", width: 393, height: 659 },
  { name: "pixel5-bar", width: 393, height: 745 },
  { name: "pixel5-nobar", width: 393, height: 801 },
  { name: "phone-landscape", width: 745, height: 393 },
  { name: "ipad-portrait", width: 820, height: 1024 },
  { name: "ipad-landscape", width: 1080, height: 764 },
  // 1366x768 is still the most common laptop panel and leaves about 600, which
  // lands exactly on the second tier's boundary.
  { name: "laptop-1366", width: 1366, height: 600 },
  { name: "laptop-short", width: 1280, height: 500 },
  { name: "macbook-air", width: 1440, height: 790 },
  { name: "macbook-14", width: 1512, height: 872 },
  { name: "desktop-window", width: 1920, height: 910 },
  { name: "desktop-full", width: 1920, height: 1080 },
];

/** The cells a pull request runs. The full sweep is for the nightly job. Any
 *  cell that has ever failed belongs in here permanently. */
export const SMOKE = new Set([
  "iphone-se",
  "pixel5-bar",
  "laptop-1366",
  "laptop-short",
  "macbook-14",
  "desktop-window",
  "desktop-full",
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

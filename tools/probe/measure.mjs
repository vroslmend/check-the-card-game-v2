// The measurement, serialised into the page.
//
// It reports numbers, never a pass/fail opinion. Judgement lives in the
// reporter, so a failure prints "centre y=730 in a 745 frame" rather than an
// assertion that tells you nothing about what went wrong.

export function measureInPage() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const named = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const text = (el.innerText || "").trim().replace(/\s+/g, " ");
    return text.slice(0, 40) || `<${el.tagName.toLowerCase()}>`;
  };

  const visible = (el, style) =>
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity) !== 0;

  // Anything that scrolls, anywhere. A game view should produce an empty list.
  const scrollers = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    const scrolls = /auto|scroll/.test(style.overflowY + style.overflow);
    const over = el.scrollHeight - el.clientHeight;
    if (scrolls && over > 0 && visible(el, style)) {
      scrollers.push({
        el: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 60),
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
        overflowPx: over,
        scrollbarPx: el.offsetWidth - el.clientWidth,
        // A scrollbar on the element that is also a container-query container
        // silently changes the width its own @md: breakpoints resolve against.
        isQueryContainer: style.containerType !== "normal",
      });
    }
  }

  // Every control a player has to be able to hit.
  const controls = [];
  for (const el of document.querySelectorAll(
    'button:not([disabled]), [role="button"]:not([aria-disabled="true"])',
  )) {
    const style = getComputedStyle(el);
    if (!visible(el, style) || style.pointerEvents === "none") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const inViewport = cx >= 0 && cx <= vw && cy >= 0 && cy <= vh;
    const hit = inViewport ? document.elementFromPoint(cx, cy) : null;

    // Fully inside, not merely centred inside. A button whose bottom half is
    // under the fold is still a button a thumb misses.
    const whole = r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;

    let status = "ok";
    let blockedBy = null;
    if (!inViewport) {
      status = "offscreen";
    } else if (!hit) {
      status = "no-hit";
    } else if (hit !== el && !el.contains(hit)) {
      status = "obscured";
      blockedBy = named(hit);
    } else if (!whole) {
      status = "clipped";
    }

    controls.push({
      name: named(el),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      status,
      blockedBy,
    });
  }

  // Full-bleed overlays: the moment stamps and the side panel. Detected by
  // geometry and stacking rather than by class, so a rename does not blind
  // this. An overlay that is meant to cover the screen and does not is the
  // #82 failure, and it only shows up once something scrolls.
  const overlays = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.position !== "absolute" && style.position !== "fixed") continue;
    if (!visible(el, style)) continue;
    const z = Number(style.zIndex);
    if (!Number.isFinite(z) || z < 40) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6 || r.height < vh * 0.6) continue;
    overlays.push({
      name: named(el).slice(0, 30),
      z,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      uncoveredTop: Math.max(0, Math.round(r.top)),
      uncoveredBottom: Math.max(0, Math.round(vh - r.bottom)),
    });
  }

  return {
    viewport: { width: vw, height: vh },
    docScrollsX:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    scrollers,
    controls,
    overlays,
  };
}

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

  // Anything whose content does not fit it, however it is hiding that. A game
  // view should produce an empty list.
  //
  // `hidden` counts, and counts for more once the view stops scrolling: the
  // content still reports its real scrollHeight, and clipping is exactly the
  // failure that leaves a control unreachable with nothing on screen to say
  // so. Watching only for scrollbars would go blind the moment the fix lands.
  const scrollers = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY + style.overflow;
    const scrolls = /auto|scroll/.test(overflowY);
    const clips = /hidden|clip/.test(overflowY);
    const over = el.scrollHeight - el.clientHeight;
    // Size gate on the clipping case only. Half the card components clip their
    // own corner radius with overflow-hidden and that is not a layout failure;
    // a box tall enough to be a view is a different matter. A scrollbar at any
    // size still counts, because a game view should have none at all.
    const isView = el.getBoundingClientRect().height >= vh * 0.6;
    if ((scrolls || (clips && isView)) && over > 0 && visible(el, style)) {
      // Which descendant actually reaches furthest down. Summing the rows does
      // not always find it: an out-of-flow child still counts toward scrollable
      // overflow, so the rows can add up to exactly the frame while the box
      // still scrolls.
      const top = el.getBoundingClientRect().top;
      let deepest = null;
      for (const d of el.querySelectorAll("*")) {
        const ds = getComputedStyle(d);
        if (!visible(d, ds)) continue;
        const bottom = d.getBoundingClientRect().bottom - top + el.scrollTop;
        if (!deepest || bottom > deepest.bottom) {
          deepest = {
            bottom: Math.round(bottom),
            tag: d.tagName.toLowerCase(),
            cls: String(d.className).slice(0, 46),
            position: ds.position,
          };
        }
      }
      scrollers.push({
        el: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 60),
        clientH: el.clientHeight,
        scrollH: el.scrollHeight,
        overflowPx: over,
        mode: scrolls ? "scrolls" : "clips",
        scrollbarPx: el.offsetWidth - el.clientWidth,
        // A scrollbar on the element that is also a container-query container
        // silently changes the width its own @md: breakpoints resolve against.
        isQueryContainer: style.containerType !== "normal",
        deepest,
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

  // Where the height actually goes. Fitting the board is a budgeting problem,
  // and the first thing anyone needs is the itemised bill rather than a guess
  // at which row is fat.
  const budget = [];
  const tallest = scrollers.sort((a, b) => b.scrollH - a.scrollH)[0];
  const root = tallest
    ? [...document.querySelectorAll("body *")].find(
        (e) =>
          e.tagName.toLowerCase() === tallest.el &&
          e.scrollHeight === tallest.scrollH,
      )
    : document.querySelector("main");
  if (root) {
    // display:contents boxes generate no box of their own, so their children
    // are the real rows and have to be walked through. Descend two levels:
    // the outer children are the header and the grid, and it is the grid's own
    // rows that the budget is actually made of.
    // Follow the tallest child down. Everything else at a level is recorded as
    // it stands, so the bill reads header, then the rows inside the one box
    // that holds the rest of the height.
    const boxes = (el) => {
      const out = [];
      for (const child of el.children) {
        if (getComputedStyle(child).display === "contents") {
          out.push(...boxes(child));
          continue;
        }
        if (child.getBoundingClientRect().height > 0) out.push(child);
      }
      return out;
    };
    const collect = (el, depth) => {
      const children = boxes(el);
      const tallest = children.reduce(
        (a, b) =>
          b.getBoundingClientRect().height >
          (a?.getBoundingClientRect().height ?? 0)
            ? b
            : a,
        null,
      );
      for (const child of children) {
        const r = child.getBoundingClientRect();
        if (depth > 0 && child === tallest && boxes(child).length > 0) {
          collect(child, depth - 1);
          continue;
        }
        budget.push({
          tag: child.tagName.toLowerCase(),
          cls: String(child.className).slice(0, 46),
          height: Math.round(r.height),
        });
      }
    };
    collect(root, 1);
  }

  return {
    viewport: { width: vw, height: vh },
    docScrollsX:
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    scrollers,
    controls,
    overlays,
    budget,
  };
}

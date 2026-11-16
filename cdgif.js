// Turns an album cover into a spinning-CD GIF. Pure JavaScript, no extra image tools needed.
// Want a different look? These numbers are the knobs (all sizes are fractions of the picture).
const { GIFEncoder, quantize, applyPalette } = require('gifenc');

const CFG = {
  size: 512,          // picture size in pixels. Discord needs at least 512x512 for presence
                      // pictures (uploaded assets and external links alike), so 256px GIFs
                      // made before this change often never showed on Discord at all.
  frames: 12,         // frames in one full turn (was 36 — the 36-frame GIF was
                      // ~2.3 MB, and Discord's image proxy only played the
                      // first ~5 frames of it, then jumped back to the start
                      // every 0.35 s, which looked like flashing. 12 frames
                      // is ~0.7 MB, so Discord gets the whole loop.)
  delay: 120,         // milliseconds per frame, so one turn = frames x delay
                      // (12 x 120 ms = 1.44 s per turn)
  disc: 0.47,         // disc radius
  hub: 0.07,          // where the clear plastic ring ends and the printed cover starts
                      // (was 0.2 — Discord CDs only, see below)
  hole: 0.045,        // center hole radius (was 0.075 — smaller hole, like the
                      // example CD: the cover photo goes almost right up to
                      // the hole, with just a thin clear ring around it.
                      // This file makes the Discord CDs only. The CD inside
                      // the app itself is drawn by CSS in index.html and is
                      // NOT changed here.)
  shine: 0.5,         // how bright the light streaks are (0 = none)
  bg: [16, 17, 34],   // background color behind the disc
};
const aa = (d) => (d <= -0.5 ? 0 : d >= 0.5 ? 1 : d + 0.5); // soft 1-pixel edge

function makeCdGif(src) { // src = RGBA bytes of a square cover, CFG.size x CFG.size
  const S = CFG.size, C = S / 2, R = CFG.disc * S, HUB = CFG.hub * S, HOLE = CFG.hole * S, F = CFG.frames;
  const frames = [];
  for (let f = 0; f < F; f++) {
    const rot = (2 * Math.PI * f) / F, cs = Math.cos(rot), sn = Math.sin(rot), out = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - C, dy = y + 0.5 - C, r = Math.hypot(dx, dy), i = (y * S + x) * 4;
      const vig = 1 + 0.35 * (1 - Math.min(1, r / (S * 0.75)));
      const br = CFG.bg[0] * vig, bg = CFG.bg[1] * vig, bb = CFG.bg[2] * vig;
      const disc = aa(R - r);
      if (disc <= 0) { out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = 255; continue; }
      // the printed cover turns with the disc (bilinear sample)
      const u = (dx * cs + dy * sn) / (2 * R) + 0.5, v = (-dx * sn + dy * cs) / (2 * R) + 0.5;
      const px = Math.min(S - 1.001, Math.max(0, u * S - 0.5)), py = Math.min(S - 1.001, Math.max(0, v * S - 0.5));
      const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0, a = (y0 * S + x0) * 4, b = a + S * 4;
      let col = [0, 0, 0];
      for (let k = 0; k < 3; k++) col[k] = (src[a + k] * (1 - fx) + src[a + 4 + k] * fx) * (1 - fy) + (src[b + k] * (1 - fx) + src[b + 4 + k] * fx) * fy;
      // clear plastic hub in the middle, with a thin darker ring where the print starts
      const printed = aa(r - HUB), plastic = [222 + 12 * Math.cos(rot * 0 + dx / S), 226, 238];
      const edge = 0.3 * aa(1.5 - Math.abs(r - HUB - 1));
      for (let k = 0; k < 3; k++) col[k] = (plastic[k] * (1 - printed) + col[k] * printed) * (1 - edge);
      // darker rim
      const rim = aa(r - (R - Math.max(2, S * 0.012))); for (let k = 0; k < 3; k++) col[k] *= 1 - 0.55 * rim;
      // light streaks that stay put while the disc turns (that is what makes it look real)
      const s = Math.pow(Math.max(0, Math.cos(2 * (Math.atan2(dy, dx) - 0.6))), 10) * CFG.shine * (0.55 + 0.45 * Math.min(1, Math.max(0, (r - HUB) / (R - HUB))));
      col[0] += (238 - col[0]) * s; col[1] += (242 - col[1]) * s; col[2] += (255 - col[2]) * s;
      // center hole shows the background
      const hole = aa(HOLE - r); for (let k = 0; k < 3; k++) col[k] = col[k] * (1 - hole) + [br, bg, bb][k] * hole;
      out[i] = [br, bg, bb][0] * (1 - disc) + col[0] * disc; out[i + 1] = bg * (1 - disc) + col[1] * disc; out[i + 2] = bb * (1 - disc) + col[2] * disc; out[i + 3] = 255;
    }
    frames.push(out);
  }
  // one shared color palette from a few frames, so the colors don't flicker
  const pick = [0, F >> 2, F >> 1, (3 * F) >> 2].map((n) => frames[n]), all = new Uint8Array(pick.length * S * S * 4);
  pick.forEach((p, n) => all.set(p, n * S * S * 4));
  const palette = quantize(all, 128), gif = GIFEncoder(); // 128 colours, not
                      // 256 — same reason as fewer frames: a smaller file
                      // that Discord's proxy actually plays all the way through
  frames.forEach((fr, n) => gif.writeFrame(applyPalette(fr, palette), S, S, { palette: n === 0 ? palette : undefined, delay: CFG.delay }));
  gif.finish();
  return Buffer.from(gif.bytes());
}
module.exports = { makeCdGif, CD_SIZE: CFG.size };

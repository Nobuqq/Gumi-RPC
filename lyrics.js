// Lyrics lookup (LRCLIB — https://lrclib.net, free, no key needed).
// Kept in its own module, with no Electron dependency, so it can be
// unit-tested in plain Node. The main process calls fetchLyrics() behind
// the 'lyrics:get' IPC channel; the renderer only ever sees the parsed
// result ({ synced: [{t, line}], plain }) or { found: false }.

function parseLRC(text) {
  if (!text) return [];
  const lines = [];
  for (const raw of String(text).split(/\r?\n/)) {
    // [mm:ss.xx] line — metadata tags ([ti:], [ar:], [length:]) and
    // untimed lines are skipped, as are empty lines.
    const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (!m) continue;
    const line = m[3].trim();
    if (!line) continue;
    lines.push({ t: (+m[1]) * 60 + (+m[2]), line });
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

// Loose matching: lowercase, letters/digits only, one space between words.
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Score one LRCLIB search hit against the track we asked about.
// Title must match — a title miss means a different song entirely.
// Artist is worth as much as the title; the album is a tie-breaker, and a
// big duration gap costs a point (a different version of the same song).
function scoreResult(r, q) {
  const a = norm(r.artistName), t = norm(r.trackName), al = norm(r.albumName);
  const qa = norm(q.artist), qt = norm(q.title), qal = norm(q.album);
  if (!qt || !t || !(t === qt || t.includes(qt) || qt.includes(t))) return -1;
  let score = 3;
  if (qa && a && (a === qa || a.includes(qa) || qa.includes(a))) score += 3;
  if (qal && al && (al === qal || al.includes(qal) || qal.includes(al))) score += 2;
  if (r.syncedLyrics) score += 1;
  if (q.duration && r.duration) score -= Math.min(Math.abs(r.duration - q.duration) / 60, 1);
  return score;
}

// Best hit, or null. Needs at least artist + title to match (6 points) —
// a title-only hit is too risky to show as the song's lyrics.
function pickLyricsResult(results, q) {
  if (!Array.isArray(results) || !results.length) return null;
  let best = null, bestScore = -1;
  for (const r of results) {
    const s = scoreResult(r, q);
    if (s > bestScore) { bestScore = s; best = r; }
  }
  if (!best || bestScore < 6) return null;
  return best;
}

// Search LRCLIB by artist + title, pick the best hit, return parsed lyrics.
// { ok: true, found: true, synced: [{t, line}], plain } — synced is [] when
// only plain lyrics exist. { ok: true, found: false } when nothing matches.
// { ok: false } on a network/HTTP error (the renderer does not cache those,
// so the next open retries instead of remembering a failure).
async function fetchLyrics(q, opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const ua = opts.userAgent || 'Gumi RPC';
  const query = [q.artist, q.title].filter(Boolean).join(' ').trim();
  if (!query) return { ok: true, found: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetchImpl('https://lrclib.net/api/search?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': ua }, signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    const best = pickLyricsResult(await res.json(), q);
    if (!best) return { ok: true, found: false };
    return { ok: true, found: true, synced: parseLRC(best.syncedLyrics), plain: best.plainLyrics || null };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  } finally { clearTimeout(timer); }
}

module.exports = { parseLRC, pickLyricsResult, fetchLyrics };

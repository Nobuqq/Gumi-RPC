const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, nativeImage } = require('electron');
const { makeCdGif, CD_SIZE } = require('./cdgif');
const { fetchLyrics } = require('./lyrics');
const { readZip } = require('./zipread'); // theme packages: minimal zip reader
const http = require('http');
const crypto = require('crypto');
const { Client } = require('@xhayper/discord-rpc');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
// Auto-updater (electron-updater + GitHub Releases). Guarded so the app still
// starts if the package isn't installed yet (e.g. running from source before
// npm install) — updates simply stay off until it is.
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch {}
// same data folder whether you run with npm start or the installed .exe
app.setPath('userData', path.join(app.getPath('appData'), 'gumi-rpc'));
// Theme packages can play a startup song when the app opens — Chromium
// blocks audio before any user gesture by default, so allow it.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
const ICON = path.join(__dirname, 'build', 'icon.ico');

// Create one app at discord.com/developers/applications and paste its Application ID here.
// It's used for any game that doesn't have its own Client ID.
const DEFAULT_CLIENT_ID = 'PUT_YOUR_GUMI_RPC_APPLICATION_ID_HERE';
const cfgFile = () => path.join(app.getPath('userData'), 'config.json');
const loadCfg = () => { try { return JSON.parse(fs.readFileSync(cfgFile(), 'utf8')); } catch { return {}; } };
const clientId = () => String(loadCfg().clientId || DEFAULT_CLIENT_ID).trim(); // Settings wins over the line above

const dataFile = () => path.join(app.getPath('userData'), 'library.json');
const iconDir = () => path.join(app.getPath('userData'), 'icons');
const load = () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return []; } };
const save = (list) => fs.writeFileSync(dataFile(), JSON.stringify(list, null, 2));

let win, rpc = null, rpcId = null, runningId = null, gameHold = false, manualHold = false, musicState = null, musicTimer = null;

async function clearPresence() {
  if (!rpc) return;
  try { await rpc.user?.clearActivity(); await rpc.destroy(); } catch {}
  rpc = null; rpcId = null;
}

async function connect(id) {
  if (rpc && rpcId !== id) await clearPresence();
  if (!rpc) {
    rpc = new Client({ clientId: id });
    rpc.on('disconnected', () => { rpc = null; rpcId = null; });
    const ready = new Promise((res) => rpc.once('ready', res));
    await rpc.login(); await Promise.race([ready, new Promise((res) => setTimeout(res, 4000))]); rpcId = id;
  }
  if (!rpc.user) throw new Error('connected, but Discord never finished saying hello');
  return rpc.user;
}
const validId = (id) => /^\d{15,25}$/.test(id);
const pad = (s) => (s && s.length >= 2 ? s : undefined); // Discord needs 2+ characters
// Discord only shows two kinds of pictures: an asset name uploaded in the
// Developer Portal (e.g. "cd", no file extension), or a direct https link.
// A local file path, a file:// link, or "cd.gif" will never show on Discord -
// Discord tries to look it up as an asset and fails silently. Strip the
// extension from asset names and drop local paths, with a log entry.
function normalizeDiscordImage(v) {
  if (!v) return undefined;
  let s = String(v).trim(); if (!s) return undefined;
  if (/^file:\/\//i.test(s) || /^[a-z]:\\/i.test(s) || /^\/[^/]/.test(s)) { log('Discord image ignored (local file path, Discord cannot read your PC): ' + s); return undefined; }
  if (!/^https?:\/\//i.test(s)) s = s.replace(/\.(gif|png|jpg|jpeg|webp)$/i, '').toLowerCase(); // Discord lowercases asset keys
  return s || undefined;
}
const imageKind = (v) => !v ? 'none' : /^https?:\/\//i.test(v) ? 'link' : 'asset';

async function setPresence(game) {
  const id = game.clientId || clientId();
  if (!validId(id)) return { ok: false, error: id.startsWith('PUT_') ? 'Add your Application ID in Settings first.' : 'That Application ID doesn’t look right. It should be a long number.' };
  try {
    const user = await connect(id);
    await user.setActivity({
      details: pad(game.details) || pad(game.name), state: pad(game.state),
      startTimestamp: game.showTimer === false ? undefined : new Date(),
      largeImageKey: normalizeDiscordImage(game.imageKey), largeImageText: game.name,
    });
    return { ok: true };
  } catch (e) {
    rpc = null; rpcId = null;
    return { ok: false, error: 'Couldn’t reach Discord. Open the Discord desktop app (not the browser) and try again. (' + e.message + ')' };
  }
}

// ---- A spinning CD made from the album cover, hosted on catbox.moe so Discord can show it ----
const cdCacheFile = () => path.join(app.getPath('userData'), 'cd-cache.json');
const cdLoad = () => { try { return JSON.parse(fs.readFileSync(cdCacheFile(), 'utf8')); } catch { return {}; } };
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const note = (msg) => win?.webContents.send('toast', msg);
const cdByReq = new Map(), cdByArt = new Map(), cdDone = new Map(); let cdCooldown = 0;
const coverByReq = new Map(), coverByArt = new Map(), coverDone = new Map(); // the still cover (CD Rich Presence off), same shape as the CD maps
const cdKey = (m) => (m.coverFile ? 'c|' + m.coverFile : 'f|' + m.file);

async function getArt(m) { // the album's own cover picture, else the picture inside the song file
  try {
    let buf = m.coverFile && fs.existsSync(m.coverFile) ? fs.readFileSync(m.coverFile) : null;
    if (!buf) { const p = (await readTags(m.file, true)).common.picture?.[0]; if (p) buf = Buffer.from(p.data); }
    const img = buf && nativeImage.createFromBuffer(buf);
    return img && !img.isEmpty() ? { key: sha1(buf), img } : null;
  } catch { return null; }
}
function toRgba(img) { // square-crop, shrink, and put the colors in R,G,B,A order
  const { width, height } = img.getSize(), s = Math.min(width, height);
  const bmp = img.crop({ x: (width - s) >> 1, y: (height - s) >> 1, width: s, height: s }).resize({ width: CD_SIZE, height: CD_SIZE, quality: 'best' }).toBitmap();
  const out = new Uint8Array(bmp.length), swap = process.platform !== 'linux'; // Windows and Mac hand us B,G,R,A
  // Composite over black instead of forcing alpha to 255: a cover with
  // transparent areas (e.g. a PNG embedded in a song file) stores white
  // (255,255,255) under the transparent pixels, so the old code turned
  // those areas opaque white on the disc — a half-white CD. Blending
  // towards black makes transparent areas black, like the disc itself.
  // Opaque covers (JPEG, RGB PNG) have alpha 255 everywhere, so this
  // changes nothing for them.
  for (let i = 0; i < bmp.length; i += 4) { const a = bmp[i + 3] / 255;
    out[i] = bmp[i + (swap ? 2 : 0)] * a; out[i + 1] = bmp[i + 1] * a; out[i + 2] = bmp[i + (swap ? 0 : 2)] * a; out[i + 3] = 255; }
  return out;
}
async function uploadGif(buf, name) {
  const fd = new FormData(); fd.append('reqtype', 'fileupload'); fd.append('fileToUpload', new Blob([buf], { type: 'image/gif' }), name + '.gif');
  const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd }), t = (await r.text()).trim();
  if (!r.ok || !/^https:\/\//.test(t)) throw new Error(t.slice(0, 80) || 'upload failed');
  // Verify the file actually arrived whole: the "cross the line" CD
  // (vz0fif.gif) was stored on catbox as a 16 KB truncated file — only
  // the top half of the first frame — so Discord showed "?" for it, and
  // re-uploading the same file kept returning that same broken link.
  // If the stored size doesn't match what we sent, the upload was cut
  // off and the link is no good.
  try { const h = await fetch(t, { method: 'HEAD' });
    const len = +(h.headers.get('content-length') || 0);
    if (len && len !== buf.length) throw new Error('upload came back short (' + len + ' of ' + buf.length + ' bytes)');
  } catch (e) { if (/came back short/.test(e.message)) throw e; /* a HEAD check failing is not proof the upload failed — keep the link */ }
  return t;
}
function cdUrl(m) { // resolves to the hosted GIF link, or null if there's no cover / something went wrong
  if (Date.now() < cdCooldown) return Promise.resolve(null);
  const rk = cdKey(m);
  if (!cdByReq.has(rk)) cdByReq.set(rk, (async () => {
    const art = await getArt(m); if (!art) return null;
    // Albums that already have a cached CD need a fresh GIF — the old cache
    // entry would keep serving the old CD forever. A new cache key makes
    // each album remake its CD once, then reuse the new one.
    // |cd6: the file stored on catbox for this album (vz0fif.gif) is only
    // 16,384 bytes — a truncated upload, one partial frame, bottom half
    // white, doesn't spin — and re-uploading the same file kept returning
    // that same broken link. The GIF the app makes from the cover is fine
    // (501 KB, 12 frames, verified), so the upload needs a fresh name to
    // get a fresh link, plus a size check in uploadGif() so a cut-off
    // upload is retried instead of cached.
    const cacheKey = art.key + '|cd6';
    if (cdLoad()[cacheKey]) return cdLoad()[cacheKey];
    if (!cdByArt.has(cacheKey)) cdByArt.set(cacheKey, (async () => {
      const gif = makeCdGif(toRgba(art.img));
      let url = null, lastErr = null;
      for (const suffix of ['-cd6', '-cd6b']) { // fresh name, then one retry under another name
        try { url = await uploadGif(gif, art.key.slice(0, 12) + suffix); break; }
        catch (e) { lastErr = e; }
      }
      if (!url) throw lastErr || new Error('upload failed');
      const cache = cdLoad(); cache[cacheKey] = url; fs.writeFileSync(cdCacheFile(), JSON.stringify(cache)); note('Spinning CD ready!'); return url;
    })());
    return cdByArt.get(cacheKey);
  })().then((u) => { if (u) cdDone.set(rk, u); return u; })
    .catch((e) => { cdCooldown = Date.now() + 60000; cdByReq.clear(); cdByArt.clear(); note('Couldn’t make the spinning CD (' + e.message + '). Using the Gumi CD for now.'); return null; }));
  return cdByReq.get(rk);
}
function toCoverJpeg(img) { // square-crop + shrink to a still cover for Discord
  const { width, height } = img.getSize(), s = Math.min(width, height);
  return img.crop({ x: (width - s) >> 1, y: (height - s) >> 1, width: s, height: s }).resize({ width: 512, height: 512, quality: 'best' }).toJPEG(85);
}
async function uploadCover(buf, name) { // a still cover image to catbox, with the same size check as the GIF upload
  const fd = new FormData(); fd.append('reqtype', 'fileupload'); fd.append('fileToUpload', new Blob([buf], { type: 'image/jpeg' }), name + '.jpg');
  const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd }), t = (await r.text()).trim();
  if (!r.ok || !/^https:\/\//.test(t)) throw new Error(t.slice(0, 80) || 'upload failed');
  try { const h = await fetch(t, { method: 'HEAD' }); const len = +(h.headers.get('content-length') || 0); if (len && len !== buf.length) throw new Error('upload came back short (' + len + ' of ' + buf.length + ' bytes)'); } catch (e) { if (/came back short/.test(e.message)) throw e; }
  return t;
}
function coverUrl(m) { // the regular album cover as a still image, for when CD Rich Presence is off
  if (Date.now() < cdCooldown) return Promise.resolve(null);
  const rk = cdKey(m);
  if (!coverByReq.has(rk)) coverByReq.set(rk, (async () => {
    const art = await getArt(m); if (!art) return null;
    const cacheKey = art.key + '|cover';
    if (cdLoad()[cacheKey]) return cdLoad()[cacheKey];
    if (!coverByArt.has(cacheKey)) coverByArt.set(cacheKey, (async () => {
      const url = await uploadCover(toCoverJpeg(art.img), art.key.slice(0, 12) + '-cover');
      const cache = cdLoad(); cache[cacheKey] = url; fs.writeFileSync(cdCacheFile(), JSON.stringify(cache)); return url;
    })());
    return coverByArt.get(cacheKey);
  })().then((u) => { if (u) coverDone.set(rk, u); return u; })
    .catch((e) => { cdCooldown = Date.now() + 60000; coverByReq.clear(); coverByArt.clear(); return null; }));
  return coverByReq.get(rk);
}

// "Listening to..." while no game is running
// Layout, top to bottom on Discord:
//   Listening to {name}   <- artist, if Discord uses the name we send;
//                            if it ignores it, it falls back to "Gumi RPC"
//   {title}               <- song name (details)
//   by {artist} • {album} <- artist AND album in one line, so the artist is
//                            still visible even when Discord ignores `name`
// The artist must not live only in `name`: in the previous version it did,
// and when Discord ignored it the artist vanished, leaving only the song
// title and the album — and for the track "cross the line" (album also
// "cross the line") that read as the album name twice.
// largeImageText is the tooltip on the CD picture, so it shows the song
// name, not the album again.
const musicActivity = (m, image) => { const artist = pad(m.artist), album = pad(m.album);
  const state = artist && album ? 'by ' + artist + ' • ' + album : artist ? 'by ' + artist : album || undefined;
  return { type: 2,
    name: m.artistName === false ? undefined : artist || undefined,
    details: pad(m.title) || 'Unknown song', state,
    startTimestamp: new Date(m.start), endTimestamp: m.end ? new Date(m.end) : undefined,
    largeImageKey: normalizeDiscordImage(image), largeImageText: pad(m.title) || undefined }; };
const logFile = () => path.join(app.getPath('userData'), 'gumi-log.txt');
const log = (msg) => { try { fs.appendFileSync(logFile(), new Date().toISOString() + '  ' + msg + '\n'); } catch {} };
let lastWarn = 0;
const warn = (msg) => { log(msg); if (Date.now() - lastWarn > 10000) { lastWarn = Date.now(); note(msg); } };

let musicRefreshTimer = null; // one delayed re-send of the music activity, see below
async function applyMusic() {
  clearTimeout(musicRefreshTimer);
  if (gameHold) return;
  if (!musicState) { if (rpc && !manualHold) { try { await rpc.user?.clearActivity(); } catch {} } return; }
  if (!validId(clientId())) return warn('Music can’t show on Discord yet: add your Application ID in Settings.');
  manualHold = false;
  try {
    const m = musicState, user = await connect(clientId());
    // CD Rich Presence on: the spinning CD from the album cover.
    // Off: the regular album cover as a still image (uploaded once, cached).
    // Either way, if the picture isn't ready yet, wait for it (up to 8
    // seconds) instead of sending the fallback 'cd' first — if that asset
    // was never uploaded in the Developer Portal, Discord shows a "?" for
    // those first seconds, and the picture arriving later looks like the
    // song "doesn't showcase anything" at all. Waiting means the first
    // thing Discord sees is the right picture. If it takes longer than
    // 8 s, or there's no cover, fall back to 'cd' as before — and the
    // picture still arrives later via the promise below.
    let first = m.image, cdPromise = null, coverPromise = null;
    if (m.cdSpin) {
      first = cdDone.get(cdKey(m)) || m.image;
      if (m.file && !cdDone.has(cdKey(m))) {
        cdPromise = cdUrl(m).catch(() => null);
        const url = await Promise.race([cdPromise, new Promise((r) => setTimeout(() => r(null), 8000))]);
        if (url && !gameHold && musicState && musicState.file === m.file) first = url;
      }
    } else if (m.file) {
      first = coverDone.get(cdKey(m)) || m.image;
      if (!coverDone.has(cdKey(m))) {
        coverPromise = coverUrl(m).catch(() => null);
        const url = await Promise.race([coverPromise, new Promise((r) => setTimeout(() => r(null), 8000))]);
        if (url && !gameHold && musicState && musicState.file === m.file) first = url;
      }
    }
    if (gameHold || !musicState || musicState.file !== m.file) return;
    const act = musicActivity(m, first); await user.setActivity(act); log('music status sent, name: ' + (act.name || 'Gumi RPC (app default)') + ', details: ' + act.details + ', state: ' + (act.state || '-') + ', picture: ' + (first || 'none') + ' (' + imageKind(normalizeDiscordImage(first)) + ')' + (imageKind(normalizeDiscordImage(first)) === 'asset' ? ' - must be uploaded as an Art Asset with exactly that name; Discord shows assets as still pictures' : '')); // the album CD if it was ready, else the Gumi CD until it is
    // Discord's image proxy sometimes fails to fetch the picture link on
    // the first try — even after waiting for it — and then keeps showing
    // "?" until the activity is sent again. Switching songs manually
    // worked around that, because each switch re-sent the activity and
    // Discord retried the fetch. Do the same thing automatically: re-send
    // this exact activity once, 5 seconds later, if the same song is still
    // playing. That gives Discord a second fetch attempt without the user
    // having to switch songs. Only for hosted picture links, not the
    // fallback asset (which Discord already has or hasn't, no retry helps).
    if (typeof first === 'string' && /^https:\/\//.test(first)) {
      musicRefreshTimer = setTimeout(async () => {
        if (gameHold || !musicState || musicState.file !== m.file) return;
        try { await (await connect(clientId())).setActivity(musicActivity(musicState, first)); log('music status re-sent so Discord retries the picture'); }
        catch {}
      }, 5000);
    }
    const sendLater = (promise, label) => { if (!promise) return; promise.then(async (url) => {
      if (!url || url === first || gameHold || !musicState || musicState.file !== m.file) return;
      try { await (await connect(clientId())).setActivity(musicActivity(musicState, url)); log(label + ' sent: ' + url); }
      catch (e) { warn('Discord wouldn’t take the ' + label + ' picture: ' + e.message); }
    }); };
    sendLater(cdPromise, 'album CD');
    sendLater(coverPromise, 'album cover');
  } catch (e) { rpc = null; rpcId = null; warn('Discord music status failed: ' + e.message); }
}
ipcMain.handle('config:get', () => ({ clientId: loadCfg().clientId || '' }));
ipcMain.handle('config:set', async (_e, raw) => {
  const id = String(raw || '').trim();
  if (id && !validId(id)) return { ok: false, error: 'An Application ID is a long number (about 18 digits). Copy it from the General Information page.' };
  const c = loadCfg(); if (id) c.clientId = id; else delete c.clientId;
  fs.writeFileSync(cfgFile(), JSON.stringify(c)); await clearPresence(); applyMusic(); return { ok: true };
});
ipcMain.handle('log:open', () => { try { fs.appendFileSync(logFile(), ''); } catch {} return shell.openPath(logFile()); });
ipcMain.handle('music:presence', (_e, m) => { musicState = m; clearTimeout(musicTimer); musicTimer = setTimeout(applyMusic, 500); return true; });
ipcMain.handle('music:diag', () => {
  if (!musicState) return { image: null, kind: 'none' };
  const img = (musicState.cdSpin && cdDone.get(cdKey(musicState))) || musicState.image;
  return { image: normalizeDiscordImage(img) || null, kind: imageKind(normalizeDiscordImage(img)), cdSpin: !!musicState.cdSpin, cdReady: !!cdDone.get(cdKey(musicState)) };
});

// ---- Gumi Remote: a tiny HTTP API so the Gumi Discord bot (running on
// this same PC) can ask what is playing and control the player. Phase 1
// is local only: the server binds to 127.0.0.1, so nothing here can be
// reached from another computer, and requests from any other address
// are refused anyway. The player itself lives in the renderer
// (index.html), so the main process asks it over IPC and waits for the
// answer — see askRenderer() and the 'gumi:remote' handler in the page.
const REMOTE_PORT = 3742;
const remotePending = new Map(); // request id -> function that finishes it
let remoteSeq = 0;
function askRenderer(action) {
  // Ask the window to do something (or report its state) and wait for the
  // reply. If the window is gone, or doesn't answer within 3 seconds,
  // give up instead of hanging the bot's request forever.
  return new Promise((resolve) => {
    if (!win) return resolve({ ok: false, error: 'The app window is not open.' });
    const id = 'r' + (++remoteSeq);
    const timer = setTimeout(() => { remotePending.delete(id); resolve({ ok: false, error: 'The player did not answer in time.' }); }, 3000);
    remotePending.set(id, (result) => { clearTimeout(timer); resolve({ ok: true, ...result }); });
    win.webContents.send('gumi:remote', { id, action });
  });
}
ipcMain.handle('gumi:remote-reply', (_e, msg) => { // the renderer answering askRenderer()
  const done = msg && remotePending.get(msg.id);
  if (done) { remotePending.delete(msg.id); done(msg.result || {}); }
  return true;
});
function remoteApiHandler(req, res) {
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
  if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') return send(403, { ok: false, error: 'Local connections only.' });
  const u = new URL(req.url, 'http://127.0.0.1');
  const route = async () => {
    if (req.method === 'GET' && u.pathname === '/status') {
      const s = await askRenderer('state');
      if (!s.ok) return send(503, s);
      return send(200, { ok: true, app: 'gumi-rpc', version: app.getVersion(), ...s });
    }
    if (req.method === 'GET' && u.pathname === '/nowplaying') {
      const s = await askRenderer('state');
      if (!s.ok) return send(503, s);
      return send(200, { ok: true, ...s });
    }
    const action = req.method === 'POST' && { '/pause': 'pause', '/play': 'play', '/next': 'next', '/previous': 'previous' }[u.pathname];
    if (action) {
      const s = await askRenderer(action);
      if (!s.ok) return send(503, s);
      return send(200, { ok: true, ...s });
    }
    return send(404, { ok: false, error: 'Unknown route: ' + req.method + ' ' + u.pathname });
  };
  route().catch((e) => send(500, { ok: false, error: e.message || String(e) }));
}
function startRemoteApi() {
  const srv = http.createServer(remoteApiHandler);
  srv.on('error', (e) => log('Gumi Remote API could not start (port ' + REMOTE_PORT + '): ' + e.message));
  srv.listen(REMOTE_PORT, '127.0.0.1', () => log('Gumi Remote API listening on 127.0.0.1:' + REMOTE_PORT));
}

// Find .exe files, skipping installers/crash handlers; biggest first (usually the game).
const JUNK = /(unins|uninstall|crash|redist|vcredist|dxsetup|dotnet|helper|updater|setup|ue4prereq)/i;
function scanExes(dir, depth = 3, out = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0 && e.name !== 'node_modules') scanExes(full, depth - 1, out);
    else if (e.isFile() && /\.exe$/i.test(e.name) && !JUNK.test(e.name)) {
      out.push({ name: e.name, path: full, size: fs.statSync(full).size });
    }
  }
  return out.sort((a, b) => b.size - a.size);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 980, minHeight: 620, title: 'Gumi RPC', frame: false, icon: fs.existsSync(ICON) ? ICON : undefined,
    backgroundColor: '#2b0f6b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.loadFile('index.html');
}

ipcMain.handle('library:get', () => load());
ipcMain.handle('game:save', (_e, game) => {
  const list = load(); const i = list.findIndex((g) => g.id === game.id);
  if (i >= 0) list[i] = game; else list.push(game);
  save(list); return true;
});
ipcMain.handle('game:delete', (_e, id) => { save(load().filter((g) => g.id !== id)); return true; });

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  if (r.canceled) return null;
  return { dir: r.filePaths[0], exes: scanExes(r.filePaths[0]) };
});
ipcMain.handle('dialog:exe', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Programs', extensions: ['exe'] }] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:font', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Fonts', extensions: ['ttf', 'otf', 'woff', 'woff2'] }] });
  if (r.canceled) return null;
  const dir = path.join(app.getPath('userData'), 'fonts'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, Date.now() + '-' + path.basename(r.filePaths[0]));
  fs.copyFileSync(r.filePaths[0], dest); return dest;
});
ipcMain.handle('dialog:icon', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] });
  if (r.canceled) return null;
  fs.mkdirSync(iconDir(), { recursive: true });
  const dest = path.join(iconDir(), Date.now() + path.extname(r.filePaths[0]));
  fs.copyFileSync(r.filePaths[0], dest); // keep our own copy so moving the original can't break it
  return dest;
});
ipcMain.handle('dialog:sound', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Sounds', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'flac'] }] });
  if (r.canceled) return null;
  const dir = path.join(app.getPath('userData'), 'sfx'); fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, Date.now() + '-' + path.basename(r.filePaths[0]));
  fs.copyFileSync(r.filePaths[0], dest); // keep our own copy so moving the original can't break it
  return dest;
});
// Theme packages: pick a .zip/.gumipack, read its manifest.json, and
// unpack the files it names into the app data folder (themes/<id>/), so
// moving or deleting the package file can't break the theme. Only the
// files the manifest names are written, and only inside the package.
ipcMain.handle('theme:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Theme packages', extensions: ['zip', 'gumipack'] }] });
  if (r.canceled) return null;
  try {
    const files = readZip(fs.readFileSync(r.filePaths[0]));
    const manifestRaw = files.get('manifest.json');
    if (!manifestRaw) return { ok: false, error: 'No manifest.json in that package.' };
    const m = JSON.parse(manifestRaw.toString('utf8'));
    if (m.format !== 'gumi-theme' || m.version !== 1) return { ok: false, error: 'That is not a Gumi theme package.' };
    if (!m.id || !m.name || !m.image) return { ok: false, error: 'The package manifest is missing an id, a name, or a wallpaper.' };
    if (!/^[a-z0-9][a-z0-9-]*$/.test(m.id)) return { ok: false, error: 'The package id must be lowercase letters, numbers and dashes.' };
    const pick = (rel) => {
      if (!rel) return null;
      const clean = String(rel).replace(/\\/g, '/');
      if (clean.startsWith('/') || clean.includes('..')) return null;
      return files.get(clean) || null;
    };
    if (!pick(m.image)) return { ok: false, error: 'The package is missing its wallpaper file.' };
    const dir = path.join(app.getPath('userData'), 'themes', m.id);
    fs.mkdirSync(dir, { recursive: true });
    const out = {};
    const save = (rel) => {
      const data = pick(rel); if (!data) return null;
      const clean = String(rel).replace(/\\/g, '/');
      const dest = path.join(dir, clean);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
      return dest;
    };
    out.image = save(m.image);
    for (const k of ['sidebarPic', 'click', 'themeMusic', 'font', 'css', 'wallpaperIntro']) { const d = save(m[k]); if (d) out[k] = d; }
    if (Array.isArray(m.themeMusicList)) { const ds = m.themeMusicList.map((rel) => save(rel)).filter(Boolean); if (ds.length) out.themeMusicList = ds; }
    if (m.icons) { out.icons = {}; for (const [k, rel] of Object.entries(m.icons)) { const d = save(rel); if (d) out.icons[k] = d; } if (!Object.keys(out.icons).length) delete out.icons; }
    if (m.mascot) { const d = save(m.mascot); if (d) out.mascot = d; }
    return { ok: true, manifest: m, files: out };
  } catch (e) { return { ok: false, error: 'Could not read that package: ' + e.message }; }
});

ipcMain.handle('presence:set', async (_e, id) => { const g = load().find((x) => x.id === id); if (!g) return { ok: false, error: 'Game not found.' }; const r = await setPresence(g); manualHold = r.ok; return r; });
ipcMain.handle('presence:clear', async () => { runningId = null; gameHold = false; manualHold = false; await clearPresence(); applyMusic(); return true; });

ipcMain.handle('game:launch', async (_e, id) => {
  const g = load().find((x) => x.id === id);
  if (!g) return { ok: false, error: 'Game not found.' };
  if (!fs.existsSync(g.exe)) return { ok: false, error: 'Can’t find the .exe. Did you move the game folder?' };
  const child = spawn(g.exe, [], { cwd: path.dirname(g.exe), detached: true, stdio: 'ignore' });
  child.on('error', (err) => { if (runningId === id) { runningId = null; gameHold = false; } win?.webContents.send('game:closed', { id, error: err.message }); applyMusic(); });
  child.on('exit', async () => {
    if (runningId === id) { runningId = null; gameHold = false; await clearPresence(); win?.webContents.send('game:closed', { id }); applyMusic(); }
  });
  child.unref();
  runningId = id; gameHold = true;
  return { ok: true, presence: await setPresence(g) };
});

ipcMain.handle('win:min', () => win.minimize());
ipcMain.handle('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.handle('win:close', () => win.close());

// ---- Discord sign-in: OAuth2 with PKCE (no secret). Your Discord app must be a Public Client. ----
const PORT = 53682, REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const authFile = () => path.join(app.getPath('userData'), 'discord-login.bin');
const b64u = (b) => b.toString('base64url');
const noId = () => clientId().startsWith('PUT_');
let signing = false;

async function tokenCall(params) {
  const r = await fetch('https://discord.com/api/oauth2/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...params }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || j.error || 'Discord refused the sign-in');
  return j;
}
function keepLogin(t) { // only the refresh token is saved, encrypted by Windows
  try { if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(authFile(), safeStorage.encryptString(t.refresh_token)); } catch {}
}
async function discordProfile(accessToken) {
  const r = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!r.ok) throw new Error('Couldn’t read your Discord profile');
  const u = await r.json();
  return { name: u.global_name || u.username,
    avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png` };
}
function waitForCode(state) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { srv.close(); reject(new Error('Sign-in timed out. Try again.')); }, 120000);
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT); if (u.pathname !== '/callback') { res.writeHead(404).end(); return; }
      const code = u.searchParams.get('state') === state && u.searchParams.get('code');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<body style="font-family:sans-serif;background:#0a0b18;color:#e8eaf8;text-align:center;padding-top:20vh"><h1>${code ? 'You’re signed in!' : 'Sign-in didn’t finish'}</h1><p>You can close this tab and head back to Gumi RPC.</p></body>`);
      clearTimeout(timer); srv.close(); srv.closeAllConnections?.();
      code ? resolve(code) : reject(new Error('Sign-in was cancelled.'));
    });
    srv.on('error', (e) => { clearTimeout(timer); reject(new Error('Port ' + PORT + ' is busy: ' + e.message)); });
    srv.listen(PORT, '127.0.0.1');
  });
}
ipcMain.handle('auth:signin', async () => {
  if (noId()) return { ok: false, error: 'Add your Application ID in Settings first.' };
  if (signing) return { ok: false, error: 'Sign-in is already open in your browser.' };
  signing = true;
  try {
    const verifier = b64u(crypto.randomBytes(48)), state = b64u(crypto.randomBytes(16));
    const waiting = waitForCode(state);
    await shell.openExternal('https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: clientId(),
      response_type: 'code', redirect_uri: REDIRECT, scope: 'identify', state,
      code_challenge: b64u(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256' }));
    const t = await tokenCall({ grant_type: 'authorization_code', code: await waiting, redirect_uri: REDIRECT, code_verifier: verifier });
    keepLogin(t); return { ok: true, profile: await discordProfile(t.access_token) };
  } catch (e) { return { ok: false, error: e.message }; } finally { signing = false; }
});
ipcMain.handle('auth:restore', async () => {
  try {
    if (noId() || !fs.existsSync(authFile())) return null;
    const t = await tokenCall({ grant_type: 'refresh_token', refresh_token: safeStorage.decryptString(fs.readFileSync(authFile())) });
    keepLogin(t); return await discordProfile(t.access_token);
  } catch { return null; }
});
ipcMain.handle('auth:signout', () => { try { fs.unlinkSync(authFile()); } catch {} return true; });

const loginOpts = () => ({ path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
ipcMain.handle('startup:get', () => app.getLoginItemSettings(loginOpts()).openAtLogin);
ipcMain.handle('startup:set', (_e, on) => {
  app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() });
  return app.getLoginItemSettings(loginOpts()).openAtLogin;
});

// ---- Music library ----
const musicFile = () => path.join(app.getPath('userData'), 'music.json');
const AUDIO = /\.(mp3|wav|ogg|oga|flac|m4a|aac|opus)$/i;
ipcMain.handle('music:get', () => { try { return JSON.parse(fs.readFileSync(musicFile(), 'utf8')); } catch { return { tracks: [], playlists: [] }; } });
ipcMain.handle('music:save', (_e, lib) => { fs.writeFileSync(musicFile(), JSON.stringify(lib)); return true; });
function scanAudio(dir, depth = 3, out = []) {
  let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) scanAudio(full, depth - 1, out);
    else if (e.isFile() && AUDIO.test(e.name)) out.push(full);
  }
  return out;
}
let mm = null; // music-metadata is optional: without it we fall back to the file name
async function readTags(file, covers) {
  mm ??= await import('music-metadata');
  return mm.parseFile(file, { skipCovers: !covers, duration: false });
}
ipcMain.handle('music:import', async (_e, mode) => {
  const r = await dialog.showOpenDialog(win, mode === 'folder' ? { properties: ['openDirectory'] }
    : { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus'] }] });
  if (r.canceled) return null;
  const files = mode === 'folder' ? scanAudio(r.filePaths[0]).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : r.filePaths;
  const album = mode === 'folder' && files.length ? { id: crypto.randomUUID(), name: path.basename(r.filePaths[0]), cover: '' } : null;
  const tracks = [];
  for (const file of files) {
    const base = path.basename(file).replace(/\.[^.]+$/, ''), parts = base.split(' - ');
    const t = { id: crypto.randomUUID(), path: file, title: parts.length > 1 ? parts.slice(1).join(' - ') : base, artist: parts.length > 1 ? parts[0] : '', no: 0 };
    if (album) t.albumId = album.id;
    try {
      const c = (await readTags(file, !!album && !album.cover)).common;
      if (c.title) t.title = c.title; if (c.artist) t.artist = c.artist; t.no = c.track?.no || 0;
      const pic = c.picture?.[0]; // the album cover = the first embedded picture we find
      if (album && !album.cover && pic) {
        const dir = path.join(app.getPath('userData'), 'covers'); fs.mkdirSync(dir, { recursive: true });
        album.cover = path.join(dir, album.id + (/png/.test(pic.format) ? '.png' : '.jpg')); fs.writeFileSync(album.cover, pic.data);
      }
    } catch {}
    tracks.push(t);
  }
  if (album) tracks.sort((a, b) => (a.no || 999) - (b.no || 999));
  return { album, tracks };
});
ipcMain.handle('music:bytes', (_e, f) => fs.readFileSync(f));
ipcMain.handle('dialog:pics', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] });
  if (r.canceled) return [];
  fs.mkdirSync(iconDir(), { recursive: true });
  return r.filePaths.map((f, i) => { const d = path.join(iconDir(), `bg${Date.now()}_${i}${path.extname(f)}`); fs.copyFileSync(f, d); return d; });
});
ipcMain.handle('music:cover', async (_e, file) => {
  try {
    const p = (await readTags(file, true)).common.picture?.[0]; if (!p) return null;
    return `data:${p.format};base64,${Buffer.from(p.data).toString('base64')}`;
  } catch { return null; }
});
// Lyrics (LRCLIB, free, no key): search by artist + title in the main
// process so the page never has to deal with CORS. Fetches in the
// background, never blocks playback; the renderer caches the result.
ipcMain.handle('lyrics:get', async (_e, q) => fetchLyrics(q || {}, { userAgent: 'Gumi RPC/' + app.getVersion() }));

// ---- Self-updates from GitHub Releases (Nobuqq/Gumi-RPC) ----
// Only the installed app updates itself: in the test version (npm start)
// there is no release to compare against, so the updater stays off.
function setupUpdates() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-available', () => note('A Gumi RPC update is downloading in the background…'));
  autoUpdater.on('update-downloaded', () => { win?.webContents.send('update:ready'); note('Update downloaded — restart Gumi RPC to install it.'); });
  autoUpdater.on('error', (e) => log('Update check failed: ' + (e && e.message ? e.message : e)));
  autoUpdater.checkForUpdates().catch((e) => log('Update check failed: ' + (e && e.message ? e.message : e)));
}
ipcMain.handle('update:check', () => new Promise((resolve) => {
  if (!autoUpdater) return resolve({ ok: false, error: 'The updater is not installed yet. Run npm install, then rebuild the installer.' });
  if (!app.isPackaged) return resolve({ ok: false, error: 'Updates only work in the installed app — this is the test version (npm start).' });
  const done = (r) => { autoUpdater.removeListener('update-available', onAvail); autoUpdater.removeListener('update-not-available', onNone); autoUpdater.removeListener('error', onErr); resolve(r); };
  const onAvail = () => done({ ok: true, update: true });
  const onNone = () => done({ ok: true, update: false });
  const onErr = (e) => done({ ok: false, error: e && e.message ? e.message : String(e) });
  autoUpdater.once('update-available', onAvail);
  autoUpdater.once('update-not-available', onNone);
  autoUpdater.once('error', onErr);
  autoUpdater.checkForUpdates().catch((e) => done({ ok: false, error: e && e.message ? e.message : String(e) }));
}));
ipcMain.handle('update:restart', () => { if (autoUpdater) autoUpdater.quitAndInstall(); return true; });
ipcMain.handle('app:version', () => app.getVersion());
// Patch notes: Brandon writes them in patch-notes.json (next to
// package.json), and the little notepad at the top right of the app
// shows them so anyone can re-read any version at any time. The
// release script writes new entries into this file when it ships.
ipcMain.handle('app:patchNotes', () => {
  try {
    const p = path.join(__dirname, 'patch-notes.json');
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
});
// Developer / Showcasing mode is dev-copy only: it only exists when a
// marker file called `dev-mode` (no extension, contents don't matter)
// sits in %APPDATA%\gumi-rpc. A public install never has that file, so
// the mode never appears there. Brandon creates the file once on his
// dev copy to unlock the toggle in Settings.
ipcMain.handle('dev:isDev', () => { try { return fs.existsSync(path.join(app.getPath('userData'), 'dev-mode')); } catch { return false; } });

app.whenReady().then(() => { app.setAppUserModelId('com.gumi.rpc'); createWindow(); setupUpdates(); startRemoteApi(); });
app.on('before-quit', () => { clearPresence(); });
app.on('window-all-closed', () => app.quit());

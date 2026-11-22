# Gumi RPC

## Run it
1. Install Node.js (nodejs.org), then in this folder: `npm install` then `npm start`
2. Make an installer (.exe): `npm run build`

## Discord setup (one time)
1. Go to discord.com/developers/applications, click New Application, name it "Gumi RPC".
2. Copy the Application ID and paste it into `DEFAULT_CLIENT_ID` at the top of `main.js`.
3. Keep the Discord desktop app open while using Gumi RPC.

Tip: the name Discord shows after "Playing" is the Discord application's name.
For "Playing My Cool Game", make a Discord application with that name and paste its
Application ID into that game's "Discord Application ID" box.

## Customize (the Customize tab in the sidebar)
- Themes: tap any built-in theme (Neutral / Light / Midnight / Custom) or any of your
  "My themes" to switch to it. Switching never deletes a theme — only the small X on
  a theme card deletes that one theme.
- My themes: "+ Add theme from picture" makes a theme from a picture. The whole
  interface takes its colours from the picture — background, panels, text, accent
  and the rest — so the app looks like the theme. Each theme also has its own
  accent colour (the colour picker on its card). Best picture ratio is 16:9
  (1920x1080). If a picture does not fit, use the editor under the themes: Fit
  (Cover fills the box and crops the edges, Contain shows the whole picture),
  Position, Zoom, and Picture ratio.
- Fonts: "Choose font file" picks a .ttf / .otf / .woff file, and the size slider
  changes the font size. "Reset font" goes back to the default.
- Colours: there are no colour pickers any more — the theme sets every colour
  itself (background, panels, text, accent and the rest), and the app checks
  that the text stays readable on every part, so a theme can never make the
  text unreadable.
- Icons: the sidebar Games / Music / Settings icons are now your custom silhouettes
  (`assets/icons/games.png`, `music.png`, `settings.png` — black shapes on a
  transparent background, used as a mask). "Icon colour" recolours all three.
- Neon glow: a toggle that adds a glow to titles and buttons.
- Accent everywhere: a theme's accent colour now also tints the boxes — theme cards, song and playlist rows, and the player — so the whole app matches the picture.
- Sound effects: in Customize, each sound (Click, Launch) has its own row. "Choose file" picks your own sound file for it (it gets copied into the app's data folder, so moving the original won't break it), the slider sets its volume to anything from 0 to 100 (0 silences that sound), and hovering a row plays it so you can hear it. "Reset" goes back to the built-in sound at volume 60.
- Theme music: a theme that brings its own startup song shows a "Theme music" toggle in its editor (under the themes). On, the song plays once when the app opens with that theme; it stops as soon as you play a song of your own. Off, it never plays.

## Theme packages
A theme can be more than a picture — it can be a whole package that
bundles everything for a look:
- `image` — the wallpaper (best at 1920x1080, 16:9)
- `sidebarPic` — a picture for the sidebar
- `icons.games` / `icons.music` — pictures that replace the Games and Music sidebar icons (the Settings icon always stays the default silhouette)
- `mascot` — a picture that replaces Gumi wherever he appears, only while the theme is on
- `click` — a sound file that replaces the click sound while the theme is on (your own volume setting still applies)
- `themeMusic` — a song that plays when the app opens with the theme; it loops with fades (the last 3 seconds fade out, 3 seconds of silence, then it starts again fading in over 2 seconds). It stops as soon as you play a song, picks back up when you pause one, and the "Theme music" toggle in the theme editor turns it off. A theme can instead carry `themeMusicList` — a list of songs that rotate, moving to the next one each time a track ends (pausing still resumes the same track). The same toggle also sits in the footer next to Ask Gumi whenever the active theme has theme music — on it glows, off it goes dim with a slash through the note.
- `themeMusicShuffle` — true makes a `themeMusicList` play in a shuffled order instead of in order: a fresh shuffle each time the list runs out, and never the same song twice in a row across rounds (so it never feels like the same song every time). A single `themeMusic` file is unaffected — there is nothing to shuffle. While any theme music is playing, the footer shows "♪ <song name>" next to the theme music toggle, taken from the file name; it hides whenever the theme music stops (a user song starts, the toggle goes off, the theme changes to one with no music).
- `bubble` — true makes the boxes look like actual bubbles: very clear (30% panel, blurred), a bright highlight across the top, a bright rim and a faint glow along the bottom, so the wallpaper shows through. In bubble mode the mini player's pause/skip buttons become glossy aqua capsules built from the theme's cyan, with white icons; the big player's controls are unchanged. The small muted descriptions are also pulled toward the text colour with a soft dark shadow, so they stay readable over bright wallpaper.
- `hud` — true makes the boxes look like a game menu HUD instead: solid deep panels with a bright cyan border and square-ish corners (Sonic Colors uses this, styled after its PRESS START bar), with the transport buttons and lyrics mic matching the menu buttons. In HUD mode, hovering anything gives it a bright yellow outer rim and glow, like the selected button in the game
- `font` — a font file (woff2/ttf/otf) the theme brings for its own display type. While the theme is on, headings, buttons, nav items, song rows and theme cards use it; the small descriptions keep the normal font. It goes away with the theme, and the user's own picked font (Customize > Font) still works underneath it
- `css` — a stylesheet the theme brings to rebuild the whole interface (Sonic Colors uses this: the games shelf becomes a Stage Select grid, the music view becomes a Sound Test, the player becomes the in-game HUD). It loads only while the theme is on and goes away with it. Scope every rule under `body[data-themeid="<id>"]` so it can never leak into another theme — the app sets that attribute from the theme's id when it applies
- `wallpaperIntro` + `wallpaperIntroMs` — a short splash (a GIF or image) that plays once when the app opens or the theme begins, then hands over to the looping `image` wallpaper after `wallpaperIntroMs` milliseconds (3000 if omitted). Persona 3 uses this: a 3-second white flash + plunge, then the looping underwater wallpaper. It only plays when the theme itself changes — switching settings while the theme is already on does not replay it. The splash's last frame should match the loop's first frame so the handoff is seamless. **Two things make the handoff actually seamless (0.1.37):** the intro GIF must play ONCE (no loop extension — it holds its last frame instead of restarting to its first frame while the timer is still running), and the app preloads BOTH the intro and the loop before starting the timer, so the timer lines up with the intro's real playback and the 10MB loop's first frame is already decoded when the swap happens. A looping intro or an unpreloaded loop both show up as a visible skip at the handoff.
- the app also provides a `#selbar` element in the sidebar — one bar that the app keeps parked on the active nav item. It is hidden unless a theme's CSS shows it (`display:block` under `body[data-themeid="<id>"]`), so a theme can turn the sidebar into a title-screen menu with a bar that glides between items. Persona 3 uses this: a royal-blue bar behind the active menu word, with the text turning from hollow to solid white as the bar arrives (a CSS transition delay on the label colour does the timing).
- the palette also drives the button base, the sidebar hover-fill sweep and the background glow wash (all picked from the picture, so no button keeps the old purple), and the spinning CD disc and the Play button's glow follow the palette colours too — in the default theme these are the same purple/blue/cyan as before

Packages live in `assets/themes/<name>/` and appear as a theme in
Customize > My themes. Frutiger Aero (the welcome package that ships
with the app) is the example — it has all of the above, and it is
optional: it never applies itself, you just tap it to try it. Sonic
Colors is Brandon's own theme — HUD boxes, the key art on the sidebar,
its own click sound, seven rotating theme songs, its own display
font (Baloo 2, bundled with its OFL licence in the theme folder), and a
full-interface stylesheet (Stage Select grid, Sound Test, HUD player) — but
it does not ship in the app: it travels as `sonic-colors.gumipack` and
installs through Import, so it stays his until he decides to share it.

A package can also travel as a single file. It is a zip (named
`.gumipack` or `.zip`) with a `manifest.json` at the top and the files
it names next to it. Install one from Customize > My Themes with the
**Import theme package** button — it unpacks into the app data folder
(`%APPDATA%\gumi-rpc\themes\<id>\`), so deleting the package file
afterwards can't break the theme, and it applies itself right away.
The manifest is the theme itself, with file names instead of paths:
`format` must be `"gumi-theme"` and `version` `1`, then `id`
(lowercase letters, numbers and dashes), `name`, `image`, and any of
the fields above. Two more fields a package can carry: `menu` — true
makes the boxes dark translucent menu pills like the Kingdom Hearts
menu — and `cursor` — a colour (for example `"#ff9d00"`) that adds a
little glowing ball beside whatever is selected, gliding to the next
selection: the sidebar nav (ball on the right), the picked game and the
playing song (ball on the left). It fades out while its target is
scrolled out of sight and comes back when it returns. The sidebar
picture also takes `sidebarFit`: `"contain"` shows the whole picture
(a tall emblem in the narrow rail), `"cover"` fills the rail and crops
the edges. If the wallpaper is smaller than 1920x1080 the app still
installs it, but warns you it will look soft fullscreen.

## Your art, font, sounds, mascot
- Font: put it at `assets/fonts/gumi.ttf` (or edit the @font-face line in index.html), or use Customize > Font to pick your own font file in the app
- Sounds: the built-in sounds are `assets/sfx/click.wav` and `launch.wav`. To use your own, go to Customize > Sound effects and pick a file for each sound — the volume slider there sets any volume from 0 (silent) to 100.
- Gumi (the ball mascot): drawn in code by default; drop your own art at `assets/gumi.png` to replace him
- Gumi’s tutorial words: edit the `TOUR` list and `intro()` near the bottom of index.html. The tour walks the Games section first, then switches to the Music view to show off the track list, Add Music and Make Playlist. A step can name a view first (`['music', selector, text]`) and the tour switches views before pointing at it.

## About icons on Discord
The icon you pick in the launcher is shown inside Gumi RPC. Discord can't read files from your PC,
so for the Discord side, type an asset name (uploaded under Rich Presence > Art Assets in the
Developer Portal) or a direct https image link into "Discord image".

## Discord sign-in (the avatar button, bottom-left)
In the Developer Portal, open your Gumi RPC application, then OAuth2:
1. Under Redirects, add `http://127.0.0.1:53682/callback` and save.
2. Turn on "Public Client" and save.
Then click the avatar button in the app and choose "Sign in with Discord". It stays signed in next time you open the app.

## Per-game rich presence (quick version)
1. Make a new Discord application named exactly like the game (its name is what shows after "Playing").
2. Copy its Application ID. In Gumi RPC: Edit game, paste it into "Discord Application ID".
3. In that application: Rich Presence > Art Assets, upload your art, and type its asset name into "Discord image".
4. Discord desktop must be open, with Settings > Activity Privacy > "Share your detected activity" on.

## Music
Music view > "Add Music" picks a folder of songs. Run `npm install` once so song titles, artists and album art can be read.

The player at the bottom grows into a full-width bar in the Music view and shrinks back to a floating pill in the other views. The bar spans only the track list — it starts at the sidebar and stops before the Now Playing panel, so it never covers your profile or the big CD. In pill form you can drag it anywhere on screen (it remembers where you put it — double-click it to put it back in the middle), but it always stays above the footer bar at the bottom, so it can never get stuck behind it. Right-click any song for Play next / Add to queue / Add to playlist, and the queue button in the player (with a count) shows what's up next. The Now Playing panel on the right also has its own Up next list at the bottom, showing the same queued songs — remove one with the ✕ or clear them all — so the queue is on both the mini player and the big player. Playback is gapless: while one song plays, the next one is already loaded in a second player behind the scenes, so it starts the instant the current song ends — no silence between tracks, and no overlap either. It follows the queue, shuffle and loop just like normal playback; if the next song isn't loaded yet (for example you jumped to a different track), it plays the usual way instead. Turn it off in Settings > Gapless playback if you ever want the old behaviour back.

## Lyrics
The little microphone button at the top-left of the Now Playing panel swaps the whole panel to the lyrics for the current song — nothing else in the view, just the lyrics. The lyrics come from LRCLIB (a free lyrics site, no account needed) and are looked up by artist and title. When the lyrics have timestamps, the line being sung lights up big and bright with the lines around it dimmed, moving one line at a time and gliding to stay centred in the panel, and seeking jumps to the right line. Tap a lyric line to jump to that part of the song. Scroll up to look around and the view leaves you alone — once the mouse has sat still for a few seconds it glides back to the line you're on. Tap the microphone again and you're straight back to the player — the button stays put in both views, so you never have to scroll for it. When a song only has plain lyrics, the view says so at the top ("Lyrics aren't synced for this song") and shows the full text without any highlighting. When nothing is found, it says "No lyrics found for this song yet." Once lyrics are found for a song they are saved with your library, so they work offline and are never looked up again — unless the song's title or artist changes.

## Marketplace (coming soon)
The Marketplace tab in the sidebar is ready for when the store opens: theme packs made by other people, with a different picture for each part of the app (background, sidebar, panels) and their own sound effects.

## Make the .exe
1. (Optional) put a 256x256 `icon.ico` in the `build` folder.
2. `npm run pack` makes a quick test copy in `dist/win-unpacked`. `npm run build` makes the installer in `dist/`.
3. If it complains about a symbolic link or privilege, run the terminal as Administrator or turn on Windows Developer Mode.

## Updates
The installed app checks for updates when it opens and downloads them in the background from GitHub Releases (Nobuqq/Gumi-RPC). When one is ready, it tells you — restart the app to install it. You can also check by hand in Settings > Updates ("Check for updates"), which shows your current version too. Updates only work in the installed app, not when running from source with `npm start`.

To ship a new version: bump the version in `package.json`, commit and push, then publish a release from the installer with `npm run release` (needs a GitHub token the first time — see the release steps in the repo). The app only offers an update when the release is newer than the installed version, so the first release just sets the baseline.

## Spinning CD on Discord
1. Developer Portal > your application > Rich Presence > Art Assets > Add Image(s): pick `assets/discord/cd.gif` and name it `cd`.
2. Wait a few minutes, then play a song. If it only shows a still picture, upload the GIF to giphy.com and paste its link into Settings > "Spinning CD picture on Discord".

## What Discord shows while a song plays
Top line: "Listening to [artist]" (Settings > "Show the artist as 'Listening to…'" — Discord falls back to "Gumi RPC" if it ignores the artist name). Then the song name, then "by [artist] • [album]", so the song, artist and album each appear once. Hovering the CD shows the song name. Note: if a track has the same name as its album (e.g. "cross the line" on the album "cross the line"), that name will still appear twice — once as the song, once as the album — because it really is both.

## Spinning CD from the album cover
Settings > CD > "CD Rich Presence". Gumi RPC turns the cover into a spinning-CD GIF at 512x512 (Discord needs at least 512x512 for presence pictures), uploads it once per album to catbox.moe, and Discord shows it. The Discord CD has a small centre hole with a thin clear ring around it, so the cover photo goes almost right up to the hole — the CD inside the app itself is unchanged. Albums you already played get their CD remade once with the new hole, then the new one is cached. The CD GIF is kept small on purpose (12 frames, 128 colours, ~0.7 MB): the earlier 36-frame, ~2.3 MB version was too big for Discord's image proxy, which only played its first ~5 frames and looped them, so it flashed. When a song starts, the app waits up to 8 seconds for the album CD to be ready before showing anything on Discord, instead of showing the fallback `cd` picture first — if that picture was never uploaded as an Art Asset, Discord shows a "?" in those first seconds. Run `npm install` after updating. Tweak the Discord CD's look at the top of `cdgif.js`.

**CD Rich Presence off:** Discord shows the regular album cover instead of the spinning CD — the cover is square-cropped to 512x512, uploaded once per album to catbox.moe as a still JPEG, and cached next to the CD link in `cd-cache.json`. If there's no cover, or the upload fails, Discord falls back to the "Fallback CD picture" as before.

**CD in the app** (Settings > CD > "CD in the app", on by default): the Now Playing panel and the mini player show the spinning CD. Off shows the full album cover in the app instead — the disc becomes a square cover image (no spin, no centre hole, no sheen). The two toggles are fully independent: either, both, or neither can be on.

Why a GIF sometimes never shows: Discord only shows two kinds of pictures. Uploaded Art Assets are always still pictures, so a GIF uploaded there will not animate, and the asset name is lowercased by Discord and must be typed exactly ("cd", not "cd.gif"). A direct link to a GIF can animate, but Discord fetches it through its own image proxy, so it can take a few minutes to appear and some hosts are blocked. Gumi RPC now strips the file extension from asset names, lowercases them, and ignores local file paths (Discord cannot read files from your PC), and it logs exactly what picture it sent. Settings > "Check the music picture on Discord" tells you which case you are in and what to fix.

## Equalizer + 8D audio
The button right of the lyrics (mic) button in the Now Playing panel opens the Equalizer: five modes — Flat, Bass boost, Vocal / Podcasts, Treble, Clarity — plus an 8D audio toggle (experimental, free). All modes are free. Picking a mode applies it at once and saves it, so it survives a restart; the button glows while a mode other than Flat is on, or while 8D is on.

Under the hood, the player routes both audio elements through five BiquadFilter bands (60 Hz lowshelf, 230 / 910 / 4000 Hz peaking, 14 kHz highshelf) and then a StereoPanner, before the analyser and the speakers — so the EQ applies to whichever element is playing and survives the gapless swap, and the live waveform shows the EQ'd sound. 8D is a slow oscillator (one full left-right sweep every ~8 seconds) swinging the pan; turning it off centres the sound again. The EQ only takes effect once the audio engine exists (the first time a song plays); the saved mode is applied when the engine is made.

## Album / playlist detail (the glide)
Tapping an album or playlist card sends its cover gliding from its exact spot on the grid to a full-screen detail view — big cover, title, and only that album's or playlist's songs — like the album page in a streaming app. The back arrow at the top left glides the cover back to its place in the grid. "All songs" has no cover to glide, so it just shows the full list as before. The detail view is a FLIP animation: a fixed clone of the cover is animated between the card's rect and the detail cover's rect (0.45 s), and the real detail cover is revealed when the clone lands. The detail's song list stays in step with the main list (the now-playing highlight follows), and if the album or playlist is deleted while its detail is open, the detail closes.

## Theme selection menu (My Themes)
Customize > My Themes is now a proper selection menu instead of one flat list: a search box at the top filters themes by name as you type, and the grid is grouped — "Built-in" first (the Aero theme that ships with the app), then "My themes" (everything else), each group headed with its count. Every card carries a label on its preview saying what kind of theme it is: Built-in, Pack (an imported .gumipack — it has its own CSS, music list, intro, sidebar or mascot), or Picture (a theme made from a single picture). Tapping a card still applies it, and the name / accent / delete controls on the card work as before.

## Patch notes
The notes live in `patch-notes.json` (next to `package.json`) — one entry per version, latest first, each with a `version`, a `date`, and a list of `notes`. Brandon writes them there, and the release script adds a new entry when it ships a version. The little notepad icon at the top right of the title bar opens a panel showing every version's notes, so anyone can re-read them at any time; the close button or clicking outside the panel closes it. If the file is missing or empty, the panel says "No patch notes yet."

## Release automation (`release.js`)
A separate Node script that pushes out an update without doing the steps by hand. Place `release.js` in the repo root (next to `package.json`) once, then run it from there to ship a version:

```
node release.js --zip C:\path\to\gumi-rpc-0.1.34.zip --notes "First note" "Second note"
```

Or, if the build's contents are already copied into the repo folder, skip `--zip` and just pass the notes. What it does, in order: (1) copies the zip's contents into the repo (never the folder itself; `dist/` and `node_modules/` are never copied), (2) verifies `package.json` in the repo folder shows the new version, (3) prepends the patch notes to `patch-notes.json` (replacing an existing entry for the same version, so re-running is safe), (4) `git add` + commit + push, (5) `npm install` if `node_modules` is missing, then `npm run release`, (6) checks GitHub for the release tag and its assets. The GitHub token comes from the `GH_TOKEN` environment variable (set it for the session with `set GH_TOKEN=...` in cmd) — it is never written into any file, and the script stops before doing anything if it is missing. It fails fast: if any step errors, it stops and says which step failed, so nothing is half-published. `--dry-run` prints every step without changing anything (safe to run any time — it never pushes or publishes); `--no-verify` skips the GitHub check at the end.

## Gumi-Auto (the release app)
A tiny Electron app that does the same release as `release.js`, but from one window instead of a command line. Put the `gumi-auto` folder somewhere on your PC, run `npm install` once in it, then `npm start` whenever you want to release. It has: a patch-notes form (heading, subheading, description — one note per line, each line becomes a bullet in the app), a GitHub token field (paste it once and hit Save; it is saved on this PC only, in Gumi-Auto's own data folder, and is never sent anywhere except to GitHub when you release), a build-zip picker, and a repo-folder picker (defaults to `C:\Users\Brandon\Documents\GitHub\Gumi-RPC`). Hit "Release to GitHub" and watch the progress log. The patch-notes entry it writes carries the heading and subheading, and the app's patch-notes panel shows them (0.1.34).

## Album detail — the switcher strip + queue (0.1.35)
Tapping an album still glides its cover to the full-screen detail, but now every other album and playlist stays in a strip at the top of the detail — tap any of them and the detail switches to that album instantly, no back button needed. The glide is only for opening from the grid; switching is a plain instant swap so it never feels laggy. The detail's song list highlights the song that's playing (the `.now` row, same as the main list), scrolls, and every row has a ＋ button that places that song in Up next without leaving the album.

## Equalizer — full menu + 8D room (0.1.35)
The EQ button now opens its own full menu, like the lyrics view — it replaces the player while it is open (tapping lyrics closes it and vice versa). Five vertical sliders, one per band (60 Hz, 230 Hz, 910 Hz, 4 kHz, 14 kHz), each showing its dB value; moving a slider by hand switches to Custom and saves those gains (`S.eqCustom`, a 5-number array in settings). The five presets are still there if you don't feel like adjusting. 8D audio now has a room to it: the chain splits after the panner into a dry path and a wet path through a convolver (a synthesized empty-room impulse, ~2.5 s of decaying noise — a huge hall). The wet mix is 0 while 8D is off and fades to 0.5 while it is on, so the sound sweeps side to side inside the hall instead of just panning left-right dry. The reverb taps off BEFORE the panner, so the hall itself stays centred while the dry sound moves around inside it — that is what makes it feel like the music is circling you in a hall rather than the whole hall swinging with it (0.1.38, tuned to the SICKO MODE 8D example Brandon sent: the sweep is 0.09 Hz, about 11 seconds per full left-right pass; 0.1.39 widened the hall to 2.5 s and raised the wet mix to 0.5). The preset row has a **Custom** button (0.1.39): moving a slider by hand switches to Custom and saves those gains, starting from the preset you were on — so a tweak keeps the rest of that preset instead of resetting the other bands to flat. Tapping Custom later brings your saved build back, even after switching to another preset.

## CD hole toggle (0.1.36)
Settings > CD has a third toggle, "CD hole", that only appears while "CD in the app" is on — the hole only exists on the spinning CD. On (the default) the in-app CD keeps its small centre hole; off hides it (`body.cd-nohole` hides the `.cd::after`), so the album cover stays whole while the disc stays round and keeps spinning. The Discord CD is NOT affected — it always keeps its hole, since the CD on Discord is a separate generated GIF and the hole there is part of its look.

## Developer / Showcasing mode (dev copy only)
A safety guard for showing the app off: when it's on, the app shows a sample library instead of the real one, so a screenshot or a video never shows anyone else's albums. The sample content is made up — three demo games (Starlight Drift, Pixel Quest, Neon Runner) with generated placeholder art, and two demo albums (Sunset Waves, Midnight Static) with a generated ambient track that plays, so nothing in it belongs to another artist. The demo library lives only in memory: nothing is saved while the mode is on (adding/editing a game and saving music are all blocked with a toast), and turning it off brings the real library straight back. A yellow DEMO badge sits in the title bar while it's on, so it's always obvious the content is sample data.

The mode only exists on a dev copy. To unlock it, create an empty file called `dev-mode` (no extension, contents don't matter) in `%APPDATA%\gumi-rpc` and restart the app — a "Developer" section with the "Showcasing mode" toggle appears in Settings. A public install never has that file, so the toggle never appears there; if the file is deleted while the mode is on, the app turns the mode off on the next start. Demo assets live in `assets/demo/` (placeholder art + `demo-ambient.mp3`, a 32-second generated chord pad).

## Your Application ID
Put it in the app: Settings > Discord Application ID. It is saved on your computer, so updating the code never wipes it.
(The line at the top of `main.js` is only the built-in default for the installer you hand out.)
If something won't show on Discord, Settings > "Open the Discord problem log" lists what went wrong.

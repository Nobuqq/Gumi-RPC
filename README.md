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
- My themes: "+ Add theme from picture" makes a theme from a picture. Each theme has
  its own accent colour (the colour picker on its card), and the app accent changes
  with the theme. Best picture ratio is 16:9 (1920x1080). If a picture does not fit,
  use the editor under the themes: Fit (Cover fills the box and crops the edges,
  Contain shows the whole picture), Position, Zoom, and Picture ratio.
- Fonts: "Choose font file" picks a .ttf / .otf / .woff file, and the size slider
  changes the font size. "Reset font" goes back to the default.
- Colours: set a colour for Background, Panels, Cards, Text, Muted text, Lines,
  Accent, Highlight, Pink and Green. "Reset colours" goes back to the theme.
- Icons: the sidebar Games / Music / Settings icons are now your custom silhouettes
  (`assets/icons/games.png`, `music.png`, `settings.png` — black shapes on a
  transparent background, used as a mask). "Icon colour" recolours all three.
- Neon glow: a toggle that adds a glow to titles and buttons.
- Accent everywhere: a theme's accent colour now also tints the boxes — theme cards, song and playlist rows, and the player — so the whole app matches the picture.

## Your art, font, sounds, mascot
- Font: put it at `assets/fonts/gumi.ttf` (or edit the @font-face line in index.html), or use Customize > Font to pick your own font file in the app
- Sounds: `assets/sfx/click.wav`, `launch.wav`, `blip.wav` (blip plays as the mascot talks)
- Gumi (the ball mascot): drawn in code by default; drop your own art at `assets/gumi.png` to replace him
- Gumi’s tutorial words: edit the `TOUR` list and `intro()` near the bottom of index.html

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

The player at the bottom grows into a full-width bar in the Music view and shrinks back to a floating pill in the other views. The bar spans only the track list — it starts at the sidebar and stops before the Now Playing panel, so it never covers your profile or the big CD. In pill form you can drag it anywhere on screen (it remembers where you put it — double-click it to put it back in the middle). Right-click any song for Play next / Add to queue / Add to playlist, and the queue button in the player (with a count) shows what's up next.

## Marketplace (coming soon)
The Marketplace tab in the sidebar is ready for when the store opens: theme packs made by other people, with a different picture for each part of the app (background, sidebar, panels) and their own sound effects.

## Make the .exe
1. (Optional) put a 256x256 `icon.ico` in the `build` folder.
2. `npm run pack` makes a quick test copy in `dist/win-unpacked`. `npm run build` makes the installer in `dist/`.
3. If it complains about a symbolic link or privilege, run the terminal as Administrator or turn on Windows Developer Mode.

## Spinning CD on Discord
1. Developer Portal > your application > Rich Presence > Art Assets > Add Image(s): pick `assets/discord/cd.gif` and name it `cd`.
2. Wait a few minutes, then play a song. If it only shows a still picture, upload the GIF to giphy.com and paste its link into Settings > "Spinning CD picture on Discord".

## What Discord shows while a song plays
Top line: "Listening to [artist]" (Settings > "Show the artist as 'Listening to…'" — Discord falls back to "Gumi RPC" if it ignores the artist name). Then the song name, then "by [artist] • [album]", so the song, artist and album each appear once. Hovering the CD shows the song name. Note: if a track has the same name as its album (e.g. "cross the line" on the album "cross the line"), that name will still appear twice — once as the song, once as the album — because it really is both.

## Spinning CD from the album cover
Settings > "Spinning CD from the album cover". Gumi RPC turns the cover into a spinning-CD GIF at 512x512 (Discord needs at least 512x512 for presence pictures), uploads it once per album to catbox.moe, and Discord shows it. The Discord CD has a small centre hole with a thin clear ring around it, so the cover photo goes almost right up to the hole — the CD inside the app itself is unchanged. Albums you already played get their CD remade once with the new hole, then the new one is cached. The CD GIF is kept small on purpose (12 frames, 128 colours, ~0.7 MB): the earlier 36-frame, ~2.3 MB version was too big for Discord's image proxy, which only played its first ~5 frames and looped them, so it flashed. When a song starts, the app waits up to 8 seconds for the album CD to be ready before showing anything on Discord, instead of showing the fallback `cd` picture first — if that picture was never uploaded as an Art Asset, Discord shows a "?" in those first seconds. Run `npm install` after updating. Tweak the Discord CD's look at the top of `cdgif.js`.

Why a GIF sometimes never shows: Discord only shows two kinds of pictures. Uploaded Art Assets are always still pictures, so a GIF uploaded there will not animate, and the asset name is lowercased by Discord and must be typed exactly ("cd", not "cd.gif"). A direct link to a GIF can animate, but Discord fetches it through its own image proxy, so it can take a few minutes to appear and some hosts are blocked. Gumi RPC now strips the file extension from asset names, lowercases them, and ignores local file paths (Discord cannot read files from your PC), and it logs exactly what picture it sent. Settings > "Check the music picture on Discord" tells you which case you are in and what to fix.

## Your Application ID
Put it in the app: Settings > Discord Application ID. It is saved on your computer, so updating the code never wipes it.
(The line at the top of `main.js` is only the built-in default for the installer you hand out.)
If something won't show on Discord, Settings > "Open the Discord problem log" lists what went wrong.

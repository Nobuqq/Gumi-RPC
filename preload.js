const { contextBridge, ipcRenderer } = require('electron');
const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);
contextBridge.exposeInMainWorld('api', {
  getLibrary: call('library:get'), saveGame: call('game:save'), deleteGame: call('game:delete'),
  scanFolder: call('dialog:folder'), pickExe: call('dialog:exe'), pickIcon: call('dialog:icon'), pickFont: call('dialog:font'), pickSound: call('dialog:sound'), musicDiag: call('music:diag'),
  launch: call('game:launch'), setPresence: call('presence:set'), clearPresence: call('presence:clear'),
  signIn: call('auth:signin'), restore: call('auth:restore'), signOut: call('auth:signout'), getMusic: call('music:get'), saveMusic: call('music:save'), importMusic: call('music:import'), getCover: call('music:cover'), getBytes: call('music:bytes'), musicPresence: call('music:presence'), pickPics: call('dialog:pics'), getStartup: call('startup:get'), setStartup: call('startup:set'), win: (a) => ipcRenderer.invoke('win:' + a), getLyrics: call('lyrics:get'),
  getConfig: call('config:get'), setClientId: call('config:set'), openLog: call('log:open'),
  checkUpdates: call('update:check'), restartUpdate: call('update:restart'), getVersion: call('app:version'), getPatchNotes: call('app:patchNotes'),
  importThemePackage: call('theme:import'),
  isDev: call('dev:isDev'),
  onUpdateReady: (fn) => ipcRenderer.on('update:ready', () => fn()),
  onToast: (fn) => ipcRenderer.on('toast', (_e, t) => fn(t)),
  onClosed: (fn) => ipcRenderer.on('game:closed', (_e, d) => fn(d)),
  // Gumi Remote (Discord bot): the main process sends 'gumi:remote' when
  // the bot asks about the player, and the page answers with remoteReply().
  onRemote: (fn) => ipcRenderer.on('gumi:remote', (_e, msg) => fn(msg)),
  remoteReply: call('gumi:remote-reply'),
});

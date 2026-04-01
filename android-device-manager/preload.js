const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file) => webUtils.getPathForFile(file),
  getDevices: () => ipcRenderer.invoke('adb:get-devices'),
  getWifiIp: (serial) => ipcRenderer.invoke('adb:get-wifi-ip', serial),
  pairDevice: (address, code) => ipcRenderer.invoke('adb:pair', address, code),
  connectWireless: (address) => ipcRenderer.invoke('adb:connect-wireless', address),
  disconnectWireless: (address) => ipcRenderer.invoke('adb:disconnect-wireless', address),
  getDeviceInfo: (serial) => ipcRenderer.invoke('adb:get-device-info', serial),
  onDevicesChanged: (cb) => {
    ipcRenderer.on('devices-changed', (_, devices) => cb(devices));
  },
  onScrcpyExited: (cb) => {
    ipcRenderer.on('scrcpy-exited', () => cb());
  },

  installApk: (serial) => ipcRenderer.invoke('adb:install-apk', serial),
  installApkPath: (serial, p) => ipcRenderer.invoke('adb:install-apk-path', serial, p),
  cleanInstall: (serial, pkg) => ipcRenderer.invoke('adb:clean-install', serial, pkg),
  listPackages: (serial, filter) => ipcRenderer.invoke('adb:list-packages', serial, filter),
  uninstallPackage: (serial, pkg) => ipcRenderer.invoke('adb:uninstall-package', serial, pkg),
  launchApp: (serial, pkg) => ipcRenderer.invoke('adb:launch-app', serial, pkg),
  forceStop: (serial, pkg) => ipcRenderer.invoke('adb:force-stop', serial, pkg),
  clearData: (serial, pkg) => ipcRenderer.invoke('adb:clear-data', serial, pkg),

  startLogcat: (serial, filters) => ipcRenderer.invoke('adb:start-logcat', serial, filters),
  stopLogcat: () => ipcRenderer.invoke('adb:stop-logcat'),
  clearLogcat: (serial) => ipcRenderer.invoke('adb:clear-logcat', serial),
  onLogcatLine: (cb) => {
    ipcRenderer.on('logcat-line', (_, line) => cb(line));
  },

  listFiles: (serial, p) => ipcRenderer.invoke('adb:list-files', serial, p),
  pullFile: (serial, remotePath) => ipcRenderer.invoke('adb:pull-file', serial, remotePath),
  pushFile: (serial, remotePath) => ipcRenderer.invoke('adb:push-file', serial, remotePath),
  deleteFile: (serial, remotePath) => ipcRenderer.invoke('adb:delete-file', serial, remotePath),

  startScrcpy: (serial, options) => ipcRenderer.invoke('scrcpy:start', serial, options),
  stopScrcpy: () => ipcRenderer.invoke('scrcpy:stop'),
  isScrcpyRunning: () => ipcRenderer.invoke('scrcpy:is-running'),
  startRecording: (serial) => ipcRenderer.invoke('adb:start-record', serial),
  stopRecording: (serial) => ipcRenderer.invoke('adb:stop-record', serial),
  isRecording: () => ipcRenderer.invoke('adb:is-recording'),
  onRecordingFinished: (cb) => {
    ipcRenderer.on('screen-record-finished', () => cb());
  },
  screencap: (serial) => ipcRenderer.invoke('adb:screencap', serial),

  dumpUi: (serial) => ipcRenderer.invoke('adb:dump-ui', serial),
  getForegroundPkg: (serial) => ipcRenderer.invoke('adb:foreground-pkg', serial),
  getRunningAppInfo: (serial, pkg) => ipcRenderer.invoke('adb:running-app-info', serial, pkg),
  inputTap: (serial, x, y) => ipcRenderer.invoke('adb:input-tap', serial, x, y),
  inputSwipe: (serial, x1, y1, x2, y2, dur) => ipcRenderer.invoke('adb:input-swipe', serial, x1, y1, x2, y2, dur),
  inputKey: (serial, keycode) => ipcRenderer.invoke('adb:input-key', serial, keycode),

  saveFileDialog: (name) => ipcRenderer.invoke('dialog:save-file', name),
  writeFile: (p, content) => ipcRenderer.invoke('fs:write-file', p, content),

  pullAllLogs: (serial, remotePaths) => ipcRenderer.invoke('adb:pull-all-logs', serial, remotePaths),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),
  saveScreenshot: (base64Data) => ipcRenderer.invoke('adb:save-screenshot', base64Data),
  openScreenshotFolder: () => ipcRenderer.invoke('shell:open-screenshot-folder'),

  readLogsDir: (dirPath) => ipcRenderer.invoke('fs:read-logs-dir', dirPath),
  fetchRecentLog: (serial) => ipcRenderer.invoke('adb:fetch-recent-log', serial),
  geminiGetApiKey: () => ipcRenderer.invoke('gemini:get-api-key'),
  geminiSetApiKey: (key) => ipcRenderer.invoke('gemini:set-api-key', key),
  geminiChat: (message) => ipcRenderer.invoke('gemini:chat', message),
  geminiReset: () => ipcRenderer.invoke('gemini:reset'),

  selectFolder: () => ipcRenderer.invoke('dialog:select-folder'),
  selectFigmaFiles: () => ipcRenderer.invoke('dialog:select-figma-files'),
  analysisParseFiles: (filePaths) => ipcRenderer.invoke('analysis:parse-files', filePaths),
  analysisRun: (type, parsedData) => ipcRenderer.invoke('analysis:run', type, parsedData),
  analysisRunTestcase: (type, parsedData) => ipcRenderer.invoke('analysis:run-testcase', type, parsedData),
  analysisSave: (type, content) => ipcRenderer.invoke('analysis:save', type, content),
  analysisOpenFolder: () => ipcRenderer.invoke('analysis:open-folder'),

  onCrashDetected: (cb) => ipcRenderer.on('crash-detected', (_, data) => cb(data)),
  onCrashSummaryUpdated: (cb) => ipcRenderer.on('crash-summary-updated', (_, data) => cb(data)),
  crashGetHistory: () => ipcRenderer.invoke('crash:get-history'),
  crashClearHistory: () => ipcRenderer.invoke('crash:clear-history'),
  crashOpenFolder: () => ipcRenderer.invoke('crash:open-folder'),
  crashReadLog: (filePath) => ipcRenderer.invoke('crash:read-log', filePath),
  crashTest: () => ipcRenderer.invoke('crash:test'),
  crashSetWatchedApp: (pkg) => ipcRenderer.invoke('crash:set-watched-app', pkg),
  crashRestartMonitor: (serial) => ipcRenderer.invoke('crash:restart-monitor', serial),
});

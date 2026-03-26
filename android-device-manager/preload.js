const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFilePath: (file) => webUtils.getPathForFile(file),
  getDevices: () => ipcRenderer.invoke('adb:get-devices'),
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
  screencap: (serial) => ipcRenderer.invoke('adb:screencap', serial),

  dumpUi: (serial) => ipcRenderer.invoke('adb:dump-ui', serial),
  inputTap: (serial, x, y) => ipcRenderer.invoke('adb:input-tap', serial, x, y),
  inputSwipe: (serial, x1, y1, x2, y2, dur) => ipcRenderer.invoke('adb:input-swipe', serial, x1, y1, x2, y2, dur),
  inputKey: (serial, keycode) => ipcRenderer.invoke('adb:input-key', serial, keycode),

  saveFileDialog: (name) => ipcRenderer.invoke('dialog:save-file', name),
  writeFile: (p, content) => ipcRenderer.invoke('fs:write-file', p, content),

  pullAllLogs: (serial, remotePaths) => ipcRenderer.invoke('adb:pull-all-logs', serial, remotePaths),
  openFolder: (folderPath) => ipcRenderer.invoke('shell:open-folder', folderPath),
  saveScreenshot: (base64Data) => ipcRenderer.invoke('adb:save-screenshot', base64Data),
  openScreenshotFolder: () => ipcRenderer.invoke('shell:open-screenshot-folder'),
});

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const AdbManager = require('./lib/adb-manager');
const ScrcpyManager = require('./lib/scrcpy-manager');
const DeviceMonitor = require('./lib/device-monitor');

let mainWindow;
let adb;
let scrcpyMgr;
let deviceMonitor;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Android Device Manager',
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function setupIpcHandlers() {
  adb = new AdbManager();
  const fs = require('fs');
  const isWin = process.platform === 'win32';

  const adbBin = isWin ? 'adb.exe' : 'adb';
  const scrcpyPacked = path.join(process.resourcesPath, 'scrcpy');
  const scrcpyDev = path.join(__dirname, 'vendor', 'scrcpy');
  let scrcpyDir = null;

  if (fs.existsSync(scrcpyPacked)) {
    scrcpyDir = scrcpyPacked;
  } else if (fs.existsSync(scrcpyDev)) {
    scrcpyDir = scrcpyDev;
  }

  if (scrcpyDir && fs.existsSync(path.join(scrcpyDir, adbBin))) {
    adb.adbPath = path.join(scrcpyDir, adbBin);
  }

  scrcpyMgr = new ScrcpyManager(scrcpyDir);
  deviceMonitor = new DeviceMonitor(adb);

  deviceMonitor.on('devices-changed', (devices) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('devices-changed', devices);
    }
  });

  ipcMain.handle('adb:get-devices', () => adb.getDevices());
  ipcMain.handle('adb:get-device-info', (_, serial) => adb.getDeviceInfo(serial));

  ipcMain.handle('adb:install-apk', async (_, serial) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'APK Files', extensions: ['apk'] }],
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    return adb.installApk(serial, result.filePaths[0]);
  });
  ipcMain.handle('adb:install-apk-path', (_, serial, apkPath) => adb.installApk(serial, apkPath));

  ipcMain.handle('adb:clean-install', async (_, serial, pkgName) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'APK Files', extensions: ['apk'] }],
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    try { await adb.forceStop(serial, pkgName); } catch {}
    try { await adb.uninstallPackage(serial, pkgName); } catch {}
    return adb.installApk(serial, result.filePaths[0]);
  });

  ipcMain.handle('adb:list-packages', (_, serial, filter) => adb.listPackages(serial, filter));
  ipcMain.handle('adb:uninstall-package', (_, serial, pkg) => adb.uninstallPackage(serial, pkg));
  ipcMain.handle('adb:launch-app', (_, serial, pkg) => adb.launchApp(serial, pkg));
  ipcMain.handle('adb:force-stop', (_, serial, pkg) => adb.forceStop(serial, pkg));
  ipcMain.handle('adb:clear-data', (_, serial, pkg) => adb.clearData(serial, pkg));

  ipcMain.handle('adb:start-logcat', (_, serial, filters) => {
    adb.startLogcat(serial, filters, (line) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('logcat-line', line);
      }
    });
    return { success: true };
  });
  ipcMain.handle('adb:stop-logcat', () => {
    adb.stopLogcat();
    return { success: true };
  });
  ipcMain.handle('adb:clear-logcat', (_, serial) => adb.clearLogcat(serial));

  ipcMain.handle('adb:list-files', (_, serial, remotePath) => adb.listFiles(serial, remotePath));
  ipcMain.handle('adb:pull-file', async (_, serial, remotePath) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.basename(remotePath),
    });
    if (result.canceled) return { success: false, canceled: true };
    return adb.pullFile(serial, remotePath, result.filePath);
  });
  ipcMain.handle('adb:push-file', async (_, serial, remotePath) => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    return adb.pushFile(serial, result.filePaths[0], remotePath);
  });
  ipcMain.handle('adb:delete-file', (_, serial, remotePath) => adb.deleteFile(serial, remotePath));

  scrcpyMgr.onExit = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scrcpy-exited');
    }
  };
  ipcMain.handle('scrcpy:start', (_, serial, options) => scrcpyMgr.start(serial, options));
  ipcMain.handle('scrcpy:stop', () => scrcpyMgr.stop());
  ipcMain.handle('scrcpy:is-running', () => scrcpyMgr.isRunning());
  ipcMain.handle('adb:screencap', (_, serial) => adb.screencap(serial));

  ipcMain.handle('adb:dump-ui', (_, serial) => adb.dumpUi(serial));
  ipcMain.handle('adb:pair', (_, address, code) => adb.pair(address, code));
  ipcMain.handle('adb:connect-wireless', (_, address) => adb.connectWireless(address));
  ipcMain.handle('adb:disconnect-wireless', (_, address) => adb.disconnectWireless(address));

  ipcMain.handle('adb:input-tap', (_, serial, x, y) => adb.inputTap(serial, x, y));
  ipcMain.handle('adb:input-swipe', (_, serial, x1, y1, x2, y2, dur) => adb.inputSwipe(serial, x1, y1, x2, y2, dur));
  ipcMain.handle('adb:input-key', (_, serial, keycode) => adb.inputKeyEvent(serial, keycode));

  ipcMain.handle('adb:save-screenshot', async (_, base64Data) => {
    const fs = require('fs');
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(__dirname, 'screenshots', today);
    fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}-${now.getMinutes().toString().padStart(2,'0')}-${now.getSeconds().toString().padStart(2,'0')}`;
    const fileName = `screenshot_${time}.png`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    return { success: true, filePath, dir };
  });

  ipcMain.handle('shell:open-screenshot-folder', async () => {
    const fs = require('fs');
    const { shell } = require('electron');
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(__dirname, 'screenshots', today);
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  ipcMain.handle('dialog:save-file', async (_, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'Text Files', extensions: ['txt', 'log'] }],
    });
    if (result.canceled) return null;
    return result.filePath;
  });

  ipcMain.handle('fs:write-file', async (_, filePath, content) => {
    const fs = require('fs').promises;
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  function safeName(name) {
    return name.replace(/[<>:"/\\|?*]/g, '_');
  }

  ipcMain.handle('adb:pull-all-logs', async (_, serial, remotePaths) => {
    const fs = require('fs');

    const today = new Date().toISOString().slice(0, 10);
    const logsDir = path.join(__dirname, 'logs', today);
    fs.mkdirSync(logsDir, { recursive: true });

    const paths = Array.isArray(remotePaths) ? remotePaths : [remotePaths];
    let totalPulled = 0;

    try {
      for (const remotePath of paths) {
        const files = await adb.listFiles(serial, remotePath);
        const realFiles = files.filter((f) => !f.isDirectory);
        for (const f of realFiles) {
          const localPath = path.join(logsDir, safeName(f.name));
          await adb.pullFile(serial, f.fullPath, localPath);
          totalPulled++;
        }
      }

      if (!totalPulled) return { success: false, error: '로그 파일이 없습니다.' };
      return { success: true, logsDir, count: totalPulled };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('shell:open-folder', async (_, folderPath) => {
    const { shell } = require('electron');
    shell.openPath(folderPath);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupIpcHandlers();
  deviceMonitor.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  deviceMonitor.stop();
  adb.stopLogcat();
  scrcpyMgr.stop();
  if (process.platform !== 'darwin') app.quit();
});

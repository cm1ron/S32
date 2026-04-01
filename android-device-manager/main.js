const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const AdbManager = require('./lib/adb-manager');
const ScrcpyManager = require('./lib/scrcpy-manager');
const DeviceMonitor = require('./lib/device-monitor');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CrashMonitor = require('./lib/crash-monitor');

let mainWindow;
let adb;
let scrcpyMgr;
let deviceMonitor;
let crashMonitor;
let geminiChat = null;

const BASE_DIR = process.env.PORTABLE_EXECUTABLE_DIR || (app.isPackaged ? path.dirname(process.execPath) : __dirname);

const CONFIG_DIR = path.join(app.getPath('userData'), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
}

function initGemini(apiKey) {
  if (!apiKey) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `당신은 Android QA 전문 어시스턴트입니다. 다음 역할을 수행합니다:
- Android 디바이스 로그(logcat) 분석 및 오류 원인 파악
- ADB 명령어 추천 및 사용법 안내
- 앱 크래시, ANR, 성능 이슈 분석
- QA 테스트 케이스 관련 도움
한국어로 답변하고, 기술적 내용은 정확하게 전달합니다. 코드나 명령어는 코드 블록으로 감싸줍니다.`,
    });
    geminiChat = model.startChat({ history: [] });
    return geminiChat;
  } catch {
    return null;
  }
}

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

function buildCrashSummaryPrompt(crash) {
  const context = crash.preContext || '';
  const ui = crash.uiHierarchy || '';
  return `너는 Android QA 크래시 분석 전문가이다.
크래시 정보, 직전 logcat, UI 계층을 분석하여 사용자 행동과 크래시 원인을 설명하라.

형식 (반드시 이 형식만 출력):
1. [화면] 어떤 화면에 있었는지 (Activity명 → 한국어)
2. [행동] 직전에 무엇을 했는지 (UI 계층의 resource-id, 버튼명, API 호출 등 구체적으로)
3. [원인] 기술적 원인 (Exception 타입 + 핵심 원인)
4. [재현] 재현 방법 추정 1-2줄

분석 팁:
- UI 계층에서 clickable 요소, FOCUSED 요소, resource-id를 찾아 어떤 버튼을 눌렀는지 추론
- logcat에서 gRPC, createChannel, farm-, Activity 전환을 찾아라
- 난독화 클래스(r8-map-id 등)는 "난독화 코드"로 표기하되 추론 가능한 부분은 설명
- 각 줄 50자 이내 한국어, 4줄만 출력

크래시 타입: ${crash.type}
앱: ${crash.app}
디바이스: ${crash.device || 'unknown'}
Activity: ${crash.activity}
${ui ? `\n=== UI 계층 (크래시 직후 화면 요소) ===\n${ui.slice(0, 2000)}` : ''}
${context ? `\n=== 직전 logcat ===\n${context.slice(-2000)}` : ''}
=== 스택트레이스 ===
${crash.stacktrace.slice(0, 2500)}`;
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

  const crashDir = path.join(BASE_DIR, 'crashes');
  crashMonitor = new CrashMonitor(adb.adbPath, crashDir);

  crashMonitor.on('crash', async (crash) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('crash-detected', crash);
    }

    const cfg = loadConfig();
    if (cfg.geminiApiKey && crash.stacktrace) {
      try {
        const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const prompt = buildCrashSummaryPrompt(crash);

        const timeoutMs = 15000;
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
        ]);
        const summary = result.response.text().trim();
        crash.summary = summary;

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('crash-summary-updated', {
            time: crash.time,
            summary,
          });
        }
      } catch (e) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const errMsg = e.message === 'timeout' ? 'AI 요약 시간 초과 (15초)' : `AI 요약 실패: ${e.message}`;
          mainWindow.webContents.send('crash-summary-updated', {
            time: crash.time,
            summary: errMsg,
          });
        }
      }
    }
  });

  deviceMonitor.on('devices-changed', (devices) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('devices-changed', devices);
      const connectedSerials = devices
        .filter((d) => d.status === 'device')
        .map((d) => d.serial);
      if (connectedSerials.length) {
        if (!crashMonitor.isRunning()) {
          crashMonitor.start(connectedSerials);
        } else {
          crashMonitor.updateDevices(connectedSerials);
        }
      } else {
        crashMonitor.stop();
      }
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
    const uninstResult = await adb.uninstallPackage(serial, pkgName);
    if (!uninstResult.success) {
      return { success: false, output: `삭제 실패: ${uninstResult.output}\n패키지명(${pkgName})이 맞는지 확인해주세요.` };
    }
    await new Promise((r) => setTimeout(r, 1500));
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

  adb._onScreenRecordExit = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screen-record-finished');
    }
  };

  ipcMain.handle('adb:start-record', (_, serial) => {
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
    const remotePath = `/sdcard/rec_${ts}.mp4`;
    return adb.startScreenRecord(serial, remotePath);
  });

  ipcMain.handle('adb:stop-record', async (_, serial) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(BASE_DIR, 'screenshots', today);
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}-${now.getMinutes().toString().padStart(2,'0')}-${now.getSeconds().toString().padStart(2,'0')}`;
    const localPath = path.join(dir, `record_${time}.mp4`);
    return adb.stopScreenRecordAndPull(localPath);
  });

  ipcMain.handle('adb:is-recording', () => adb.isScreenRecording());
  ipcMain.handle('adb:screencap', (_, serial) => adb.screencap(serial));

  ipcMain.handle('adb:dump-ui', (_, serial) => adb.dumpUi(serial));
  ipcMain.handle('adb:foreground-pkg', (_, serial) => adb.getForegroundPkg(serial));
  ipcMain.handle('adb:running-app-info', (_, serial, pkg) => adb.getRunningAppInfo(serial, pkg));
  ipcMain.handle('adb:get-wifi-ip', (_, serial) => adb.getWifiIp(serial));
  ipcMain.handle('adb:pair', (_, address, code) => adb.pair(address, code));
  ipcMain.handle('adb:connect-wireless', (_, address) => adb.connectWireless(address));
  ipcMain.handle('adb:disconnect-wireless', (_, address) => adb.disconnectWireless(address));

  ipcMain.handle('adb:input-tap', (_, serial, x, y) => adb.inputTap(serial, x, y));
  ipcMain.handle('adb:input-swipe', (_, serial, x1, y1, x2, y2, dur) => adb.inputSwipe(serial, x1, y1, x2, y2, dur));
  ipcMain.handle('adb:input-key', (_, serial, keycode) => adb.inputKeyEvent(serial, keycode));

  ipcMain.handle('adb:save-screenshot', async (_, base64Data) => {
    const fs = require('fs');
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(BASE_DIR, 'screenshots', today);
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
    const dir = path.join(BASE_DIR, 'screenshots', today);
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
    const logsDir = path.join(BASE_DIR, 'logs', today);
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

  ipcMain.handle('fs:read-logs-dir', async (_, dirPath) => {
    const fsP = require('fs').promises;
    try {
      const files = await fsP.readdir(dirPath);
      let combined = '';
      for (const f of files) {
        if (!f.endsWith('.txt') && !f.endsWith('.log')) continue;
        const content = await fsP.readFile(path.join(dirPath, f), 'utf-8');
        combined += `\n===== ${f} =====\n${content}\n`;
        if (combined.length > 100000) break;
      }
      return { success: true, text: combined.slice(0, 100000) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('adb:fetch-recent-log', async (_, serial) => {
    try {
      const log = await adb._execText(['logcat', '-d', '-t', '3000'], serial);
      return { success: true, text: log };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // --- Gemini AI ---
  ipcMain.handle('gemini:get-api-key', () => {
    const cfg = loadConfig();
    return cfg.geminiApiKey || '';
  });

  ipcMain.handle('gemini:set-api-key', (_, key) => {
    const cfg = loadConfig();
    cfg.geminiApiKey = key;
    saveConfig(cfg);
    geminiChat = null;
    if (key) initGemini(key);
    return { success: true };
  });

  ipcMain.handle('gemini:chat', async (_, message) => {
    const cfg = loadConfig();
    if (!cfg.geminiApiKey) return { success: false, error: 'API 키가 설정되지 않았습니다.' };

    if (!geminiChat) {
      initGemini(cfg.geminiApiKey);
    }
    if (!geminiChat) return { success: false, error: 'Gemini 초기화 실패' };

    try {
      const result = await geminiChat.sendMessage(message);
      const text = result.response.text();
      return { success: true, text };
    } catch (e) {
      if (e.message && e.message.includes('API_KEY_INVALID')) {
        return { success: false, error: 'API_KEY_INVALID' };
      }
      geminiChat = null;
      return { success: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('gemini:reset', () => {
    const cfg = loadConfig();
    geminiChat = null;
    if (cfg.geminiApiKey) initGemini(cfg.geminiApiKey);
    return { success: true };
  });

  // --- PRD/피그마 분석 ---
  const { parseFiles } = require('./lib/pdf-parser');
  const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
  const ALL_EXTS = ['.pdf', '.md', '.txt', ...IMAGE_EXTS];

  ipcMain.handle('dialog:select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    if (result.canceled || !result.filePaths.length) return [];
    const dir = result.filePaths[0];
    const entries = fs.readdirSync(dir);
    return entries
      .filter((name) => ALL_EXTS.includes(path.extname(name).toLowerCase()))
      .map((name) => ({ name, path: path.join(dir, name) }));
  });

  ipcMain.handle('dialog:select-figma-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'openDirectory', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    });
    if (result.canceled || !result.filePaths.length) return [];
    const files = [];
    for (const p of result.filePaths) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        const entries = fs.readdirSync(p);
        for (const name of entries) {
          if (IMAGE_EXTS.includes(path.extname(name).toLowerCase())) {
            files.push({ name, path: path.join(p, name) });
          }
        }
      } else if (IMAGE_EXTS.includes(path.extname(p).toLowerCase())) {
        files.push({ name: path.basename(p), path: p });
      }
    }
    return files;
  });

  ipcMain.handle('analysis:parse-files', async (_, filePaths) => {
    try {
      return { success: true, ...(await parseFiles(filePaths)) };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  const summaryPrompts = {
    prd: `PRD 문서를 분석하여 기능 목록을 우선순위별 표로 정리하라.

| 우선순위 | 기능명 | 동작 설명 |
|---------|--------|----------|
| P0 | 기능 이름 | 어떻게 동작하는지 한 줄 설명 |
| P1 | ... | ... |
| P2 | ... | ... |

- P0: 핵심 기능 (없으면 서비스 불가)
- P1: 주요 기능 (기본 사용에 필요)
- P2: 부가 기능 (있으면 좋은 것)
- 모든 기능을 빠짐없이 나열하라
- 불필요한 서론/설명 없이 표만 출력
- 한국어로 작성`,

    figma: `피그마 스크린샷을 분석하여 QA 관점에서 UI를 점검하라.

## 화면 목록
| 화면명 | 주요 요소 | 설명 |
|--------|---------|------|
| ... | 버튼, 입력창 등 | 화면이 어떤 기능을 담당하는지 |

## UI 점검 항목
| 심각도 | 화면 | 항목 | 상태 | 비고 |
|--------|------|------|------|------|
| Critical | ... | 필수 요소 누락 | ... | ... |
| Major | ... | 레이아웃/정렬 | ... | ... |
| Minor | ... | 텍스트/아이콘 | ... | ... |

규칙:
- 각 스크린샷의 화면 구성을 파악하고 QA 포인트 도출
- 불필요한 서론/설명 없이 표만 출력
- 한국어로 작성`,

    compare: `PRD 문서와 피그마 스크린샷을 비교하여 표로 정리하라.

## 일치 항목
| 항목 | PRD 요구사항 | 피그마 반영 상태 |
|------|------------|---------------|

## 누락/불일치
| 심각도 | 항목 | PRD 내용 | 피그마 상태 | 비고 |
|--------|------|---------|-----------|------|
| Critical | ... | ... | 누락 | ... |
| Major | ... | ... | 불일치 | ... |
| Minor | ... | ... | ... | ... |

규칙:
- 심각도: Critical / Major / Minor
- 모든 PRD 요구사항을 빠짐없이 비교하라
- 불필요한 서론/설명 없이 표만 출력
- 한국어로 작성`,
  };

  const testcasePrompts = {
    prd: `PRD 문서를 기반으로 QA 테스트케이스를 생성하라.

반드시 아래 4개 카테고리 헤더를 포함하고 각 카테고리 아래에 표를 작성하라:

## 필수동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-1 | ... | 1. ...\\n2. ... | ... |

## 기본동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## UI
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## 엣지케이스
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

규칙:
- 반드시 "## 필수동작", "## 기본동작", "## UI", "## 엣지케이스" 4개 헤더를 모두 출력하라
- TC 번호는 전체 통합 번호 (TC-1, TC-2, ... TC-N)
- 각 카테고리당 최소 7개 이상의 TC를 생성하라
- 전체 TC 수가 최소 30개 이상이어야 한다
- 정상 케이스, 비정상 입력, 경계값, 반복 동작, 권한/상태 변경 등 다양한 관점
- 단계는 번호 매겨 간결하게, 기대결과는 한 줄로
- 불필요한 서론/설명 없이 카테고리별 표만 출력
- 한국어로 작성`,

    figma: `피그마 스크린샷을 기반으로 QA 테스트케이스를 생성하라.

반드시 아래 4개 카테고리 헤더를 포함하고 각 카테고리 아래에 표를 작성하라:

## 필수동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-1 | ... | 1. ...\\n2. ... | ... |

## 기본동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## UI
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## 엣지케이스
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

규칙:
- 반드시 "## 필수동작", "## 기본동작", "## UI", "## 엣지케이스" 4개 헤더를 모두 출력하라
- TC 번호는 전체 통합 번호 (TC-1, TC-2, ... TC-N)
- 각 카테고리당 최소 5개 이상의 TC를 생성하라
- 전체 TC 수가 최소 25개 이상이어야 한다
- 화면 전환, 터치 영역, 스크롤, 가로/세로 모드, 다크모드, 접근성 등 다양한 관점
- 단계는 번호 매겨 간결하게, 기대결과는 한 줄로
- 불필요한 서론/설명 없이 카테고리별 표만 출력
- 한국어로 작성`,

    compare: `PRD 문서와 피그마 스크린샷의 불일치를 기반으로 QA 테스트케이스를 생성하라.

반드시 아래 4개 카테고리 헤더를 포함하고 각 카테고리 아래에 표를 작성하라:

## 필수동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-1 | ... | 1. ...\\n2. ... | ... |

## 기본동작
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## UI
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

## 엣지케이스
| TC | 케이스명 | 단계 | 기대결과 |
|----|---------|------|---------|
| TC-N | ... | 1. ...\\n2. ... | ... |

규칙:
- 반드시 "## 필수동작", "## 기본동작", "## UI", "## 엣지케이스" 4개 헤더를 모두 출력하라
- PRD 요구사항과 피그마 스크린샷 간 불일치/누락 항목 중심으로 TC 생성
- TC 번호는 전체 통합 번호 (TC-1, TC-2, ... TC-N)
- 각 카테고리당 최소 5개 이상의 TC를 생성하라
- 전체 TC 수가 최소 25개 이상이어야 한다
- 단계는 번호 매겨 간결하게, 기대결과는 한 줄로
- 불필요한 서론/설명 없이 카테고리별 표만 출력
- 한국어로 작성`,
  };

  function buildParts(parsedData) {
    const parts = [];
    if (parsedData.texts && parsedData.texts.length) {
      const combinedText = parsedData.texts.map((t) => `=== ${t.name} ===\n${t.content}`).join('\n\n');
      parts.push({ text: combinedText });
    }
    if (parsedData.images && parsedData.images.length) {
      for (const img of parsedData.images) {
        parts.push({ text: `[피그마 스크린샷: ${img.name}]` });
        parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
      }
    }
    if (parts.length) parts.push({ text: '위 자료를 분석해주세요.' });
    return parts;
  }

  ipcMain.handle('analysis:run', async (_, type, parsedData) => {
    const cfg = loadConfig();
    if (!cfg.geminiApiKey) return { success: false, error: 'API 키가 설정되지 않았습니다.' };

    const prompt = summaryPrompts[type];
    if (!prompt) return { success: false, error: `알 수 없는 분석 유형: ${type}` };

    try {
      const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: prompt });
      const parts = buildParts(parsedData);
      if (!parts.length) return { success: false, error: '분석할 파일이 없습니다.' };

      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      return { success: true, text: result.response.text() };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('analysis:run-testcase', async (_, type, parsedData) => {
    const cfg = loadConfig();
    if (!cfg.geminiApiKey) return { success: false, error: 'API 키가 설정되지 않았습니다.' };

    const prompt = testcasePrompts[type];
    if (!prompt) return { success: false, error: `알 수 없는 분석 유형: ${type}` };

    try {
      const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: prompt });
      const parts = buildParts(parsedData);
      if (!parts.length) return { success: false, error: '분석할 파일이 없습니다.' };

      const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
      return { success: true, text: result.response.text() };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  });

  ipcMain.handle('analysis:save', async (_, type, content) => {
    const today = new Date().toISOString().slice(0, 10);
    const dir = path.join(BASE_DIR, 'analysis', today);
    fs.mkdirSync(dir, { recursive: true });

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}-${now.getMinutes().toString().padStart(2,'0')}-${now.getSeconds().toString().padStart(2,'0')}`;
    const typeNames = { prd: 'PRD분석', figma: '피그마분석', compare: 'PRD비교', summary: 'PRD요약', testcase: '테스트케이스' };
    const fileName = `${typeNames[type] || type}_${time}.md`;
    const filePath = path.join(dir, fileName);

    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true, filePath, dir };
  });

  ipcMain.handle('analysis:open-folder', async () => {
    const { shell } = require('electron');
    const dir = path.join(BASE_DIR, 'analysis');
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  // --- Crash Monitor ---
  ipcMain.handle('crash:get-history', () => crashMonitor.getHistory());
  ipcMain.handle('crash:clear-history', () => { crashMonitor.clearHistory(); return { success: true }; });
  ipcMain.handle('crash:set-watched-app', (_, pkg) => {
    crashMonitor.setWatchedApp(pkg || null);
    return { success: true };
  });
  ipcMain.handle('crash:restart-monitor', (_, serial) => {
    if (serial && crashMonitor.isRunning()) {
      crashMonitor.updateDevices([...new Set([...crashMonitor.connectedSerials, serial])]);
    } else if (serial) {
      crashMonitor.start([serial]);
    }
    return { success: true };
  });
  ipcMain.handle('crash:open-folder', () => {
    const { shell } = require('electron');
    fs.mkdirSync(crashDir, { recursive: true });
    shell.openPath(crashDir);
  });
  ipcMain.handle('crash:read-log', async (_, filePath) => {
    try {
      return { success: true, text: fs.readFileSync(filePath, 'utf-8') };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('crash:test', async () => {
    const now = new Date();
    const dummyStacktrace = `03-31 01:20:15.123 E/AndroidRuntime(12345): FATAL EXCEPTION: main
03-31 01:20:15.123 E/AndroidRuntime(12345): Process: com.example.socialapp, PID: 12345
03-31 01:20:15.123 E/AndroidRuntime(12345): java.lang.NullPointerException: Attempt to invoke virtual method 'void android.widget.TextView.setText(java.lang.CharSequence)' on a null object reference
03-31 01:20:15.123 E/AndroidRuntime(12345):     at com.example.socialapp.ui.friend.FriendListFragment.onFriendButtonClick(FriendListFragment.java:142)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at com.example.socialapp.ui.friend.FriendListAdapter$ViewHolder.lambda$bind$0(FriendListAdapter.java:87)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.view.View.performClick(View.java:7448)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.view.View.access$3600(View.java:810)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.widget.Button.performClick(Button.java:187)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.os.Handler.handleCallback(Handler.java:938)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.os.Looper.loop(Looper.java:223)
03-31 01:20:15.123 E/AndroidRuntime(12345):     at android.app.ActivityThread.main(ActivityThread.java:7656)`;

    const crash = {
      time: now.toISOString(),
      timeLocal: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
      type: 'CRASH',
      app: 'com.example.socialapp',
      activity: 'com.example.socialapp/.ui.friend.FriendListActivity',
      preview: dummyStacktrace.split('\n').slice(0, 5).join('\n'),
      stacktrace: dummyStacktrace,
      file: null,
      summary: null,
    };

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('crash-detected', crash);
    }

    const cfg = loadConfig();
    if (cfg.geminiApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(cfg.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = buildCrashSummaryPrompt(crash);
        const result = await model.generateContent(prompt);
        const summary = result.response.text().trim();
        crash.summary = summary;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('crash-summary-updated', { time: crash.time, summary });
        }
      } catch {}
    }

    return { success: true };
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
  crashMonitor.stop();
  adb.stopLogcat();
  adb.stopScreenRecord();
  scrcpyMgr.stop();
  if (process.platform !== 'darwin') app.quit();
});

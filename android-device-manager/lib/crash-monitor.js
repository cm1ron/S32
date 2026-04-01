const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const OVERDARE_PKGS = ['com.overdare.overdare', 'com.overdare.overdare.dev'];

class CrashMonitor extends EventEmitter {
  constructor(adbPath, crashDir) {
    super();
    this.adbPath = adbPath || 'adb';
    this.crashDir = crashDir;
    this.process = null;
    this.serial = null;
    this.deviceName = '';
    this.watchedPkg = null;
    this.watchedPid = null;
    this.watchdogTimer = null;
    this.watchdogInterval = 3000;
    this.buffer = [];
    this.maxBuffer = 200;
    this.collecting = false;
    this.collectLines = [];
    this.collectRemaining = 0;
    this.crashType = null;
    this.crashes = [];
    this._lastWatchdogAlive = true;
  }

  _execAdb(args) {
    return new Promise((resolve) => {
      const fullArgs = this.serial ? ['-s', this.serial, ...args] : args;
      execFile(this.adbPath, fullArgs, { timeout: 5000 }, (err, stdout) => {
        resolve(err ? '' : stdout);
      });
    });
  }

  async _captureContext() {
    const [activityDump, windowDump] = await Promise.all([
      this._execAdb(['shell', 'dumpsys', 'activity', 'top']),
      this._execAdb(['shell', 'dumpsys', 'window', 'windows']),
    ]);

    let activity = '';
    const actMatch = activityDump.match(/ACTIVITY\s+(\S+)\s/);
    if (actMatch) activity = actMatch[1];

    let focusedWindow = '';
    const winMatch = windowDump.match(/mCurrentFocus=Window\{[^}]*\s+(\S+)\}/);
    if (winMatch) focusedWindow = winMatch[1];

    return { activity: activity || focusedWindow || 'unknown', rawActivity: activityDump.slice(0, 2000) };
  }

  async _getPid(pkg) {
    if (!pkg) return null;
    try {
      const out = await this._execAdb(['shell', 'pidof', pkg]);
      const pid = out.trim().split(/\s+/)[0];
      return pid ? parseInt(pid, 10) : null;
    } catch {
      return null;
    }
  }

  async _resolveDeviceName() {
    try {
      const out = await this._execAdb(['shell', 'getprop', 'ro.product.model']);
      this.deviceName = out.trim() || this.serial;
    } catch {
      this.deviceName = this.serial;
    }
  }

  async _autoDetectOverdareApp() {
    for (const pkg of OVERDARE_PKGS) {
      const pid = await this._getPid(pkg);
      if (pid) {
        this.watchedPkg = pkg;
        this.watchedPid = pid;
        this._lastWatchdogAlive = true;
        return;
      }
    }
  }

  start(serial, pkg) {
    this.stop();
    this.serial = serial;
    this.watchedPkg = pkg || null;
    this.watchedPid = null;
    this._lastWatchdogAlive = true;

    this._resolveDeviceName();

    const args = serial
      ? ['-s', serial, 'logcat', '-b', 'main,crash', '-v', 'time']
      : ['logcat', '-b', 'main,crash', '-v', 'time'];

    this.process = spawn(this.adbPath, args);

    let partial = '';
    this.process.stdout.on('data', (chunk) => {
      const text = partial + chunk.toString();
      const lines = text.split('\n');
      partial = lines.pop();
      for (const line of lines) {
        this._processLine(line);
      }
    });

    this.process.on('close', () => {
      this.process = null;
    });

    this.process.on('error', () => {
      this.process = null;
    });

    if (this.watchedPkg) {
      this._initWatchdog();
    } else {
      this._autoDetectOverdareApp().then(() => {
        if (this.watchedPkg) {
          this._initWatchdog();
        }
      });
    }
  }

  setWatchedApp(pkg) {
    this.watchedPkg = pkg || null;
    this.watchedPid = null;
    this._lastWatchdogAlive = true;
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.watchedPkg && this.serial) {
      this._initWatchdog();
    }
  }

  async _initWatchdog() {
    const pid = await this._getPid(this.watchedPkg);
    this.watchedPid = pid;
    this._lastWatchdogAlive = !!pid;

    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => this._watchdogCheck(), this.watchdogInterval);
  }

  async _watchdogCheck() {
    if (!this.watchedPkg || !this.serial) return;

    const pid = await this._getPid(this.watchedPkg);

    if (this._lastWatchdogAlive && !pid) {
      const prevPid = this.watchedPid;
      this.watchedPid = null;
      this._lastWatchdogAlive = false;
      await this._handleUnexpectedExit(prevPid);
    } else if (pid) {
      if (this.watchedPid !== pid) {
        this.watchedPid = pid;
      }
      this._lastWatchdogAlive = true;
    } else if (!pid && !this._lastWatchdogAlive) {
      await this._autoDetectOverdareApp();
      if (this.watchedPid) {
        this._lastWatchdogAlive = true;
      }
    }
  }

  async _handleUnexpectedExit(prevPid) {
    const now = new Date();
    const recentLines = [...this.buffer].slice(-60);

    const hasLogcatCrash = recentLines.some(
      (l) => /FATAL EXCEPTION/i.test(l) || /FATAL signal/i.test(l) || /ANR in/i.test(l)
    );
    if (hasLogcatCrash) return;

    let stacktrace = '';
    try {
      const crashBuf = await this._execAdb(['shell', 'logcat', '-d', '-b', 'crash', '-t', '100']);
      if (crashBuf.trim()) {
        const pkgLines = crashBuf.split('\n').filter(
          (l) => l.includes(this.watchedPkg) || (prevPid && l.includes(String(prevPid)))
        );
        if (pkgLines.length) {
          stacktrace = pkgLines.join('\n');
        }
      }
    } catch {}

    if (!stacktrace) {
      const contextLines = recentLines.filter(
        (l) => l.includes(this.watchedPkg) || (prevPid && l.includes(String(prevPid)))
      );
      if (contextLines.length) {
        stacktrace = contextLines.join('\n');
      }
    }

    if (!stacktrace) {
      stacktrace = `Process ${this.watchedPkg} (PID: ${prevPid || 'unknown'}) terminated unexpectedly.\n` +
        `No standard crash signature found in logcat.\n` +
        `This may indicate a native/Unreal Engine crash or low-memory kill.\n\n` +
        `--- Recent logcat context ---\n` +
        recentLines.slice(-30).join('\n');
    }

    const crash = {
      time: now.toISOString(),
      timeLocal: this._formatTime(now),
      type: 'UNEXPECTED_EXIT',
      app: this.watchedPkg,
      device: this.deviceName || this.serial,
      serial: this.serial,
      activity: 'unknown',
      preview: `${this.watchedPkg} (PID: ${prevPid || '?'}) 프로세스가 예기치 않게 종료됨`,
      stacktrace,
      file: null,
      summary: null,
    };

    try {
      const ctx = await this._captureContext();
      crash.activity = ctx.activity;
    } catch {}

    const filePath = this._saveCrashLog(now, crash, stacktrace);
    crash.file = filePath;
    this.crashes.push(crash);
    this.emit('crash', crash);
  }

  stop() {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.serial = null;
    this.deviceName = '';
    this.watchedPkg = null;
    this.watchedPid = null;
    this.buffer = [];
    this.collecting = false;
    this.collectLines = [];
    this._lastWatchdogAlive = true;
  }

  isRunning() {
    return this.process !== null;
  }

  _processLine(line) {
    this.buffer.push(line);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }

    if (this.collecting) {
      this.collectLines.push(line);
      this.collectRemaining--;
      if (this.collectRemaining <= 0) {
        this._finishCrash();
      }
      return;
    }

    if (/FATAL EXCEPTION/i.test(line)) {
      this._startCollect('CRASH', line);
    } else if (/ANR in/i.test(line)) {
      this._startCollect('ANR', line);
    } else if (/FATAL signal/i.test(line)) {
      this._startCollect('NATIVE_CRASH', line);
    }
  }

  _startCollect(type, triggerLine) {
    this.collecting = true;
    this.crashType = type;
    const contextBefore = this.buffer.slice(-30, -1);
    this.collectLines = [...contextBefore, triggerLine];
    this.collectRemaining = 30;
  }

  _extractAppFromLines(lines) {
    for (const l of lines) {
      const procMatch = l.match(/Process:\s*(\S+?)(?:,|\s|$)/i);
      if (procMatch) return procMatch[1];
    }
    for (const l of lines) {
      const sigMatch = l.match(/FATAL signal.*?tid\s+\d+\s+\(([^)]+)\)/i);
      if (sigMatch) return sigMatch[1];
    }
    for (const l of lines) {
      const anrMatch = l.match(/ANR in\s+(\S+)/i);
      if (anrMatch) return anrMatch[1];
    }
    for (const l of lines) {
      for (const pkg of OVERDARE_PKGS) {
        if (l.includes(pkg)) return pkg;
      }
    }
    return '';
  }

  async _finishCrash() {
    this.collecting = false;
    const now = new Date();
    const stacktrace = this.collectLines.join('\n');

    const app = this._extractAppFromLines(this.collectLines);

    const isOurApp = app && OVERDARE_PKGS.some((p) => app.startsWith(p));
    const isWatchedApp = app && this.watchedPkg && app.startsWith(this.watchedPkg);

    if (!isOurApp && !isWatchedApp) {
      this.collectLines = [];
      return;
    }

    let context = { activity: 'unknown', rawActivity: '' };
    try {
      context = await this._captureContext();
    } catch {}

    const crash = {
      time: now.toISOString(),
      timeLocal: this._formatTime(now),
      type: this.crashType,
      app,
      device: this.deviceName || this.serial,
      serial: this.serial,
      activity: context.activity,
      preview: this.collectLines.slice(0, 5).join('\n'),
      stacktrace,
      file: null,
      summary: null,
    };

    const filePath = this._saveCrashLog(now, crash, stacktrace);
    crash.file = filePath;
    this.crashes.push(crash);

    this.emit('crash', crash);
    this.collectLines = [];
  }

  _formatTime(d) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  _saveCrashLog(now, crash, stacktrace) {
    const today = now.toISOString().slice(0, 10);
    const dir = path.join(this.crashDir, today);
    fs.mkdirSync(dir, { recursive: true });

    const time = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    const fileName = `${crash.type.toLowerCase()}_${time}.log`;
    const filePath = path.join(dir, fileName);

    const header = [
      `Type: ${crash.type}`,
      `App: ${crash.app}`,
      `Device: ${crash.device} (${crash.serial})`,
      `Time: ${crash.time}`,
      `Activity: ${crash.activity}`,
      '='.repeat(60),
      '',
    ].join('\n');
    fs.writeFileSync(filePath, header + stacktrace, 'utf-8');
    return filePath;
  }

  getHistory() {
    return [...this.crashes].reverse();
  }

  clearHistory() {
    this.crashes = [];
  }
}

module.exports = CrashMonitor;

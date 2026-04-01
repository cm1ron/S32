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

    this.logcatProcs = new Map();
    this.deviceNames = new Map();
    this.deviceBuffers = new Map();

    this.watchedPkg = null;
    this.watchedPids = new Map();
    this.watchdogTimer = null;
    this.watchdogInterval = 3000;

    this.pollTimer = null;
    this.pollInterval = 5000;
    this.seenCrashKeys = new Set();

    this.connectedSerials = [];
    this.crashes = [];
    this.collecting = new Map();
  }

  _exec(args, timeout = 5000) {
    return new Promise((resolve) => {
      execFile(this.adbPath, args, { timeout, maxBuffer: 1024 * 512 }, (err, stdout) => {
        resolve(err ? '' : (stdout || ''));
      });
    });
  }

  _execForSerial(serial, args) {
    return this._exec(['-s', serial, ...args]);
  }

  async _resolveDeviceName(serial) {
    if (this.deviceNames.has(serial)) return this.deviceNames.get(serial);
    const out = await this._execForSerial(serial, ['shell', 'getprop', 'ro.product.model']);
    const name = out.trim() || serial;
    this.deviceNames.set(serial, name);
    return name;
  }

  async _getPid(serial, pkg) {
    if (!pkg) return null;
    const out = await this._execForSerial(serial, ['shell', 'pidof', pkg]);
    const pid = out.trim().split(/\s+/)[0];
    return pid ? parseInt(pid, 10) : null;
  }

  async _autoDetectPkg(serial) {
    for (const pkg of OVERDARE_PKGS) {
      const pid = await this._getPid(serial, pkg);
      if (pid) return { pkg, pid };
    }
    return null;
  }

  start(serialOrSerials) {
    this.stop();

    const serials = Array.isArray(serialOrSerials)
      ? serialOrSerials
      : serialOrSerials ? [serialOrSerials] : [];
    this.connectedSerials = [...serials];

    for (const serial of serials) {
      this._startLogcatStream(serial);
      this._resolveDeviceName(serial);
    }

    this._seedExistingCrashes().then(() => {
      this._startPollTimer();
      this._startWatchdog();
    });
  }

  updateDevices(serials) {
    const newSet = new Set(serials);
    const oldSet = new Set(this.connectedSerials);

    for (const s of serials) {
      if (!oldSet.has(s)) {
        this._startLogcatStream(s);
        this._resolveDeviceName(s);
      }
    }
    for (const s of this.connectedSerials) {
      if (!newSet.has(s)) {
        this._stopLogcatStream(s);
        this.deviceNames.delete(s);
        this.deviceBuffers.delete(s);
        this.watchedPids.delete(s);
        this.collecting.delete(s);
      }
    }
    this.connectedSerials = [...serials];
  }

  _startLogcatStream(serial) {
    if (this.logcatProcs.has(serial)) return;

    const args = ['-s', serial, 'logcat', '-b', 'main,crash', '-v', 'time'];
    const proc = spawn(this.adbPath, args);

    if (!proc || !proc.stdout) {
      return;
    }

    this.deviceBuffers.set(serial, []);
    this.collecting.set(serial, null);

    let partial = '';
    proc.stdout.on('data', (chunk) => {
      const text = partial + chunk.toString();
      const lines = text.split('\n');
      partial = lines.pop();
      for (const line of lines) {
        this._processStreamLine(serial, line);
      }
    });

    proc.on('close', () => {
      this.logcatProcs.delete(serial);
    });

    proc.on('error', () => {
      this.logcatProcs.delete(serial);
    });

    this.logcatProcs.set(serial, proc);
  }

  _stopLogcatStream(serial) {
    const proc = this.logcatProcs.get(serial);
    if (proc) {
      try { proc.kill(); } catch {}
      this.logcatProcs.delete(serial);
    }
  }

  _processStreamLine(serial, line) {
    const buf = this.deviceBuffers.get(serial) || [];
    buf.push(line);
    if (buf.length > 300) buf.splice(0, buf.length - 300);
    this.deviceBuffers.set(serial, buf);

    const state = this.collecting.get(serial);
    if (state) {
      state.lines.push(line);
      state.remaining--;
      if (state.remaining <= 0) {
        this._finishStreamCrash(serial, state);
        this.collecting.set(serial, null);
      }
      return;
    }

    if (/FATAL EXCEPTION/i.test(line)) {
      this._startStreamCollect(serial, 'CRASH', line);
    } else if (/ANR in/i.test(line)) {
      this._startStreamCollect(serial, 'ANR', line);
    } else if (/FATAL signal/i.test(line)) {
      this._startStreamCollect(serial, 'NATIVE_CRASH', line);
    }
  }

  _startStreamCollect(serial, type, triggerLine) {
    const buf = this.deviceBuffers.get(serial) || [];
    const contextBefore = buf.slice(-30, -1);
    this.collecting.set(serial, {
      type,
      lines: [...contextBefore, triggerLine],
      remaining: 30,
    });
  }

  async _finishStreamCrash(serial, state) {
    const app = this._extractApp(state.lines);
    const isOur = app && OVERDARE_PKGS.some((p) => app.startsWith(p));
    const isWatched = app && this.watchedPkg && app.startsWith(this.watchedPkg);

    if (!isOur && !isWatched) return;

    const crashKey = this._makeCrashKey(serial, state.type, app, state.lines);
    if (this.seenCrashKeys.has(crashKey)) return;
    this.seenCrashKeys.add(crashKey);

    const buf = this.deviceBuffers.get(serial) || [];
    const preContext = buf.slice(-100).join('\n');
    await this._emitCrash(serial, state.type, app, state.lines.join('\n'), preContext);
  }

  async _seedExistingCrashes() {
    for (const serial of this.connectedSerials) {
      try {
        const raw = await this._execForSerial(serial, ['shell', 'logcat', '-d', '-b', 'crash', '-t', '200']);
        if (!raw || !raw.trim()) continue;
        const lines = raw.split('\n');
        let i = 0;
        while (i < lines.length) {
          const line = lines[i];
          if (/FATAL EXCEPTION/i.test(line) || /FATAL signal/i.test(line) || /ANR in/i.test(line)) {
            const type = /FATAL EXCEPTION/i.test(line) ? 'CRASH' : /ANR/i.test(line) ? 'ANR' : 'NATIVE_CRASH';
            const block = this._extractBlock(lines, i, type);
            const app = this._extractApp(block.lines);
            if (app) {
              const key = this._makeCrashKey(serial, type, app, block.lines);
              this.seenCrashKeys.add(key);
            }
            i = block.endIdx;
            continue;
          }
          i++;
        }
      } catch {}
    }
  }

  _startPollTimer() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this._pollAllDevices(), this.pollInterval);
    setTimeout(() => this._pollAllDevices(), 1000);
  }

  async _pollAllDevices() {
    for (const serial of this.connectedSerials) {
      try {
        await this._pollCrashBuffer(serial);
      } catch {}
    }
  }

  async _pollCrashBuffer(serial) {
    const raw = await this._execForSerial(serial, ['shell', 'logcat', '-d', '-b', 'crash', '-t', '100']);
    if (!raw || !raw.trim()) return;

    const lines = raw.split('\n');
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (/FATAL EXCEPTION/i.test(line)) {
        const block = this._extractBlock(lines, i, 'CRASH');
        const app = this._extractApp(block.lines);
        if (app && this._isRelevantApp(app)) {
          const key = this._makeCrashKey(serial, 'CRASH', app, block.lines);
          if (!this.seenCrashKeys.has(key)) {
            this.seenCrashKeys.add(key);
            await this._emitCrash(serial, 'CRASH', app, block.lines.join('\n'));
          }
        }
        i = block.endIdx;
        continue;
      }

      if (/FATAL signal/i.test(line)) {
        const block = this._extractBlock(lines, i, 'NATIVE_CRASH');
        const app = this._extractApp(block.lines);
        if (app && this._isRelevantApp(app)) {
          const key = this._makeCrashKey(serial, 'NATIVE_CRASH', app, block.lines);
          if (!this.seenCrashKeys.has(key)) {
            this.seenCrashKeys.add(key);
            await this._emitCrash(serial, 'NATIVE_CRASH', app, block.lines.join('\n'));
          }
        }
        i = block.endIdx;
        continue;
      }

      if (/ANR in/i.test(line)) {
        const block = this._extractBlock(lines, i, 'ANR');
        const app = this._extractApp(block.lines);
        if (app && this._isRelevantApp(app)) {
          const key = this._makeCrashKey(serial, 'ANR', app, block.lines);
          if (!this.seenCrashKeys.has(key)) {
            this.seenCrashKeys.add(key);
            await this._emitCrash(serial, 'ANR', app, block.lines.join('\n'));
          }
        }
        i = block.endIdx;
        continue;
      }

      i++;
    }
  }

  _extractBlock(lines, startIdx, type) {
    const blockLines = [];
    const contextStart = Math.max(0, startIdx - 5);
    for (let j = contextStart; j < startIdx; j++) blockLines.push(lines[j]);

    let endIdx = startIdx;
    for (let j = startIdx; j < Math.min(lines.length, startIdx + 40); j++) {
      blockLines.push(lines[j]);
      endIdx = j + 1;
    }
    return { lines: blockLines, endIdx };
  }

  _isRelevantApp(app) {
    if (!app) return false;
    const isOur = OVERDARE_PKGS.some((p) => app.startsWith(p));
    const isWatched = this.watchedPkg && app.startsWith(this.watchedPkg);
    return isOur || isWatched;
  }

  _makeCrashKey(serial, type, app, lines) {
    let ts = '';
    for (const l of lines) {
      const m = l.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+)/);
      if (m) { ts = m[1]; break; }
    }
    let pid = '';
    for (const l of lines) {
      const m = l.match(/PID:\s*(\d+)/i);
      if (m) { pid = m[1]; break; }
    }
    if (!pid) {
      for (const l of lines) {
        const m = l.match(/^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+\s+(\d+)/);
        if (m) { pid = m[1]; break; }
      }
    }
    return `${serial}|${type}|${app}|${ts}|${pid}`;
  }

  _extractApp(lines) {
    for (const l of lines) {
      const m = l.match(/Process:\s*(\S+?)(?:,|\s|$)/i);
      if (m) return m[1];
    }
    for (const l of lines) {
      const m = l.match(/FATAL signal.*?tid\s+\d+\s+\(([^)]+)\)/i);
      if (m) return m[1];
    }
    for (const l of lines) {
      const m = l.match(/ANR in\s+(\S+)/i);
      if (m) return m[1];
    }
    for (const l of lines) {
      for (const pkg of OVERDARE_PKGS) {
        if (l.includes(pkg)) return pkg;
      }
    }
    return '';
  }

  _startWatchdog() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    this.watchdogTimer = setInterval(() => this._watchdogTick(), this.watchdogInterval);
  }

  async _watchdogTick() {
    for (const serial of this.connectedSerials) {
      await this._watchdogCheckDevice(serial);
    }
  }

  async _watchdogCheckDevice(serial) {
    const detected = await this._autoDetectPkg(serial);
    const prevPid = this.watchedPids.get(serial);
    const pkg = this.watchedPkg || (detected ? detected.pkg : null);

    if (!pkg) {
      if (detected) {
        this.watchedPids.set(serial, detected.pid);
      }
      return;
    }

    const currentPid = await this._getPid(serial, pkg);

    if (prevPid && !currentPid) {
      this.watchedPids.set(serial, null);
      const crashKey = `${serial}|UNEXPECTED_EXIT|${pkg}|${Date.now()}`;
      if (!this.seenCrashKeys.has(crashKey)) {
        this.seenCrashKeys.add(crashKey);
        const buf = this.deviceBuffers.get(serial) || [];
        const context = buf.slice(-40).join('\n');
        const stacktrace = `Process ${pkg} (PID: ${prevPid}) terminated unexpectedly.\n` +
          `No standard crash signature found in logcat stream.\n\n` +
          `--- Recent logcat context ---\n${context}`;
        await this._emitCrash(serial, 'UNEXPECTED_EXIT', pkg, stacktrace);
      }
    } else if (currentPid) {
      this.watchedPids.set(serial, currentPid);
    }
  }

  async _emitCrash(serial, type, app, stacktrace, preContext) {
    const now = new Date();
    const deviceName = this.deviceNames.get(serial) || serial;

    let activity = 'unknown';
    try {
      const dump = await this._execForSerial(serial, ['shell', 'dumpsys', 'activity', 'top']);
      const m = dump.match(/ACTIVITY\s+(\S+)\s/);
      if (m) activity = m[1];
    } catch {}

    let uiHierarchy = '';
    try {
      await this._execForSerial(serial, ['shell', 'uiautomator', 'dump', '/sdcard/window_dump.xml']);
      const xmlRaw = await this._execForSerial(serial, ['shell', 'cat', '/sdcard/window_dump.xml']);
      if (xmlRaw) {
        const focused = this._extractFocusedUI(xmlRaw, app);
        uiHierarchy = focused;
      }
      this._execForSerial(serial, ['shell', 'rm', '/sdcard/window_dump.xml']);
    } catch {}

    let contextText = preContext || '';
    if (!contextText) {
      const buf = this.deviceBuffers.get(serial) || [];
      contextText = buf.slice(-100).join('\n');
    }
    if (!contextText) {
      try {
        const recent = await this._execForSerial(serial, ['shell', 'logcat', '-d', '-t', '100']);
        contextText = recent || '';
      } catch {}
    }

    const filteredContext = this._filterRelevantContext(contextText, app);

    const crash = {
      time: now.toISOString(),
      timeLocal: this._formatTime(now),
      type,
      app,
      device: deviceName,
      serial,
      activity,
      preview: stacktrace.split('\n').slice(0, 5).join('\n'),
      stacktrace,
      preContext: filteredContext,
      uiHierarchy,
      file: null,
      summary: null,
    };

    try {
      const filePath = this._saveCrashLog(now, crash, stacktrace);
      crash.file = filePath;
    } catch {}

    this.crashes.push(crash);
    this.emit('crash', crash);
  }

  _extractFocusedUI(xml, pkg) {
    const nodes = [];
    const nodeRegex = /<node[^>]+>/g;
    let match;
    while ((match = nodeRegex.exec(xml)) !== null) {
      const tag = match[0];
      const rid = (tag.match(/resource-id="([^"]*)"/) || [])[1] || '';
      const cls = (tag.match(/class="([^"]*)"/) || [])[1] || '';
      const text = (tag.match(/text="([^"]*)"/) || [])[1] || '';
      const desc = (tag.match(/content-desc="([^"]*)"/) || [])[1] || '';
      const clickable = tag.includes('clickable="true"');
      const focused = tag.includes('focused="true"');
      const bounds = (tag.match(/bounds="([^"]*)"/) || [])[1] || '';

      if (rid || text || desc || clickable || focused) {
        const parts = [];
        if (rid) parts.push(`id="${rid}"`);
        if (cls) parts.push(`class="${cls.split('.').pop()}"`);
        if (text) parts.push(`text="${text.slice(0, 50)}"`);
        if (desc) parts.push(`desc="${desc.slice(0, 50)}"`);
        if (clickable) parts.push('clickable');
        if (focused) parts.push('FOCUSED');
        if (bounds) parts.push(`bounds=${bounds}`);
        nodes.push(parts.join(' '));
      }
    }
    return nodes.slice(0, 60).join('\n');
  }

  _filterRelevantContext(contextText, app) {
    if (!contextText) return '';
    const lines = contextText.split('\n');
    const shortPkg = app ? app.split('.').pop() : '';
    const keywords = [
      'overdare', 'grpc', 'gRPC', 'createChannel', 'farm-',
      'Activity', 'Fragment', 'onClick', 'onTouch', 'Button',
      'ViewClick', 'input_event', 'MotionEvent', 'Navigation',
      'Error', 'Exception', 'FATAL', 'ANR', 'signal',
      'market', 'shop', 'friend', 'profile', 'world', 'lobby',
      'mission', 'avatar', 'emote', 'chat',
    ];
    if (shortPkg) keywords.push(shortPkg);

    const filtered = lines.filter((l) => {
      if (!l.trim()) return false;
      const lower = l.toLowerCase();
      return keywords.some((k) => lower.includes(k.toLowerCase()));
    });

    return filtered.slice(-80).join('\n');
  }

  _formatTime(d) {
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  }

  _saveCrashLog(now, crash, stacktrace) {
    const today = now.toISOString().slice(0, 10);
    const dir = path.join(this.crashDir, today);
    fs.mkdirSync(dir, { recursive: true });

    const time = `${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    const fileName = `${crash.type.toLowerCase()}_${crash.serial.replace(/[:.]/g, '_')}_${time}.log`;
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

  setWatchedApp(pkg) {
    this.watchedPkg = pkg || null;
  }

  stop() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    for (const [serial, proc] of this.logcatProcs) {
      try { proc.kill(); } catch {}
    }
    this.logcatProcs.clear();
    this.deviceBuffers.clear();
    this.collecting.clear();
    this.watchedPids.clear();
    this.connectedSerials = [];
    this.seenCrashKeys.clear();
  }

  isRunning() {
    return this.pollTimer !== null || this.logcatProcs.size > 0;
  }

  getHistory() {
    return [...this.crashes].reverse();
  }

  clearHistory() {
    this.crashes = [];
  }
}

module.exports = CrashMonitor;

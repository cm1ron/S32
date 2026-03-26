const { execFile, spawn, execSync } = require('child_process');
const path = require('path');
const isWin = process.platform === 'win32';

class AdbManager {
  constructor() {
    this.adbPath = 'adb';
    this.logcatProcess = null;
  }

  _exec(args, serial) {
    return new Promise((resolve, reject) => {
      const fullArgs = serial ? ['-s', serial, ...args] : args;
      execFile(this.adbPath, fullArgs, { maxBuffer: 1024 * 1024 * 10, encoding: 'buffer' }, (err, stdout, stderr) => {
        if (err && !stdout.length) {
          reject(new Error(stderr ? stderr.toString() : err.message));
          return;
        }
        resolve(stdout);
      });
    });
  }

  _execText(args, serial) {
    return new Promise((resolve, reject) => {
      const fullArgs = serial ? ['-s', serial, ...args] : args;
      execFile(this.adbPath, fullArgs, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(new Error(stderr || err.message));
          return;
        }
        resolve(stdout);
      });
    });
  }

  async getDevices() {
    try {
      const output = await this._execText(['devices', '-l']);
      const lines = output.trim().split('\n').slice(1);
      return lines
        .filter((l) => l.trim() && l.includes('device'))
        .map((line) => {
          const parts = line.trim().split(/\s+/);
          const serial = parts[0];
          const props = {};
          parts.slice(2).forEach((p) => {
            const [k, v] = p.split(':');
            if (k && v) props[k] = v;
          });
          return { serial, model: props.model || 'Unknown', product: props.product || '', device: props.device || '' };
        });
    } catch {
      return [];
    }
  }

  async getDeviceInfo(serial) {
    const propMap = {
      'ro.product.model': 'model',
      'ro.product.manufacturer': 'manufacturer',
      'ro.build.version.release': 'androidVersion',
      'ro.build.version.sdk': 'apiLevel',
      'ro.build.display.id': 'buildNumber',
      'ro.product.brand': 'brand',
      'ro.serialno': 'serialNumber',
    };

    const info = { serial };
    try {
      const output = await this._execText(['shell', 'getprop'], serial);
      for (const line of output.split('\n')) {
        const match = line.match(/\[(.+?)\]:\s*\[(.+?)\]/);
        if (match && propMap[match[1]]) {
          info[propMap[match[1]]] = match[2];
        }
      }
    } catch { /* ignore */ }

    try {
      const size = await this._execText(['shell', 'wm', 'size'], serial);
      const m = size.match(/(\d+x\d+)/);
      if (m) info.resolution = m[1];
    } catch { /* ignore */ }

    try {
      const battery = await this._execText(['shell', 'dumpsys', 'battery'], serial);
      const level = battery.match(/level:\s*(\d+)/);
      const status = battery.match(/status:\s*(\d+)/);
      if (level) info.batteryLevel = parseInt(level[1]);
      const statusMap = { 2: 'Charging', 3: 'Discharging', 4: 'Not charging', 5: 'Full' };
      if (status) info.batteryStatus = statusMap[status[1]] || 'Unknown';
    } catch { /* ignore */ }

    try {
      const df = await this._execText(['shell', 'df', '/data'], serial);
      const lines = df.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        if (parts.length >= 4) {
          const total = parseInt(parts[1]);
          const used = parseInt(parts[2]);
          const available = parseInt(parts[3]);
          info.storage = { total, used, available };
        }
      }
    } catch { /* ignore */ }

    return info;
  }

  async installApk(serial, apkPath) {
    try {
      const output = await this._execText(['install', '-r', '-d', '--user', '0', apkPath], serial);
      return { success: output.includes('Success'), output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async listPackages(serial, filter) {
    try {
      const args = ['shell', 'pm', 'list', 'packages', '-3', '--user', '0'];
      if (filter) args.push(filter);
      const output = await this._execText(args, serial);
      const pkgs = output
        .trim()
        .split('\n')
        .filter((l) => l.startsWith('package:'))
        .map((l) => l.replace('package:', '').trim())
        .sort();

      const results = await Promise.all(pkgs.map(async (pkg) => {
        const ver = await this.getPackageVersion(serial, pkg);
        return { name: pkg, version: ver };
      }));
      return results;
    } catch {
      return [];
    }
  }

  async getPackageVersion(serial, pkg) {
    try {
      const output = await this._execText(['shell', 'dumpsys', 'package', pkg], serial);
      const m = output.match(/versionName=(.+)/);
      return m ? m[1].trim() : '';
    } catch {
      return '';
    }
  }

  async uninstallPackage(serial, pkg) {
    try {
      const output = await this._execText(['uninstall', '--user', '0', pkg], serial);
      return { success: output.includes('Success'), output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async launchApp(serial, pkg) {
    try {
      const output = await this._execText(
        ['shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'],
        serial
      );
      return { success: true, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async forceStop(serial, pkg) {
    try {
      await this._execText(['shell', 'am', 'force-stop', pkg], serial);
      return { success: true };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async clearData(serial, pkg) {
    try {
      const output = await this._execText(['shell', 'pm', 'clear', pkg], serial);
      return { success: output.includes('Success'), output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  startLogcat(serial, filters, onLine) {
    this.stopLogcat();
    const args = ['-s', serial, 'logcat', '-v', 'threadtime'];
    if (filters && filters.length) {
      args.push(...filters);
    }
    this.logcatProcess = spawn(this.adbPath, args, { detached: !isWin });
    let buffer = '';
    this.logcatProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach((line) => {
        if (line.trim()) onLine(line);
      });
    });
    this.logcatProcess.stderr.on('data', (data) => {
      onLine(`[stderr] ${data.toString().trim()}`);
    });
  }

  stopLogcat() {
    if (this.logcatProcess) {
      const pid = this.logcatProcess.pid;
      try {
        if (isWin) {
          execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
        } else {
          process.kill(-pid, 'SIGKILL');
        }
      } catch {
        try { this.logcatProcess.kill('SIGKILL'); } catch { /* ignore */ }
      }
      this.logcatProcess = null;
    }
  }

  async clearLogcat(serial) {
    try {
      await this._execText(['logcat', '-c'], serial);
      return { success: true };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async listFiles(serial, remotePath) {
    try {
      const output = await this._execText(['shell', 'ls', '-la', remotePath], serial);
      const lines = output.trim().split('\n');
      const files = [];
      for (const line of lines) {
        if (line.startsWith('total') || !line.trim()) continue;
        const match = line.match(/^([drwx\-lsStT]{10})\s+\S+\s+(\S+)\s+(\S+)\s+(\d+)?\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+)$/);
        if (match) {
          const name = match[6].trim();
          if (name === '.' || name === '..') continue;
          files.push({
            permissions: match[1],
            owner: match[2],
            group: match[3],
            size: match[4] ? parseInt(match[4]) : 0,
            date: match[5],
            name: name.includes(' -> ') ? name.split(' -> ')[0] : name,
            isDirectory: match[1].startsWith('d'),
            isLink: match[1].startsWith('l'),
            fullPath: remotePath.replace(/\/+$/, '') + '/' + (name.includes(' -> ') ? name.split(' -> ')[0] : name),
          });
        }
      }
      return files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (e) {
      return [];
    }
  }

  async pullFile(serial, remotePath, localPath) {
    try {
      const output = await this._execText(['pull', remotePath, localPath], serial);
      return { success: true, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async pushFile(serial, localPath, remotePath) {
    try {
      const output = await this._execText(['push', localPath, remotePath], serial);
      return { success: true, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async deleteFile(serial, remotePath) {
    try {
      await this._execText(['shell', 'rm', '-rf', remotePath], serial);
      return { success: true };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async screencap(serial) {
    try {
      const buffer = await this._exec(['exec-out', 'screencap', '-p'], serial);
      return { success: true, data: buffer.toString('base64') };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async dumpUi(serial) {
    try {
      await this._execText(['shell', 'uiautomator', 'dump', '/sdcard/ui_dump.xml'], serial);
      const xml = await this._execText(['shell', 'cat', '/sdcard/ui_dump.xml'], serial);
      const screencap = await this.screencap(serial);
      return { success: true, xml, screenshot: screencap.success ? screencap.data : null };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async pair(address, code) {
    try {
      const output = await this._execText(['pair', address, code]);
      const success = output.toLowerCase().includes('successfully paired');
      return { success, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async connectWireless(address) {
    try {
      const output = await this._execText(['connect', address]);
      const success = output.toLowerCase().includes('connected');
      return { success, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async disconnectWireless(address) {
    try {
      const output = await this._execText(['disconnect', address || '']);
      return { success: true, output: output.trim() };
    } catch (e) {
      return { success: false, output: e.message };
    }
  }

  async inputTap(serial, x, y) {
    try {
      await this._execText(['shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))], serial);
    } catch { /* ignore */ }
  }

  async inputSwipe(serial, x1, y1, x2, y2, durationMs) {
    try {
      await this._execText([
        'shell', 'input', 'swipe',
        String(Math.round(x1)), String(Math.round(y1)),
        String(Math.round(x2)), String(Math.round(y2)),
        String(durationMs || 300),
      ], serial);
    } catch { /* ignore */ }
  }

  async inputKeyEvent(serial, keycode) {
    try {
      await this._execText(['shell', 'input', 'keyevent', String(keycode)], serial);
    } catch { /* ignore */ }
  }

  async inputText(serial, text) {
    try {
      await this._execText(['shell', 'input', 'text', text.replace(/ /g, '%s')], serial);
    } catch { /* ignore */ }
  }
}

module.exports = AdbManager;

const { spawn } = require('child_process');
const path = require('path');
const isWin = process.platform === 'win32';

class ScrcpyManager {
  constructor(scrcpyDir) {
    const bin = isWin ? 'scrcpy.exe' : 'scrcpy';
    this.scrcpyPath = scrcpyDir ? path.join(scrcpyDir, bin) : bin;
    this.process = null;
    this.onExit = null;
  }

  start(serial, options = {}) {
    this.stop();
    const args = ['-s', serial];

    if (options.maxSize) args.push('--max-size', String(options.maxSize));
    if (options.bitRate) args.push('--video-bit-rate', String(options.bitRate));
    if (options.maxFps) args.push('--max-fps', String(options.maxFps));
    if (options.rotation) args.push('--rotation', String(options.rotation));
    if (options.windowTitle) args.push('--window-title', options.windowTitle);
    if (options.alwaysOnTop) args.push('--always-on-top');
    if (options.stayAwake) args.push('--stay-awake');
    if (options.turnScreenOff) args.push('--turn-screen-off');

    try {
      this.process = spawn(this.scrcpyPath, args, { stdio: 'ignore' });
      this.process.on('exit', () => {
        this.process = null;
        if (this.onExit) this.onExit();
      });
      this.process.on('error', () => {
        this.process = null;
        if (this.onExit) this.onExit();
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    return { success: true };
  }

  isRunning() {
    return this.process !== null && !this.process.killed;
  }
}

module.exports = ScrcpyManager;

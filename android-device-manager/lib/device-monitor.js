const EventEmitter = require('events');

class DeviceMonitor extends EventEmitter {
  constructor(adbManager) {
    super();
    this.adb = adbManager;
    this.interval = null;
    this.lastDevices = '';
  }

  start(intervalMs = 3000) {
    this.poll();
    this.interval = setInterval(() => this.poll(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async poll() {
    try {
      const devices = await this.adb.getDevices();
      const key = JSON.stringify(devices);
      if (key !== this.lastDevices) {
        this.lastDevices = key;
        this.emit('devices-changed', devices);
      }
    } catch { /* ignore */ }
  }
}

module.exports = DeviceMonitor;

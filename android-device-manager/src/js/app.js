const App = {
  currentDevice: null,
  currentPanel: 'device',

  init() {
    this.setupNav();
    this.setupDeviceSelector();
    this.setupWireless();
    this.loadDevices();
  },

  setupNav() {
    document.querySelectorAll('.nav-btn[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchPanel(btn.dataset.panel);
      });
    });
  },

  switchPanel(name) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-panel="${name}"]`).classList.add('active');
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`panel-${name}`).classList.add('active');
    this.currentPanel = name;
  },

  setupDeviceSelector() {
    const sel = document.getElementById('device-selector');
    sel.addEventListener('change', () => {
      this.currentDevice = sel.value || null;
      this.onDeviceChanged();
    });
    window.api.onDevicesChanged((devices) => this.updateDeviceList(devices));
  },

  async loadDevices() {
    const devices = await window.api.getDevices();
    this.updateDeviceList(devices);
  },

  updateDeviceList(devices) {
    const sel = document.getElementById('device-selector');
    const dot = document.getElementById('status-dot');
    const prev = sel.value;

    sel.innerHTML = '';
    if (!devices.length) {
      sel.innerHTML = '<option value="">디바이스를 연결해주세요...</option>';
      dot.classList.add('disconnected');
      this.currentDevice = null;
      this.onDeviceChanged();
      return;
    }

    dot.classList.remove('disconnected');
    devices.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.serial;
      opt.textContent = `${d.model} (${d.serial})`;
      sel.appendChild(opt);
    });

    if (prev && devices.find((d) => d.serial === prev)) {
      sel.value = prev;
    } else {
      sel.value = devices[0].serial;
    }
    this.currentDevice = sel.value;
    this.onDeviceChanged();
  },

  onDeviceChanged() {
    if (typeof DevicePanel !== 'undefined') DevicePanel.refresh();
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  },

  setupWireless() {
    const modal = document.getElementById('wireless-modal');
    const status = document.getElementById('wireless-status');

    document.getElementById('wireless-connect-btn').addEventListener('click', () => {
      modal.style.display = 'flex';
    });
    document.getElementById('wireless-modal-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    document.getElementById('pair-btn').addEventListener('click', async () => {
      const address = document.getElementById('pair-address').value.trim();
      const code = document.getElementById('pair-code').value.trim();
      if (!address || !code) return this.toast('IP:Port와 페어링 코드를 입력해주세요', 'error');

      status.textContent = '페어링 중...';
      status.style.color = 'var(--text-muted)';
      const result = await window.api.pairDevice(address, code);
      if (result.success) {
        status.textContent = '페어링 성공! 아래에서 연결해주세요.';
        status.style.color = 'var(--green)';
        this.toast('페어링 성공', 'success');
      } else {
        status.textContent = `페어링 실패: ${result.output}`;
        status.style.color = 'var(--red)';
        this.toast('페어링 실패', 'error');
      }
    });

    document.getElementById('connect-btn').addEventListener('click', async () => {
      const address = document.getElementById('connect-address').value.trim();
      if (!address) return this.toast('IP:Port를 입력해주세요', 'error');

      status.textContent = '연결 중...';
      status.style.color = 'var(--text-muted)';
      const result = await window.api.connectWireless(address);
      if (result.success) {
        status.textContent = '무선 연결 성공!';
        status.style.color = 'var(--green)';
        this.toast('무선 연결 성공', 'success');
        this.wirelessAddress = address;
        document.getElementById('wireless-disconnect-btn').style.display = '';
        modal.style.display = 'none';
      } else {
        status.textContent = `연결 실패: ${result.output}`;
        status.style.color = 'var(--red)';
        this.toast('연결 실패', 'error');
      }
    });

    document.getElementById('wireless-disconnect-btn').addEventListener('click', async () => {
      await window.api.disconnectWireless(this.wirelessAddress || '');
      this.wirelessAddress = null;
      document.getElementById('wireless-disconnect-btn').style.display = 'none';
      this.toast('무선 연결 해제됨', 'info');
    });
  },

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

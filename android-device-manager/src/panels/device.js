const APP_PKGS = ['com.overdare.overdare.dev', 'com.overdare.overdare'];

const DevicePanel = {
  appInfo: null,
  detectedPkg: null,
  _appInfoBound: false,

  init() {
    if (!this._appInfoBound) {
      this._appInfoBound = true;
      this.setupAppInfoButton();
    }
  },

  async refresh() {
    this.detectedPkg = null;
    this.appInfo = null;
    if (App.currentDevice) {
      try { await window.api.crashRestartMonitor(App.currentDevice); } catch {}
    }
    const serverEl = document.getElementById('app-info-server');
    const unrealEl = document.getElementById('app-info-unreal');
    const appVerEl = document.getElementById('app-info-appver');
    if (serverEl) serverEl.textContent = '-';
    if (unrealEl) unrealEl.textContent = '-';
    if (appVerEl) appVerEl.textContent = '-';
    if (serverEl) serverEl.style.color = '';
    if (unrealEl) unrealEl.style.color = '';
    if (appVerEl) appVerEl.style.color = '';
    const copyBtn = document.getElementById('copy-app-info');
    if (copyBtn) copyBtn.style.display = 'none';

    const container = document.getElementById('device-info-content');
    if (!App.currentDevice) {
      container.innerHTML = '<p style="color:var(--text-muted)">디바이스를 선택하면 정보가 표시됩니다.</p>';
      return;
    }

    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const info = await window.api.getDeviceInfo(App.currentDevice);
      container.innerHTML = this.renderInfo(info);
      this.renderDeviceVisual(info);
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red)">정보 조회 실패: ${e.message}</p>`;
    }
  },

  renderDeviceVisual(info) {
    const el = document.getElementById('device-visual');
    if (!el) return;
    const model = info.model || 'Device';
    const android = info.androidVersion || '';
    const res = info.resolution || '';
    el.innerHTML = `
      <div style="text-align:center;padding:16px;">
        <svg viewBox="0 0 120 220" width="140" style="filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4))">
          <rect x="10" y="5" width="100" height="210" rx="14" fill="#1a1a2e" stroke="#3a3a5c" stroke-width="2"/>
          <rect x="18" y="30" width="84" height="155" rx="2" fill="#89b4fa" opacity="0.15"/>
          <circle cx="60" cy="15" r="3" fill="#3a3a5c"/>
          <rect x="45" y="12" width="30" height="6" rx="3" fill="#2a2a4a"/>
          <circle cx="60" cy="200" r="8" fill="none" stroke="#3a3a5c" stroke-width="1.5"/>
          <text x="60" y="110" text-anchor="middle" fill="#89b4fa" font-size="11" font-family="sans-serif">${model}</text>
        </svg>
        <div style="margin-top:12px;font-size:12px;color:var(--text-muted)">
          ${model}
          ${android ? '<br>Android ' + android : ''}
          ${res ? '<br>' + res : ''}
        </div>
      </div>`;
  },

  setupAppInfoButton() {
    const btn = document.getElementById('fetch-app-info');
    const copyBtn = document.getElementById('copy-app-info');
    if (btn) {
      btn.addEventListener('click', () => this.fetchAppInfo());
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyAppInfo());
    }
  },

  async detectPkg() {
    if (!App.currentDevice) return null;
    try {
      const fg = await window.api.getForegroundPkg(App.currentDevice);
      if (fg && APP_PKGS.includes(fg)) return fg;
    } catch {}
    const pkgs = await window.api.listPackages(App.currentDevice);
    const names = pkgs.map(p => p.name);
    for (const candidate of APP_PKGS) {
      if (names.includes(candidate)) return candidate;
    }
    return APP_PKGS[0];
  },

  async fetchAppInfo() {
    if (!App.currentDevice) return;
    const btn = document.getElementById('fetch-app-info');
    btn.textContent = '조회 중...';
    btn.disabled = true;

    this.detectedPkg = await this.detectPkg();
    const pkg = this.detectedPkg;

    if (pkg) {
      try { await window.api.crashSetWatchedApp(pkg); } catch {}
    }

    const info = await window.api.getRunningAppInfo(App.currentDevice, pkg);
    info.buildType = pkg.endsWith('.dev') ? 'DEV' : 'RELEASE';
    this.appInfo = info;

    const serverEl = document.getElementById('app-info-server');
    const unrealEl = document.getElementById('app-info-unreal');
    const appVerEl = document.getElementById('app-info-appver');

    serverEl.textContent = info.server || '-';
    unrealEl.textContent = info.unrealVersion || '-';
    appVerEl.textContent = info.appVersion || '-';

    if (info.server) serverEl.style.color = '#a6e3a1';
    if (info.unrealVersion) unrealEl.style.color = '#a6e3a1';
    if (info.appVersion) appVerEl.style.color = '#a6e3a1';

    btn.textContent = '앱 정보 조회';
    btn.disabled = false;

    document.getElementById('copy-app-info').style.display = 'inline-block';
  },

  copyAppInfo() {
    if (!this.appInfo) return;
    const ver = this.appInfo.appVersion || '-';
    const text = `서버환경 : ${this.appInfo.server || '-'}\n언리얼버전 : ${this.appInfo.unrealVersion || '-'}\n앱버전 : ${ver}`;
    navigator.clipboard.writeText(text);
    App.toast('앱 정보 복사됨', 'success');
  },

  renderInfo(info) {
    const storageHtml = info.storage
      ? `<div class="info-item"><label>저장공간</label><span>${App.formatBytes(info.storage.used * 1024)} / ${App.formatBytes(info.storage.total * 1024)}</span></div>
         <div class="info-item"><label>여유 공간</label><span>${App.formatBytes(info.storage.available * 1024)}</span></div>`
      : '';

    return `
      <div class="card">
        <div class="card-title">기본 정보</div>
        <div class="info-grid">
          <div class="info-item"><label>모델</label><span>${info.model || '-'}</span></div>
          <div class="info-item"><label>제조사</label><span>${info.manufacturer || '-'}</span></div>
          <div class="info-item"><label>브랜드</label><span>${info.brand || '-'}</span></div>
          <div class="info-item"><label>시리얼</label><span>${info.serial || '-'}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">시스템</div>
        <div class="info-grid">
          <div class="info-item"><label>Android</label><span>${info.androidVersion || '-'}</span></div>
          <div class="info-item"><label>API Level</label><span>${info.apiLevel || '-'}</span></div>
          <div class="info-item"><label>빌드 넘버</label><span>${info.buildNumber || '-'}</span></div>
          <div class="info-item"><label>해상도</label><span>${info.resolution || '-'}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">배터리 &amp; 저장공간</div>
        <div class="info-grid">
          <div class="info-item"><label>배터리</label><span>${info.batteryLevel != null ? info.batteryLevel + '%' : '-'}</span></div>
          <div class="info-item"><label>충전 상태</label><span>${info.batteryStatus || '-'}</span></div>
          ${storageHtml}
        </div>
      </div>
    `;
  },
};

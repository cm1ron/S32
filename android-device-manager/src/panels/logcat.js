const LogcatPanel = {
  running: false,
  lines: [],
  maxLines: 10000,
  autoScroll: true,
  crashCount: 0,

  init() {
    document.getElementById('logcat-toggle').addEventListener('click', () => this.toggle());
    document.getElementById('logcat-clear').addEventListener('click', () => this.clear());
    document.getElementById('logcat-save').addEventListener('click', () => this.save());
    document.getElementById('logcat-autoscroll').addEventListener('change', (e) => {
      this.autoScroll = e.target.checked;
    });
    document.getElementById('crash-test').addEventListener('click', () => window.api.crashTest());
    document.getElementById('crash-open-folder').addEventListener('click', () => window.api.crashOpenFolder());
    document.getElementById('crash-clear-history').addEventListener('click', () => this.clearCrashHistory());
    document.getElementById('crash-detail-close').addEventListener('click', () => {
      document.getElementById('crash-detail-overlay').style.display = 'none';
    });

    window.api.onLogcatLine((line) => this.addLine(line));
    window.api.onCrashDetected((crash) => this.onCrashDetected(crash));
    window.api.onCrashSummaryUpdated((data) => this.onCrashSummaryUpdated(data));
  },

  _typeLabel(type) {
    const map = {
      CRASH: 'Java 크래시',
      ANR: 'ANR (응답없음)',
      NATIVE_CRASH: '네이티브 크래시',
      UNEXPECTED_EXIT: '비정상 종료',
    };
    return map[type] || type;
  },

  _typeBadge(type) {
    const map = {
      CRASH: 'JAVA CRASH',
      ANR: 'ANR',
      NATIVE_CRASH: 'NATIVE CRASH',
      UNEXPECTED_EXIT: 'UNEXPECTED EXIT',
    };
    return map[type] || type;
  },

  _shortPkg(app) {
    return (app || '').replace('com.overdare.overdare', 'overdare');
  },

  onCrashDetected(crash) {
    this.crashCount++;
    this._updateBadges();

    const device = crash.device || crash.serial || '';
    const shortPkg = this._shortPkg(crash.app);
    App.toast(`[${device}] ${this._typeLabel(crash.type)}: ${shortPkg}`, 'error');

    const list = document.getElementById('crash-list');
    const empty = list.querySelector('.crash-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'crash-item';
    item.dataset.crashTime = crash.time;
    item.innerHTML = `
      <div class="crash-item-header">
        <span class="crash-item-type crash-type-${crash.type.toLowerCase()}">${this._typeBadge(crash.type)}</span>
        <span class="crash-item-app">${shortPkg}</span>
        <span class="crash-item-time">${crash.timeLocal}</span>
      </div>
      <div class="crash-item-device">${device}</div>
      <div class="crash-item-desc">${this._typeLabel(crash.type)}</div>
      <div class="crash-item-summary" id="crash-summary-${crash.time}">
        <span class="crash-summary-loading">AI 요약 생성 중...</span>
      </div>
    `;
    item.addEventListener('click', () => this.showCrashDetail(crash));
    list.prepend(item);
  },

  onCrashSummaryUpdated(data) {
    const el = document.getElementById(`crash-summary-${data.time}`);
    if (el) {
      el.innerHTML = `<span class="crash-summary-text">${data.summary}</span>`;
    }
  },

  async showCrashDetail(crash) {
    const overlay = document.getElementById('crash-detail-overlay');
    const title = document.getElementById('crash-detail-title');
    const log = document.getElementById('crash-detail-log');

    const device = crash.device || crash.serial || '';
    title.textContent = `[${device}] ${this._typeLabel(crash.type)} — ${crash.app} (${crash.timeLocal})`;

    if (crash.file) {
      const result = await window.api.crashReadLog(crash.file);
      log.textContent = result.success ? result.text : `로그 읽기 실패: ${result.error}`;
    } else {
      log.textContent = crash.preview || 'No data';
    }
    overlay.style.display = 'flex';
  },

  async clearCrashHistory() {
    await window.api.crashClearHistory();
    this.crashCount = 0;
    this._updateBadges();
    document.getElementById('crash-list').innerHTML = '<div class="crash-empty">크래시가 감지되면 여기에 표시됩니다.</div>';
    App.toast('크래시 기록 초기화', 'info');
  },

  _updateBadges() {
    const navBadge = document.getElementById('nav-crash-badge');
    const panelBadge = document.getElementById('crash-badge');
    if (this.crashCount > 0) {
      navBadge.textContent = this.crashCount;
      navBadge.style.display = '';
      panelBadge.textContent = this.crashCount;
      panelBadge.style.display = '';
    } else {
      navBadge.style.display = 'none';
      panelBadge.style.display = 'none';
    }
  },

  async toggle() {
    const btn = document.getElementById('logcat-toggle');
    if (this.running) {
      await window.api.stopLogcat();
      this.running = false;
      btn.textContent = '시작';
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
    } else {
      if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
      this.running = true;
      btn.textContent = '중지';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');
      await window.api.startLogcat(App.currentDevice);
    }
  },

  addLine(raw) {
    const levelFilter = document.getElementById('logcat-level').value;
    const textFilter = document.getElementById('logcat-filter').value.toLowerCase();

    this.lines.push(raw);
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }

    const level = this.parseLevel(raw);
    if (levelFilter && level !== levelFilter && this.levelRank(level) < this.levelRank(levelFilter)) return;
    if (textFilter && !raw.toLowerCase().includes(textFilter)) return;

    const output = document.getElementById('logcat-output');
    const div = document.createElement('div');
    div.className = `log-line log-${level}`;
    div.textContent = raw;
    output.appendChild(div);

    if (output.children.length > this.maxLines) {
      output.removeChild(output.firstChild);
    }

    document.getElementById('logcat-count').textContent = `${this.lines.length} lines`;

    if (this.autoScroll) {
      output.scrollTop = output.scrollHeight;
    }
  },

  parseLevel(line) {
    const match = line.match(/\s([VDIWEF])\s/);
    return match ? match[1] : 'I';
  },

  levelRank(l) {
    return { V: 0, D: 1, I: 2, W: 3, E: 4, F: 5 }[l] || 0;
  },

  async clear() {
    this.lines = [];
    document.getElementById('logcat-output').innerHTML = '';
    document.getElementById('logcat-count').textContent = '0 lines';
    if (App.currentDevice) {
      await window.api.clearLogcat(App.currentDevice);
    }
  },

  async save() {
    if (!this.lines.length) return App.toast('저장할 로그가 없습니다', 'info');
    const filePath = await window.api.saveFileDialog(`logcat_${Date.now()}.txt`);
    if (!filePath) return;
    await window.api.writeFile(filePath, this.lines.join('\n'));
    App.toast(`로그 저장 완료: ${filePath}`, 'success');
  },
};

document.addEventListener('DOMContentLoaded', () => LogcatPanel.init());

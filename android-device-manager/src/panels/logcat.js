const LogcatPanel = {
  running: false,
  lines: [],
  maxLines: 10000,
  autoScroll: true,

  init() {
    document.getElementById('logcat-toggle').addEventListener('click', () => this.toggle());
    document.getElementById('logcat-clear').addEventListener('click', () => this.clear());
    document.getElementById('logcat-save').addEventListener('click', () => this.save());
    document.getElementById('logcat-autoscroll').addEventListener('change', (e) => {
      this.autoScroll = e.target.checked;
    });

    window.api.onLogcatLine((line) => this.addLine(line));
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

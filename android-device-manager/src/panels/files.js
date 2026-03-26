const FilesPanel = {
  currentPath: '/sdcard',
  history: ['/sdcard'],

  init() {
    document.getElementById('file-up').addEventListener('click', () => this.goUp());
    document.getElementById('file-go').addEventListener('click', () => this.navigateTo(document.getElementById('file-path-input').value));
    document.getElementById('file-refresh').addEventListener('click', () => this.refresh());
    document.getElementById('file-upload').addEventListener('click', () => this.upload());
    document.getElementById('file-path-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.navigateTo(e.target.value);
    });
  },

  async navigateTo(path) {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    this.currentPath = path.replace(/\/+$/, '') || '/';
    document.getElementById('file-path-input').value = this.currentPath;
    await this.refresh();
  },

  async refresh() {
    if (!App.currentDevice) return;
    const list = document.getElementById('file-list');
    list.innerHTML = '<div style="padding:12px"><div class="loading-spinner"></div></div>';

    const files = await window.api.listFiles(App.currentDevice, this.currentPath);
    list.innerHTML = files
      .map(
        (f) => `
      <div class="file-item" data-path="${f.fullPath}" data-dir="${f.isDirectory}">
        <span class="file-icon">${f.isDirectory ? '📁' : f.isLink ? '🔗' : '📄'}</span>
        <span class="file-name">${f.name}</span>
        <span class="file-size">${f.isDirectory ? '-' : App.formatBytes(f.size)}</span>
        <span class="file-date">${f.date}</span>
        <button class="btn btn-sm" data-action="download" title="다운로드" ${f.isDirectory ? 'disabled' : ''}>↓</button>
        <button class="btn btn-sm btn-danger" data-action="delete" title="삭제">✕</button>
      </div>`
      )
      .join('');

    if (!files.length) {
      list.innerHTML = '<div style="padding:12px;color:var(--text-muted)">빈 디렉토리</div>';
    }

    list.querySelectorAll('.file-item').forEach((el) => {
      el.addEventListener('dblclick', () => {
        if (el.dataset.dir === 'true') {
          this.navigateTo(el.dataset.path);
        }
      });
    });

    list.querySelectorAll('[data-action="download"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filePath = btn.closest('.file-item').dataset.path;
        this.download(filePath);
      });
    });

    list.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const filePath = btn.closest('.file-item').dataset.path;
        this.deleteFile(filePath);
      });
    });
  },

  goUp() {
    const parts = this.currentPath.split('/').filter(Boolean);
    if (parts.length <= 1) {
      this.navigateTo('/');
    } else {
      parts.pop();
      this.navigateTo('/' + parts.join('/'));
    }
  },

  async download(remotePath) {
    if (!App.currentDevice) return;
    const result = await window.api.pullFile(App.currentDevice, remotePath);
    if (result.canceled) return;
    if (result.success) {
      App.toast(`다운로드 완료`, 'success');
    } else {
      App.toast(`다운로드 실패: ${result.output}`, 'error');
    }
  },

  async upload() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    const result = await window.api.pushFile(App.currentDevice, this.currentPath);
    if (result.canceled) return;
    if (result.success) {
      App.toast('업로드 완료', 'success');
      this.refresh();
    } else {
      App.toast(`업로드 실패: ${result.output}`, 'error');
    }
  },

  async deleteFile(remotePath) {
    if (!App.currentDevice) return;
    const result = await window.api.deleteFile(App.currentDevice, remotePath);
    if (result.success) {
      App.toast('삭제 완료', 'success');
      this.refresh();
    } else {
      App.toast(`삭제 실패: ${result.output}`, 'error');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => FilesPanel.init());

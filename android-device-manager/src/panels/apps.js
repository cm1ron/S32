const AppsPanel = {
  packages: [],
  selectedPkg: null,

  init() {
    const dropZone = document.getElementById('apk-drop-zone');
    const searchInput = document.getElementById('package-search');

    dropZone.addEventListener('click', () => this.cleanInstallFromZone());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = [...e.dataTransfer.files].filter((f) => f.name.endsWith('.apk'));
      files.forEach((f) => {
        const filePath = window.api.getFilePath(f);
        if (filePath) this.cleanInstallPath(filePath);
      });
    });

    searchInput.addEventListener('input', () => this.renderPackages());
    document.getElementById('refresh-packages').addEventListener('click', () => this.loadPackages());
  },

  async cleanInstallFromZone() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    if (this.selectedPkg) {
      App.toast(`${this.selectedPkg} 클린 설치 — APK를 선택해주세요`, 'info');
      const result = await window.api.cleanInstall(App.currentDevice, this.selectedPkg);
      if (result.canceled) return;
      if (result.success) {
        App.toast(`${this.selectedPkg} 클린 설치 완료!`, 'success');
        this.loadPackages();
      } else {
        App.toast(`클린 설치 실패: ${result.output}`, 'error');
      }
    } else {
      App.toast('APK 클린 설치 — APK를 선택해주세요', 'info');
      const result = await window.api.installApk(App.currentDevice);
      if (result.canceled) return;
      if (result.success) {
        App.toast('앱 설치 완료!', 'success');
        this.loadPackages();
      } else {
        App.toast(`설치 실패: ${result.output}`, 'error');
      }
    }
  },

  async cleanInstallPath(apkPath) {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    const fileName = apkPath.split(/[\\/]/).pop();
    if (this.selectedPkg) {
      App.toast(`${this.selectedPkg} 클린 설치 중: ${fileName}`, 'info');
      await window.api.forceStop(App.currentDevice, this.selectedPkg);
      await window.api.uninstallPackage(App.currentDevice, this.selectedPkg);
    } else {
      App.toast(`설치 중: ${fileName}`, 'info');
    }
    const result = await window.api.installApkPath(App.currentDevice, apkPath);
    if (result.success) {
      App.toast('앱 설치 완료!', 'success');
      this.loadPackages();
    } else {
      App.toast(`설치 실패: ${result.output}`, 'error');
    }
  },

  async loadPackages() {
    if (!App.currentDevice) return;
    this.packages = await window.api.listPackages(App.currentDevice);
    this.renderPackages();
  },

  renderPackages() {
    const list = document.getElementById('package-list');
    const filter = document.getElementById('package-search').value.toLowerCase();
    const filtered = this.packages.filter((p) => p.name.toLowerCase().includes(filter));

    list.innerHTML = filtered
      .map(
        (pkg) => `
      <div class="package-item ${pkg.name === this.selectedPkg ? 'selected' : ''}" data-pkg="${pkg.name}">
        <div class="package-info">
          <span class="package-name">${pkg.name}</span>
          ${pkg.version ? `<span class="package-version">${pkg.version}</span>` : ''}
        </div>
        <div class="package-actions">
          <button class="btn btn-sm" data-action="launch" title="실행">▶</button>
          <button class="btn btn-sm" data-action="stop" title="강제종료">■</button>
          <button class="btn btn-sm" data-action="clean-install" title="클린 설치 (삭제 후 재설치)">🔄</button>
          <button class="btn btn-sm btn-danger" data-action="uninstall" title="삭제">✕</button>
        </div>
      </div>`
      )
      .join('');

    list.querySelectorAll('.package-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.selectedPkg = el.dataset.pkg;
        this.renderPackages();
      });
    });

    list.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pkg = e.target.closest('.package-item').dataset.pkg;
        const action = btn.dataset.action;
        this.handleAction(action, pkg);
      });
    });
  },

  async handleAction(action, pkg) {
    if (!App.currentDevice) return;
    let result;
    switch (action) {
      case 'launch':
        result = await window.api.launchApp(App.currentDevice, pkg);
        App.toast(result.success ? `${pkg} 실행됨` : `실행 실패`, result.success ? 'success' : 'error');
        break;
      case 'stop':
        result = await window.api.forceStop(App.currentDevice, pkg);
        App.toast(result.success ? `${pkg} 종료됨` : `종료 실패`, result.success ? 'success' : 'error');
        break;
      case 'clean-install':
        App.toast(`${pkg} 클린 설치 — APK를 선택해주세요`, 'info');
        result = await window.api.cleanInstall(App.currentDevice, pkg);
        if (result.canceled) return;
        if (result.success) {
          App.toast(`${pkg} 클린 설치 완료!`, 'success');
          this.loadPackages();
        } else {
          App.toast(`클린 설치 실패: ${result.output}`, 'error');
        }
        break;
      case 'uninstall':
        result = await window.api.uninstallPackage(App.currentDevice, pkg);
        if (result.success) {
          App.toast(`${pkg} 삭제됨`, 'success');
          this.loadPackages();
        } else {
          App.toast(`삭제 실패: ${result.output}`, 'error');
        }
        break;
    }
  },
};

document.addEventListener('DOMContentLoaded', () => AppsPanel.init());

const DevicePanel = {
  async refresh() {
    const container = document.getElementById('device-info-content');
    if (!App.currentDevice) {
      container.innerHTML = '<p style="color:var(--text-muted)">디바이스를 선택하면 정보가 표시됩니다.</p>';
      return;
    }

    container.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const info = await window.api.getDeviceInfo(App.currentDevice);
      container.innerHTML = this.renderInfo(info);
    } catch (e) {
      container.innerHTML = `<p style="color:var(--red)">정보 조회 실패: ${e.message}</p>`;
    }
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
      </div>`;
  },
};

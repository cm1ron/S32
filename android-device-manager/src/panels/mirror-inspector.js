const LOG_PATHS = {
  app: '/sdcard/Android/data/com.overdare.overdare.dev/files/App',
  meta: '/sdcard/Android/data/com.overdare.overdare.dev/files/UnrealGame/Meta/Meta/Saved/Logs',
};

const MirrorInspector = {
  mirroring: false,
  mirrorTimer: null,
  capturing: false,
  nodes: [],
  selectedNode: null,
  imgNaturalWidth: 0,
  imgNaturalHeight: 0,
  inspectMode: false,
  dragState: null,
  lastLogsDir: null,
  scrcpyRunning: false,
  recording: false,
  recordTimer: null,
  recordSeconds: 0,

  init() {
    document.getElementById('scrcpy-toggle').addEventListener('click', () => this.toggleScrcpy());
    document.getElementById('record-toggle').addEventListener('click', () => this.toggleRecording());
    document.getElementById('mirror-toggle').addEventListener('click', () => this.toggleMirror());
    document.getElementById('mirror-screenshot').addEventListener('click', () => this.singleCapture());
    document.getElementById('inspector-refresh').addEventListener('click', () => this.scanUi());
    document.getElementById('inspector-copy-xpath').addEventListener('click', () => this.copyXpath());
    document.getElementById('inspector-copy-id').addEventListener('click', () => this.copyField('resourceId', 'Resource ID'));
    document.getElementById('inspector-copy-desc').addEventListener('click', () => this.copyField('contentDesc', 'Content-desc'));
    document.getElementById('inspector-copy-text').addEventListener('click', () => this.copyField('text', 'Text'));
    document.getElementById('inspector-copy-selector').addEventListener('click', () => this.copySelector());
    document.getElementById('mirror-fps').addEventListener('change', () => {
      if (this.mirroring) {
        this.stopMirrorLoop();
        this.startMirrorLoop();
      }
    });

    const canvas = document.getElementById('mi-canvas');
    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.getElementById('nav-back').addEventListener('click', () => {
      if (App.currentDevice) window.api.inputKey(App.currentDevice, 4);
    });
    document.getElementById('nav-home').addEventListener('click', () => {
      if (App.currentDevice) window.api.inputKey(App.currentDevice, 3);
    });
    document.getElementById('nav-recent').addEventListener('click', () => {
      if (App.currentDevice) window.api.inputKey(App.currentDevice, 187);
    });

    document.getElementById('pull-all-logs').addEventListener('click', () => this.pullAllBoth());
    document.getElementById('open-logs-folder').addEventListener('click', () => this.openLogsFolder());
    document.getElementById('open-screenshot-folder').addEventListener('click', () => this.openScreenshotFolder());
    document.getElementById('extracted-log-close').addEventListener('click', () => this.closeLogViewer());
    document.getElementById('memo-clear').addEventListener('click', () => {
      document.getElementById('inspector-memo').value = '';
    });

    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    window.api.onScrcpyExited(() => {
      if (this.scrcpyRunning) {
        this.scrcpyRunning = false;
        const btn = document.getElementById('scrcpy-toggle');
        btn.textContent = 'scrcpy (고성능)';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
        App.toast('scrcpy 창이 종료됨', 'info');
      }
    });

    window.api.onRecordingFinished(() => {
      if (this.recording) {
        this.stopRecordTimer();
        this.recording = false;
        const btn = document.getElementById('record-toggle');
        btn.classList.remove('recording');
        App.toast('녹화 시간 초과 (3분) — 파일 저장 중...', 'info');
        this.pullRecording();
      }
    });
  },

  // --- 녹화 ---

  async toggleRecording() {
    const btn = document.getElementById('record-toggle');
    if (this.recording) {
      btn.disabled = true;
      App.toast('녹화 중지 — 파일 저장 중...', 'info');
      this.stopRecordTimer();
      const result = await window.api.stopRecording(App.currentDevice);
      this.recording = false;
      btn.classList.remove('recording');
      btn.disabled = false;
      if (result.success) {
        const fileName = result.filePath.split(/[\\/]/).pop();
        App.toast(`녹화 저장 완료: ${fileName}`, 'success');
      } else {
        App.toast(`녹화 저장 실패: ${result.error}`, 'error');
      }
    } else {
      if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
      const result = await window.api.startRecording(App.currentDevice);
      if (result.success) {
        this.recording = true;
        btn.classList.add('recording');
        this.startRecordTimer();
        App.toast('녹화 시작 (최대 3분)', 'success');
      } else {
        App.toast(`녹화 실패: ${result.error}`, 'error');
      }
    }
  },

  async pullRecording() {
    const result = await window.api.stopRecording(App.currentDevice);
    if (result.success) {
      const fileName = result.filePath.split(/[\\/]/).pop();
      App.toast(`녹화 저장 완료: ${fileName}`, 'success');
    } else {
      App.toast(`녹화 저장 실패: ${result.error}`, 'error');
    }
  },

  startRecordTimer() {
    this.recordSeconds = 0;
    const btn = document.getElementById('record-toggle');
    this.recordTimer = setInterval(() => {
      this.recordSeconds++;
      const m = Math.floor(this.recordSeconds / 60);
      const s = this.recordSeconds % 60;
      btn.title = `녹화 중 ${m}:${s.toString().padStart(2, '0')} / 3:00`;
    }, 1000);
  },

  stopRecordTimer() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    this.recordSeconds = 0;
    document.getElementById('record-toggle').title = '화면 녹화';
  },

  // --- scrcpy (고성능 별도 창) ---

  async toggleScrcpy() {
    const btn = document.getElementById('scrcpy-toggle');
    if (this.scrcpyRunning) {
      await window.api.stopScrcpy();
      this.scrcpyRunning = false;
      btn.textContent = 'scrcpy (고성능)';
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
      App.toast('scrcpy 종료', 'info');
    } else {
      if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
      if (this.mirroring) this.stopMirror();
      const result = await window.api.startScrcpy(App.currentDevice, {
        windowTitle: 'Android Mirror',
        stayAwake: true,
      });
      if (result.success) {
        this.scrcpyRunning = true;
        btn.textContent = 'scrcpy 중지';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');
        App.toast('scrcpy 시작 — 별도 창에서 고성능 미러링 중', 'success');
      } else {
        App.toast(`scrcpy 실패: ${result.error}`, 'error');
      }
    }
  },

  async stopScrcpyIfRunning() {
    if (this.scrcpyRunning) {
      await window.api.stopScrcpy();
      this.scrcpyRunning = false;
      const btn = document.getElementById('scrcpy-toggle');
      btn.textContent = 'scrcpy (고성능)';
      btn.classList.remove('btn-danger');
      btn.classList.add('btn-primary');
    }
  },

  // --- 내장 미러링 (screencap) ---

  toggleMirror() {
    if (this.mirroring) {
      this.stopMirror();
    } else {
      this.startMirror();
    }
  },

  async startMirror() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    await this.stopScrcpyIfRunning();
    this.mirroring = true;
    this.inspectMode = false;
    this.nodes = [];
    this.selectedNode = null;
    document.getElementById('inspector-tree').innerHTML = '<p style="padding:12px;color:var(--text-muted)">터치 모드 — UI 스캔으로 인스펙트 모드 전환</p>';
    document.getElementById('inspector-props').innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px">요소를 선택하면 속성이 표시됩니다.</p>';
    document.getElementById('mi-canvas').style.cursor = 'pointer';
    const canvas = document.getElementById('mi-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const btn = document.getElementById('mirror-toggle');
    btn.textContent = '미러링 중지';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    document.getElementById('mirror-status').textContent = '미러링 중';
    document.getElementById('mi-placeholder').style.display = 'none';
    this.startMirrorLoop();
  },

  stopMirror() {
    this.mirroring = false;
    this.stopMirrorLoop();
    const btn = document.getElementById('mirror-toggle');
    btn.textContent = '미러링 시작';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    document.getElementById('mirror-status').textContent = '중지됨';
  },

  startMirrorLoop() {
    const interval = parseInt(document.getElementById('mirror-fps').value) || 200;
    this.captureFrame();
    this.mirrorTimer = setInterval(() => this.captureFrame(), interval);
  },

  stopMirrorLoop() {
    if (this.mirrorTimer) {
      clearInterval(this.mirrorTimer);
      this.mirrorTimer = null;
    }
  },

  async captureFrame() {
    if (this.capturing || !App.currentDevice) return;
    this.capturing = true;
    try {
      const result = await window.api.screencap(App.currentDevice);
      if (result.success && this.mirroring) {
        this.showImage(result.data);
      } else if (!result.success && this.mirroring) {
        console.warn('screencap failed:', result.error);
      }
    } catch (e) { console.warn('captureFrame error:', e); }
    this.capturing = false;
  },

  async singleCapture() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    document.getElementById('mi-placeholder').style.display = 'none';
    const result = await window.api.screencap(App.currentDevice);
    if (result.success) {
      this.showImage(result.data);
      const saved = await window.api.saveScreenshot(result.data);
      if (saved.success) {
        App.toast(`스크린샷 저장: ${saved.filePath.split(/[\\/]/).pop()}`, 'success');
      }
    } else {
      App.toast('스크린샷 실패', 'error');
    }
  },

  showImage(base64) {
    const img = document.getElementById('mi-img');
    img.src = `data:image/png;base64,${base64}`;
    img.classList.add('visible');
    img.onload = () => {
      this.imgNaturalWidth = img.naturalWidth;
      this.imgNaturalHeight = img.naturalHeight;
      this.syncCanvas();
      if (this.selectedNode) this.drawOverlays();
    };
  },

  getImageDisplayRect() {
    const img = document.getElementById('mi-img');
    const imgRect = img.getBoundingClientRect();
    if (!img.naturalWidth || !img.naturalHeight) return imgRect;

    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = imgRect.width / imgRect.height;
    let dw, dh, ox, oy;

    if (imgAspect > containerAspect) {
      dw = imgRect.width;
      dh = imgRect.width / imgAspect;
      ox = 0;
      oy = (imgRect.height - dh) / 2;
    } else {
      dh = imgRect.height;
      dw = imgRect.height * imgAspect;
      ox = (imgRect.width - dw) / 2;
      oy = 0;
    }

    return {
      left: imgRect.left + ox,
      top: imgRect.top + oy,
      width: dw,
      height: dh,
    };
  },

  syncCanvas() {
    const canvas = document.getElementById('mi-canvas');
    const wrap = document.getElementById('mi-screen');
    if (!this.imgNaturalWidth) return;

    const display = this.getImageDisplayRect();
    const wrapRect = wrap.getBoundingClientRect();

    canvas.width = Math.round(display.width);
    canvas.height = Math.round(display.height);
    canvas.style.width = display.width + 'px';
    canvas.style.height = display.height + 'px';
    canvas.style.left = Math.round(display.left - wrapRect.left) + 'px';
    canvas.style.top = Math.round(display.top - wrapRect.top) + 'px';
  },

  // --- UI Inspector ---

  async scanUi() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');

    if (this.mirroring) this.stopMirror();

    const treeEl = document.getElementById('inspector-tree');
    treeEl.innerHTML = '<div style="padding:12px"><div class="loading-spinner"></div> UI 분석 중...</div>';

    const result = await window.api.dumpUi(App.currentDevice);

    if (!result.success) {
      treeEl.innerHTML = '<p style="padding:12px;color:var(--red)">UI 덤프 실패</p>';
      App.toast(`UI 덤프 실패: ${result.error}`, 'error');
      return;
    }

    if (result.screenshot) {
      this.showImage(result.screenshot);
    }

    this.nodes = this.parseXml(result.xml);
    this.selectedNode = null;
    this.inspectMode = true;
    this.renderTree();
    this.drawOverlays();
    document.getElementById('mi-canvas').style.cursor = 'crosshair';
    App.toast(`UI 스캔 완료 (${this.nodes.length}개 요소) — 인스펙트 모드`, 'success');
  },

  parseXml(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, 'text/xml');
    const nodes = [];

    function walk(el, depth, parentIndex) {
      const bounds = el.getAttribute('bounds');
      let rect = null;
      if (bounds) {
        const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (m) rect = { x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] };
      }
      const node = {
        index: nodes.length,
        depth,
        parentIndex,
        class: el.getAttribute('class') || el.tagName,
        resourceId: el.getAttribute('resource-id') || '',
        text: el.getAttribute('text') || '',
        contentDesc: el.getAttribute('content-desc') || '',
        bounds: bounds || '',
        rect,
        clickable: el.getAttribute('clickable') || 'false',
        enabled: el.getAttribute('enabled') || 'true',
        focused: el.getAttribute('focused') || 'false',
        selected: el.getAttribute('selected') || 'false',
        scrollable: el.getAttribute('scrollable') || 'false',
        package: el.getAttribute('package') || '',
        childCount: el.children.length,
        expanded: depth < 2,
      };
      const idx = nodes.length;
      nodes.push(node);
      for (const child of el.children) walk(child, depth + 1, idx);
    }

    const root = doc.querySelector('hierarchy') || doc.documentElement;
    for (const child of root.children) walk(child, 0, -1);
    return nodes;
  },

  renderTree() {
    const container = document.getElementById('inspector-tree');
    container.innerHTML = '';
    if (!this.nodes.length) {
      container.innerHTML = '<p style="padding:12px;color:var(--text-muted)">UI 스캔을 눌러 요소를 불러오세요</p>';
      return;
    }

    const visible = this.getVisibleNodes();
    const frag = document.createDocumentFragment();

    for (const node of visible) {
      const div = document.createElement('div');
      div.className = `tree-node${node === this.selectedNode ? ' selected' : ''}`;
      div.style.paddingLeft = (node.depth * 14 + 6) + 'px';

      const cls = node.class;
      const tog = node.childCount > 0 ? (node.expanded ? '▾' : '▸') : ' ';
      const desc = node.contentDesc ? ` <span class="tree-node-desc">content-desc="${this.esc(node.contentDesc.substring(0, 30))}"</span>` : '';
      const rid = node.resourceId ? ` <span class="tree-node-id">resource-id="${this.esc(node.resourceId)}"</span>` : '';

      div.innerHTML = `<span class="tree-toggle">${tog}</span><span class="tree-node-label">&lt;${this.esc(cls)}&gt;</span>${desc}${rid}`;

      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('tree-toggle') && node.childCount > 0) {
          node.expanded = !node.expanded;
          this.renderTree();
        } else {
          this.selectNode(node);
        }
      });
      frag.appendChild(div);
    }
    container.appendChild(frag);
  },

  getVisibleNodes() {
    const visible = [];
    const collapsed = new Set();
    for (const node of this.nodes) {
      if (collapsed.has(node.parentIndex)) { collapsed.add(node.index); continue; }
      visible.push(node);
      if (!node.expanded && node.childCount > 0) collapsed.add(node.index);
    }
    return visible;
  },

  selectNode(node) {
    this.selectedNode = node;
    this.renderTree();
    this.renderProps(node);
    this.drawOverlays();
  },

  renderProps(node) {
    const el = document.getElementById('inspector-props');
    const props = [
      ['class', node.class],
      ['resource-id', node.resourceId],
      ['text', node.text],
      ['content-desc', node.contentDesc],
      ['bounds', node.bounds],
      ['clickable', node.clickable],
      ['enabled', node.enabled],
      ['focused', node.focused],
      ['selected', node.selected],
      ['scrollable', node.scrollable],
      ['package', node.package],
    ];
    const highlight = (k, v) => {
      if (!v || v === '-') return '';
      if (['resource-id', 'content-desc', 'text'].includes(k) && v) return ' style="color:#a6e3a1;font-weight:600"';
      return '';
    };
    el.innerHTML = props.map(([k, v]) =>
      `<div class="prop-row">
        <span class="prop-key">${k}</span>
        <span class="prop-value"${highlight(k, v)} title="클릭하여 복사" data-value="${this.escAttr(v)}">${this.esc(v || '-')}</span>
      </div>`
    ).join('');

    el.querySelectorAll('.prop-value').forEach((pv) => {
      pv.addEventListener('click', () => {
        navigator.clipboard.writeText(pv.dataset.value);
        App.toast('복사됨', 'info');
      });
    });
  },

  // --- Canvas Overlay ---

  drawOverlays() {
    const canvas = document.getElementById('mi-canvas');
    const ctx = canvas.getContext('2d');
    if (!this.imgNaturalWidth) return;

    this.syncCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!this.selectedNode || !this.selectedNode.rect) return;

    const scaleX = canvas.width / this.imgNaturalWidth;
    const scaleY = canvas.height / this.imgNaturalHeight;
    const r = this.selectedNode.rect;
    const x = r.x1 * scaleX;
    const y = r.y1 * scaleY;
    const w = (r.x2 - r.x1) * scaleX;
    const h = (r.y2 - r.y1) * scaleY;

    ctx.fillStyle = 'rgba(137, 180, 250, 0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = 'rgba(30, 30, 46, 0.85)';
    ctx.font = '11px sans-serif';
    const label = this.selectedNode.class.split('.').pop();
    const tm = ctx.measureText(label);
    const lx = Math.min(x, canvas.width - tm.width - 8);
    const ly = Math.max(y - 4, 14);
    ctx.fillRect(lx - 2, ly - 12, tm.width + 6, 15);
    ctx.fillStyle = '#89b4fa';
    ctx.fillText(label, lx, ly);
  },

  canvasToDevice(e) {
    const display = this.getImageDisplayRect();
    const x = (e.clientX - display.left) / display.width * this.imgNaturalWidth;
    const y = (e.clientY - display.top) / display.height * this.imgNaturalHeight;
    return {
      x: Math.round(Math.max(0, Math.min(x, this.imgNaturalWidth))),
      y: Math.round(Math.max(0, Math.min(y, this.imgNaturalHeight))),
    };
  },

  showTapFeedback(e) {
    const canvas = document.getElementById('mi-canvas');
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');

    let radius = 18;
    let alpha = 0.5;
    const animate = () => {
      if (alpha <= 0) return;
      if (!this.inspectMode) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(137, 180, 250, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(137, 180, 250, ${alpha + 0.2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      radius += 3;
      alpha -= 0.1;
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  },

  onMouseDown(e) {
    if (!this.imgNaturalWidth) return;
    const pos = this.canvasToDevice(e);
    this.dragState = { startX: pos.x, startY: pos.y, startTime: Date.now(), moved: false };
  },

  onMouseMove(e) {
    if (!this.dragState) return;
    const pos = this.canvasToDevice(e);
    const dx = pos.x - this.dragState.startX;
    const dy = pos.y - this.dragState.startY;
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) this.dragState.moved = true;
  },

  onMouseUp(e) {
    if (!this.dragState || !App.currentDevice) { this.dragState = null; return; }
    const pos = this.canvasToDevice(e);
    const { startX, startY, startTime, moved } = this.dragState;
    this.dragState = null;

    if (this.inspectMode && this.nodes.length) {
      this.inspectClick(moved ? pos.x : startX, moved ? pos.y : startY);
      return;
    }

    if (moved) {
      const dur = Math.max(100, Math.min(Date.now() - startTime, 2000));
      window.api.inputSwipe(App.currentDevice, startX, startY, pos.x, pos.y, dur);
    } else {
      this.showTapFeedback(e);
      window.api.inputTap(App.currentDevice, Math.round(startX), Math.round(startY));
    }
  },

  inspectClick(x, y) {
    let best = null;
    let bestArea = Infinity;
    for (const node of this.nodes) {
      if (!node.rect) continue;
      const r = node.rect;
      if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) {
        const area = (r.x2 - r.x1) * (r.y2 - r.y1);
        if (area < bestArea) { bestArea = area; best = node; }
      }
    }
    if (best) {
      let p = best;
      while (p && p.parentIndex >= 0) {
        const parent = this.nodes[p.parentIndex];
        if (parent) parent.expanded = true;
        p = parent;
      }
      this.selectNode(best);
    }
  },

  onKeyDown(e) {
    if (App.currentPanel !== 'mirror' || !App.currentDevice) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    const keyMap = { Backspace: 4, Home: 3, Escape: 4, Enter: 66 };
    if (keyMap[e.key]) {
      e.preventDefault();
      window.api.inputKey(App.currentDevice, keyMap[e.key]);
    }
  },

  // --- Copy ---

  buildXpath(node) {
    const parts = [];
    let n = node;
    while (n) {
      const cls = n.class.split('.').pop();
      let part = cls;

      if (n.resourceId) {
        part = `${cls}[@resource-id="${n.resourceId}"]`;
      } else if (n.contentDesc) {
        part = `${cls}[@content-desc="${n.contentDesc}"]`;
      } else if (n.text) {
        part = `${cls}[@text="${n.text.substring(0, 50)}"]`;
      } else {
        const siblings = this.nodes.filter(
          (s) => s.parentIndex === n.parentIndex && s.class === n.class
        );
        if (siblings.length > 1) {
          const idx = siblings.indexOf(n) + 1;
          part = `${cls}[${idx}]`;
        }
      }

      parts.unshift(part);
      n = n.parentIndex >= 0 ? this.nodes[n.parentIndex] : null;
    }
    return '//' + parts.join('/');
  },

  copyXpath() {
    if (!this.selectedNode) return App.toast('요소를 먼저 선택해주세요', 'info');
    const xpath = this.buildXpath(this.selectedNode);
    navigator.clipboard.writeText(xpath);
    App.toast('XPath 복사됨', 'success');
  },

  copyField(field, label) {
    if (!this.selectedNode) return App.toast('요소를 먼저 선택해주세요', 'info');
    const val = this.selectedNode[field];
    if (val) {
      navigator.clipboard.writeText(val);
      App.toast(`${label} 복사됨`, 'success');
    } else {
      App.toast(`${label} 없음`, 'info');
    }
  },

  copySelector() {
    if (!this.selectedNode) return App.toast('요소를 먼저 선택해주세요', 'info');
    const n = this.selectedNode;
    let strategy, value, display;

    if (n.resourceId) {
      strategy = 'id';
      value = n.resourceId;
      display = `[id] ${value}`;
    } else if (n.contentDesc) {
      strategy = 'accessibility id';
      value = n.contentDesc;
      display = `[desc] ${value}`;
    } else if (n.text) {
      strategy = 'text';
      value = n.text;
      display = `[text] ${value}`;
    } else {
      strategy = 'xpath';
      value = this.buildXpath(n);
      display = `[xpath] ${value}`;
    }

    const result = `${strategy}=${value}`;
    navigator.clipboard.writeText(result);
    App.toast(`셀렉터 복사: ${display}`, 'success');
  },

  // --- Log Extract ---

  async pullAllBoth() {
    if (!App.currentDevice) return App.toast('디바이스를 먼저 연결해주세요', 'error');
    App.toast('앱 + 메타 로그 추출 중...', 'info');

    const result = await window.api.pullAllLogs(App.currentDevice, [LOG_PATHS.app, LOG_PATHS.meta]);
    if (!result.success) {
      App.toast(`로그 추출 실패: ${result.error}`, 'error');
      return;
    }

    this.lastLogsDir = result.logsDir;
    App.toast(`로그 ${result.count}개 파일 추출 완료`, 'success');
    await window.api.openFolder(result.logsDir);
  },

  showLogViewer(result) {
    const viewer = document.getElementById('extracted-log-viewer');
    const info = document.getElementById('extracted-log-info');
    const content = document.getElementById('extracted-log-content');
    info.textContent = `${result.fileName}  |  ${result.fileDate}`;
    content.textContent = result.content;
    viewer.style.display = 'flex';
  },

  closeLogViewer() {
    document.getElementById('extracted-log-viewer').style.display = 'none';
  },

  async openLogsFolder() {
    if (this.lastLogsDir) {
      await window.api.openFolder(this.lastLogsDir);
    } else {
      App.toast('먼저 로그를 추출해주세요', 'info');
    }
  },

  async openScreenshotFolder() {
    await window.api.openScreenshotFolder();
  },

  // --- Util ---

  esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
  escAttr(s) {
    return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  },
};

document.addEventListener('DOMContentLoaded', () => MirrorInspector.init());

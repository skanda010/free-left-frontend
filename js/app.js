(() => {
  const $ = (selector) => document.querySelector(selector);
  const logBody = $('#eventLog');
  const toast = $('#toast');
  const fileUrl = { video: null };
  const state = {
    mode: 'Free-left',
    control: 'auto',
    count: 8,
    duration: 18,
    threshold: 30,
    historyRisk: 'low',
    events: []
  };

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function addEvent(type, detail, level = 'info') {
    state.events.unshift({ type, detail, time: now(), level });
    state.events = state.events.slice(0, 8);
    renderEvents();
  }

  function renderEvents() {
    $('#emptyEvents').hidden = state.events.length > 0;
    logBody.innerHTML = state.events.map((event) => `
      <tr><td><span class="event-mark ${event.level}"></span>${escapeHtml(event.type)}</td>
      <td>${escapeHtml(event.detail)}</td><td>${event.time}</td>
      <td><span class="level-tag ${event.level}">${event.level === 'warn' ? 'Attention' : event.level === 'info' ? 'Info' : 'Normal'}</span></td></tr>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function updateSignal(reason = '') {
    const protectedMode = state.mode === 'Protected-left';
    $('#signalMode').textContent = protectedMode ? 'Protected-left' : 'Free-left';
    $('#signalDisplayMode').textContent = protectedMode ? 'Protected-left' : 'Free-left';
    $('#signalDisplayHint').textContent = protectedMode ? 'Movement held for safety' : 'Movement permitted';
    $('#signalReason').textContent = reason || (state.control === 'auto' ? 'Adaptive control is active' : 'Manual signal control');
    const light = $('#trafficLight');
    light.querySelectorAll('.lamp').forEach((lamp) => lamp.classList.remove('active'));
    light.querySelector(protectedMode ? '.red-lamp' : '.green-lamp').classList.add('active');
    light.setAttribute('aria-label', `${state.mode} signal is ${protectedMode ? 'red' : 'green'}`);
    $('#overrideBtn').textContent = protectedMode ? 'Switch to free-left' : 'Switch to protected-left';
    $('#overrideBtn').disabled = state.control !== 'manual';
    $('#overrideNote').textContent = state.control === 'manual' ? 'Manual override is active. Confirm the lane is clear before switching.' : 'Switch to Manual to control the signal.';
  }

  function setControl(mode) {
    state.control = mode;
    const automatic = mode === 'auto';
    $('#autoModeBtn').classList.toggle('active', automatic);
    $('#manualModeBtn').classList.toggle('active', !automatic);
    $('#autoModeBtn').setAttribute('aria-pressed', String(automatic));
    $('#manualModeBtn').setAttribute('aria-pressed', String(!automatic));
    $('#controlModeHint').textContent = automatic ? 'Automatic decisions enabled' : 'Manual signal control enabled';
    updateSignal();
    addEvent('Control mode changed', automatic ? 'Automatic mode enabled' : 'Manual override enabled', 'info');
  }

  function updateRisk() {
    const risk = state.duration >= state.threshold ? 'high' : state.duration >= state.threshold * 0.7 ? 'medium' : state.historyRisk === 'high' ? 'high' : state.historyRisk;
    const pill = $('#riskLevel');
    pill.className = `risk-pill ${risk}`;
    pill.textContent = risk.toUpperCase();
    $('#blockDuration').textContent = `00:${String(state.duration).padStart(2, '0')}`;
  }

  const chartValues = [5, 8, 7, 11, 9, 14, 12, 10, 16, 12, 9, 8];
  function drawChart() {
    const canvas = $('#trafficChart');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    const width = rect.width;
    const height = rect.height;
    const bottom = height - 18;
    const top = 6;
    const max = $('#chartRange').value === 'day' ? 30 : 20;
    const values = $('#chartRange').value === 'day' ? [12, 15, 11, 18, 21, 25, 22, 17, 20, 16, 11, 8] : chartValues;
    const left = 5;
    const right = width - 4;
    ctx.font = '8px DM Sans, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 1;
    for (let n = 0; n <= 4; n += 1) {
      const y = top + ((bottom - top) * n / 4);
      ctx.strokeStyle = '#2a3942';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    }
    const gap = 7;
    const barWidth = Math.max(5, (right - left - gap * (values.length - 1)) / values.length);
    values.forEach((value, index) => {
      const x = left + index * (barWidth + gap);
      const barHeight = (value / max) * (bottom - top);
      const y = bottom - barHeight;
      ctx.fillStyle = index === values.indexOf(Math.max(...values)) ? '#54d7b7' : '#318d80';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
      else ctx.rect(x, y, barWidth, barHeight);
      ctx.fill();
      ctx.fillStyle = '#738690';
      ctx.fillText($('#chartRange').value === 'day' ? `${index * 2}h` : `${String(9 + index).padStart(2, '0')}:00`, x + barWidth / 2, height - 3);
    });
    $('#chartSummary').textContent = `Peak interval: ${Math.max(...values)} vehicles`;
  }

  function showVideo(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      notify('Choose a video file to preview.');
      return;
    }
    if (fileUrl.video) URL.revokeObjectURL(fileUrl.video);
    fileUrl.video = URL.createObjectURL(file);
    const video = $('#videoPreview');
    video.src = fileUrl.video;
    video.hidden = false;
    $('#feedPlaceholder').hidden = true;
    $('#sourceStatus').textContent = 'LOCAL VIDEO';
    $('#videoFileName').textContent = file.name;
    $('#feedClock').textContent = 'LOCAL PREVIEW';
    addEvent('Video selected', `${file.name} · preview only`, 'info');
    notify('Video preview loaded. Detection needs the vision backend.');
  }

  function showReport(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      notify('Choose a PDF traffic report.');
      return;
    }
    $('#reportName').textContent = file.name;
    $('#reportSummary').textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · awaiting backend analysis`;
    addEvent('Traffic report uploaded', `${file.name} · not parsed in frontend`, 'info');
    notify('Report selected. PDF parsing needs the analytics backend.');
  }

  $('#autoModeBtn').addEventListener('click', () => setControl('auto'));
  $('#manualModeBtn').addEventListener('click', () => setControl('manual'));
  $('#overrideBtn').addEventListener('click', () => {
    if (state.control !== 'manual') return;
    state.mode = state.mode === 'Free-left' ? 'Protected-left' : 'Free-left';
    updateSignal('Changed by manual override');
    addEvent('Signal mode changed', `Manual override set ${state.mode}`, 'warn');
  });
  $('#thresholdRange').addEventListener('input', (event) => {
    state.threshold = Number(event.target.value);
    $('#thresholdValue').textContent = state.threshold;
    $('#thresholdLabel').textContent = state.threshold;
    updateRisk();
  });
  $('#videoUpload').addEventListener('change', (event) => showVideo(event.target.files[0]));
  $('#reportUpload').addEventListener('change', (event) => showReport(event.target.files[0]));
  $('#chartRange').addEventListener('change', drawChart);
  $('#refreshBtn').addEventListener('click', () => {
    drawChart();
    updateRisk();
    notify('Dashboard refreshed. Demo values are unchanged.');
  });
  $('#modeInfoBtn').addEventListener('click', () => $('#infoDialog').showModal());
  $('#viewAllEvents').addEventListener('click', () => notify('Showing the latest 8 events. Full history will be available from the backend.'));
  $('#exportBtn').addEventListener('click', () => {
    const rows = [
      ['Traffic dashboard report', new Date().toLocaleString()],
      ['Data source', 'Demo values; not live controller data'],
      ['Signal mode', state.mode],
      ['Control mode', state.control],
      ['Vehicles in free-left lane', state.count],
      ['Longest blocking time (seconds)', state.duration],
      ['Blocking threshold (seconds)', state.threshold],
      ['Risk level', $('#riskLevel').textContent],
      [],
      ['Event', 'Details', 'Time']
    ];
    state.events.forEach((event) => rows.push([event.type, event.detail, event.time]));
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `flowpilot-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Demo traffic report exported as CSV.');
  });
  $('#infoDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  window.addEventListener('resize', drawChart);
  window.addEventListener('beforeunload', () => { if (fileUrl.video) URL.revokeObjectURL(fileUrl.video); });

  const initialEvents = [
    ['Adaptive controller active', 'Free-left permitted · risk low', 'Normal', 'ok'],
    ['Vehicle flow updated', '8 vehicles in free-left lane', 'Normal', 'ok'],
    ['Camera source unavailable', 'Using sample intersection view', 'Info', 'info'],
    ['Historical report pending', 'Upload a traffic PDF for analysis', 'Info', 'info']
  ];
  state.events = initialEvents.map(([type, detail, , level]) => ({ type, detail, time: now(), level }));
  renderEvents();
  updateSignal();
  updateRisk();
  requestAnimationFrame(drawChart);
})();

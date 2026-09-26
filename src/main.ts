import confetti from 'canvas-confetti';
import { ALL_PRESETS, PRESET_MAP } from './engine/presets';
import { AnimationEngine, BackgroundMode } from './engine/AnimationEngine';
import { ExportConfig, RESOLUTIONS, ResolutionPreset, TransitionAnalysis } from './types';
import { VideoExportPipeline } from './encoder/VideoExportPipeline';

// DOM 要素の取得
const previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
const coverageCanvas = document.getElementById('coverageCanvas') as HTMLCanvasElement;
const scrubberTrack = document.getElementById('scrubberTrack') as HTMLDivElement;
const scrubberProgress = document.getElementById('scrubberProgress') as HTMLDivElement;
const cutpointMarker = document.getElementById('cutpointMarker') as HTMLDivElement;

const btnToStart = document.getElementById('btnToStart') as HTMLButtonElement;
const btnStepPrev = document.getElementById('btnStepPrev') as HTMLButtonElement;
const btnTogglePlay = document.getElementById('btnTogglePlay') as HTMLButtonElement;
const btnStepNext = document.getElementById('btnStepNext') as HTMLButtonElement;
const btnToEnd = document.getElementById('btnToEnd') as HTMLButtonElement;
const iconPlay = document.getElementById('iconPlay') as HTMLElement;
const iconPause = document.getElementById('iconPause') as HTMLElement;

const lblCurrentTime = document.getElementById('lblCurrentTime') as HTMLElement;
const lblTotalTime = document.getElementById('lblTotalTime') as HTMLElement;
const lblFrameBadge = document.getElementById('lblFrameBadge') as HTMLElement;
const lblCutBadge = document.getElementById('lblCutBadge') as HTMLElement;
const canvasResBadge = document.getElementById('canvasResBadge') as HTMLElement;

const presetList = document.getElementById('presetList') as HTMLDivElement;
const presetDescription = document.getElementById('presetDescription') as HTMLDivElement;

const primaryColorInput = document.getElementById('primaryColorInput') as HTMLInputElement;
const secondaryColorInput = document.getElementById('secondaryColorInput') as HTMLInputElement;
const accentColorInput = document.getElementById('accentColorInput') as HTMLInputElement;
const borderColorInput = document.getElementById('borderColorInput') as HTMLInputElement;
const inputBorderWidth = document.getElementById('inputBorderWidth') as HTMLInputElement;
const valBorderWidth = document.getElementById('valBorderWidth') as HTMLElement;
const inputHasGlow = document.getElementById('inputHasGlow') as HTMLInputElement;

const hexSpecificControls = document.getElementById('hexSpecificControls') as HTMLElement;
const inputHexStagger = document.getElementById('inputHexStagger') as HTMLInputElement;
const valHexStagger = document.getElementById('valHexStagger') as HTMLElement;
const inputHexRotation = document.getElementById('inputHexRotation') as HTMLInputElement;

const lineWipeSpecificControls = document.getElementById('lineWipeSpecificControls') as HTMLElement;
const inputLineWidth = document.getElementById('inputLineWidth') as HTMLInputElement;
const valLineWidth = document.getElementById('valLineWidth') as HTMLElement;
const inputLineAngle = document.getElementById('inputLineAngle') as HTMLInputElement;
const valLineAngle = document.getElementById('valLineAngle') as HTMLElement;
const inputLineSpeedLines = document.getElementById('inputLineSpeedLines') as HTMLInputElement;

const selectFormat = document.getElementById('selectFormat') as HTMLSelectElement;
const selectResolution = document.getElementById('selectResolution') as HTMLSelectElement;
const selectFps = document.getElementById('selectFps') as HTMLSelectElement;
const inputDuration = document.getElementById('inputDuration') as HTMLInputElement;
const valDuration = document.getElementById('valDuration') as HTMLElement;
const inputBitrate = document.getElementById('inputBitrate') as HTMLInputElement;
const valBitrate = document.getElementById('valBitrate') as HTMLElement;

const obsCutMs = document.getElementById('obsCutMs') as HTMLElement;
const obsCutFrame = document.getElementById('obsCutFrame') as HTMLElement;
const obsFilename = document.getElementById('obsFilename') as HTMLElement;
const obsTrackMatteRow = document.getElementById('obsTrackMatteRow') as HTMLElement;
const obsLayoutRow = document.getElementById('obsLayoutRow') as HTMLElement;
const btnCopyObsConfig = document.getElementById('btnCopyObsConfig') as HTMLButtonElement;
const inputManualCut = document.getElementById('inputManualCut') as HTMLInputElement;
const valManualCut = document.getElementById('valManualCut') as HTMLElement;
const btnResetCutPoint = document.getElementById('btnResetCutPoint') as HTMLButtonElement;

const guideToggle = document.getElementById('guideToggle') as HTMLElement;
const guideContent = document.getElementById('guideContent') as HTMLElement;
const guideArrow = document.getElementById('guideArrow') as HTMLElement;

const btnStartExport = document.getElementById('btnStartExport') as HTMLButtonElement;
const exportModal = document.getElementById('exportModal') as HTMLElement;
const exportStatusText = document.getElementById('exportStatusText') as HTMLElement;
const exportPercentText = document.getElementById('exportPercentText') as HTMLElement;
const exportProgressBar = document.getElementById('exportProgressBar') as HTMLElement;
const exportDetailsBox = document.getElementById('exportDetailsBox') as HTMLElement;
const exportResultArea = document.getElementById('exportResultArea') as HTMLElement;
const exportVideoPreview = document.getElementById('exportVideoPreview') as HTMLVideoElement;
const exportResultFileInfo = document.getElementById('exportResultFileInfo') as HTMLElement;
const exportResultCutInfo = document.getElementById('exportResultCutInfo') as HTMLElement;
const btnCancelExport = document.getElementById('btnCancelExport') as HTMLButtonElement;
const btnDownloadExport = document.getElementById('btnDownloadExport') as HTMLAnchorElement;
const toastMessage = document.getElementById('toastMessage') as HTMLElement;

// 現在の設定
let currentPresetId = 'hex';
let currentPreset = PRESET_MAP.get(currentPresetId)!;
let currentOptions = { ...currentPreset.defaultOptions };

let exportPipeline: VideoExportPipeline | null = null;

// AnimationEngine の初期化
const engine = new AnimationEngine(
  previewCanvas,
  currentPreset,
  currentOptions
);

// 画面読み込み時の初期UIセットアップ
function init() {
  renderPresetCards();
  syncOptionsToUI();
  engine.init({
    onFrameUpdate: handleFrameUpdate,
    onAnalysisUpdate: handleAnalysisUpdate,
    onPlayStateChange: handlePlayStateChange,
  });
  updateObsPanel();
  drawCoverageWaveform();
  setupEventListeners();
  setupKeyboardShortcuts();
}

// プリセットカードのレンダリング
function renderPresetCards() {
  presetList.innerHTML = '';
  for (const preset of ALL_PRESETS) {
    const card = document.createElement('div');
    card.className = `preset-card ${preset.id === currentPresetId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="preset-card-title">${preset.name}</div>
      <div class="preset-card-desc">${preset.category}</div>
    `;
    card.addEventListener('click', () => {
      selectPreset(preset.id);
    });
    presetList.appendChild(card);
  }
  presetDescription.textContent = currentPreset.description;
  hexSpecificControls.style.display = currentPresetId === 'hex' ? 'flex' : 'none';
  lineWipeSpecificControls.style.display = currentPresetId === 'line-wipe' ? 'flex' : 'none';
}

function selectPreset(presetId: string) {
  const preset = PRESET_MAP.get(presetId);
  if (!preset) return;
  currentPresetId = presetId;
  currentPreset = preset;
  currentOptions = { ...preset.defaultOptions };

  engine.setPreset(preset, currentOptions);
  renderPresetCards();
  syncOptionsToUI();
  updateObsPanel();
  drawCoverageWaveform();
}

// UIコントロールの値を現在の options に同期
function syncOptionsToUI() {
  primaryColorInput.value = currentOptions.primaryColor ?? '#6366f1';
  secondaryColorInput.value = currentOptions.secondaryColor ?? '#06b6d4';
  accentColorInput.value = currentOptions.accentColor ?? '#ec4899';
  borderColorInput.value = currentOptions.borderColor ?? '#38bdf8';

  inputBorderWidth.value = String(currentOptions.borderWidth ?? 3);
  valBorderWidth.textContent = `${inputBorderWidth.value}px`;

  inputHasGlow.checked = !!currentOptions.hasGlow;

  if (currentPresetId === 'hex') {
    inputHexStagger.value = String(currentOptions.staggerDelay ?? 0.65);
    valHexStagger.textContent = String(inputHexStagger.value);
    inputHexRotation.checked = !!currentOptions.rotationEffect;
  } else if (currentPresetId === 'line-wipe') {
    inputLineWidth.value = String(currentOptions.bandWidth ?? 180);
    valLineWidth.textContent = `${inputLineWidth.value}px`;
    inputLineAngle.value = String(currentOptions.angleDeg ?? 28);
    valLineAngle.textContent = `${inputLineAngle.value}°`;
    inputLineSpeedLines.checked = currentOptions.speedLines !== false;
  }
}

// フレーム更新イベント
function handleFrameUpdate(frame: number, progress: number, totalFrames: number, fps: number) {
  const currentSec = frame / fps;
  const totalSec = totalFrames / fps;

  // 時間表示 (00:00.000)
  const mins = Math.floor(currentSec / 60);
  const secs = Math.floor(currentSec % 60);
  const millis = Math.floor((currentSec % 1) * 1000);
  lblCurrentTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  lblTotalTime.textContent = `${totalSec.toFixed(3)}s`;
  lblFrameBadge.textContent = `F: ${frame + 1} / ${totalFrames}`;

  // シークバーの更新
  const pct = totalFrames > 1 ? (frame / (totalFrames - 1)) * 100 : 0;
  scrubberProgress.style.width = `${pct}%`;
}

// 解析結果更新イベント
function handleAnalysisUpdate(analysis: TransitionAnalysis) {
  const totalFrames = engine.getTotalFrames();
  const cutFrame = engine.getEffectiveCutFrame();
  const cutMs = engine.getEffectiveCutMs();

  // シークバー上のCUTマーカー位置
  const pct = totalFrames > 1 ? (cutFrame / (totalFrames - 1)) * 100 : 50;
  cutpointMarker.style.left = `${pct}%`;

  lblCutBadge.textContent = `CUT: ${cutFrame}f (${cutMs}ms)`;
  inputManualCut.max = String(totalFrames - 1);
  inputManualCut.value = String(cutFrame);

  updateObsPanel();
  drawCoverageWaveform();
}

// 再生状態変更イベント
function handlePlayStateChange(isPlaying: boolean) {
  if (isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }
}

// 出力ファイル名（フレーム数入り）の取得
function getOutputFilename(): string {
  const resKey = selectResolution.value as ResolutionPreset;
  const fps = selectFps.value;
  const cutFrame = engine.getEffectiveCutFrame();
  const format = selectFormat.value;
  const ext = format.endsWith('webm') ? 'webm' : 'mp4';
  return `stinger_${currentPresetId}_${resKey}_${fps}fps_${cutFrame}f.${ext}`;
}

// OBS設定パネルの更新
function updateObsPanel() {
  const cutMs = engine.getEffectiveCutMs();
  const cutFrame = engine.getEffectiveCutFrame();
  const format = selectFormat.value;
  const isTrackMatte = format.startsWith('trackmatte');

  obsCutMs.textContent = `${cutMs} ms`;
  obsCutFrame.textContent = `${cutFrame} frame`;

  if (obsFilename) {
    obsFilename.textContent = getOutputFilename();
  }

  if (isTrackMatte) {
    obsTrackMatteRow.style.display = 'table-row';
    obsLayoutRow.style.display = 'table-row';
  } else {
    obsTrackMatteRow.style.display = 'none';
    obsLayoutRow.style.display = 'none';
  }
}

// 不透明度波形（カバレッジ波形）をシークバー内に描画
function drawCoverageWaveform() {
  const analysis = engine.getTransitionAnalysis();
  if (!analysis) return;

  const rect = scrubberTrack.getBoundingClientRect();
  coverageCanvas.width = rect.width || 600;
  coverageCanvas.height = rect.height || 38;

  const ctx = coverageCanvas.getContext('2d');
  if (!ctx) return;

  const w = coverageCanvas.width;
  const h = coverageCanvas.height;
  const coverages = analysis.coverages;
  const n = coverages.length;
  if (n === 0) return;

  ctx.clearRect(0, 0, w, h);

  // カバレッジエリアの描画
  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const cov = coverages[i]; // 0.0 - 1.0
    const y = h - cov * (h * 0.85);
    ctx.lineTo(x, y);
  }

  ctx.lineTo(w, h);
  ctx.closePath();

  // グラデーション塗り
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(245, 158, 11, 0.5)'); // 完全不透明ゾーンはオレンジ/ゴールド
  grad.addColorStop(1, 'rgba(99, 102, 241, 0.15)');
  ctx.fillStyle = grad;
  ctx.fill();

  // トップライン
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const cov = coverages[i];
    const y = h - cov * (h * 0.85);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// イベントリスナーのセットアップ
function setupEventListeners() {
  // 再生系ボタン
  btnTogglePlay.addEventListener('click', () => engine.togglePlay());
  btnToStart.addEventListener('click', () => {
    engine.pause();
    engine.seekToFrame(0);
  });
  btnToEnd.addEventListener('click', () => {
    engine.pause();
    engine.seekToFrame(engine.getTotalFrames() - 1);
  });
  btnStepPrev.addEventListener('click', () => {
    engine.pause();
    engine.stepFrame(-1);
  });
  btnStepNext.addEventListener('click', () => {
    engine.pause();
    engine.stepFrame(1);
  });

  // シークバーのクリック & ドラッグ
  let isScrubbing = false;
  const seekAtMouse = (e: MouseEvent) => {
    const rect = scrubberTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    engine.seekToProgress(ratio);
  };

  scrubberTrack.addEventListener('mousedown', (e) => {
    isScrubbing = true;
    engine.pause();
    seekAtMouse(e);
  });

  window.addEventListener('mousemove', (e) => {
    if (isScrubbing) {
      seekAtMouse(e);
    }
  });

  window.addEventListener('mouseup', () => {
    isScrubbing = false;
  });

  // 背景モード切り替え
  document.querySelectorAll<HTMLButtonElement>('.bg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-bg') as BackgroundMode;
      engine.setBackgroundMode(mode);
    });
  });

  // カラーピッカー変更
  const updateColors = () => {
    currentOptions.primaryColor = primaryColorInput.value;
    currentOptions.secondaryColor = secondaryColorInput.value;
    currentOptions.accentColor = accentColorInput.value;
    currentOptions.borderColor = borderColorInput.value;
    currentOptions.glowColor = borderColorInput.value;
    engine.updateOptions(currentOptions);
  };

  primaryColorInput.addEventListener('input', updateColors);
  secondaryColorInput.addEventListener('input', updateColors);
  accentColorInput.addEventListener('input', updateColors);
  borderColorInput.addEventListener('input', updateColors);

  // ボーダー幅 & グロー
  inputBorderWidth.addEventListener('input', () => {
    const val = parseInt(inputBorderWidth.value, 10);
    valBorderWidth.textContent = `${val}px`;
    currentOptions.borderWidth = val;
    engine.updateOptions(currentOptions);
  });
  inputBorderWidth.addEventListener('change', () => {
    engine.flushPendingAnalysis();
  });

  inputHasGlow.addEventListener('change', () => {
    currentOptions.hasGlow = inputHasGlow.checked;
    engine.updateOptions(currentOptions, true);
  });

  // HEX 特有設定
  inputHexStagger.addEventListener('input', () => {
    const val = parseFloat(inputHexStagger.value);
    valHexStagger.textContent = String(val);
    currentOptions.staggerDelay = val;
    engine.updateOptions(currentOptions);
  });
  inputHexStagger.addEventListener('change', () => {
    engine.flushPendingAnalysis();
  });

  inputHexRotation.addEventListener('change', () => {
    currentOptions.rotationEffect = inputHexRotation.checked;
    engine.updateOptions(currentOptions, true);
  });

  // LINE WIPE 特有設定
  inputLineWidth.addEventListener('input', () => {
    const val = parseInt(inputLineWidth.value, 10);
    valLineWidth.textContent = `${val}px`;
    currentOptions.bandWidth = val;
    engine.updateOptions(currentOptions);
  });
  inputLineWidth.addEventListener('change', () => {
    engine.flushPendingAnalysis();
  });

  inputLineAngle.addEventListener('input', () => {
    const val = parseInt(inputLineAngle.value, 10);
    valLineAngle.textContent = `${val}°`;
    currentOptions.angleDeg = val;
    engine.updateOptions(currentOptions);
  });
  inputLineAngle.addEventListener('change', () => {
    engine.flushPendingAnalysis();
  });

  inputLineSpeedLines.addEventListener('change', () => {
    currentOptions.speedLines = inputLineSpeedLines.checked;
    engine.updateOptions(currentOptions, true);
  });

  // 出力設定: 解像度 / FPS / デュレーション
  selectResolution.addEventListener('change', () => {
    const resKey = selectResolution.value as ResolutionPreset;
    const res = RESOLUTIONS[resKey];
    canvasResBadge.textContent = `${res.width}×${res.height}`;
    engine.resize(res.width, res.height);
    updateObsPanel();
  });

  selectFps.addEventListener('change', () => {
    const fps = parseInt(selectFps.value, 10) as 30 | 60;
    const dur = parseFloat(inputDuration.value);
    engine.setConfig(fps, dur, true);
    updateObsPanel();
  });

  inputDuration.addEventListener('input', () => {
    const dur = parseFloat(inputDuration.value);
    valDuration.textContent = `${dur.toFixed(1)} 秒`;
    const fps = parseInt(selectFps.value, 10) as 30 | 60;
    engine.setConfig(fps, dur, false);
  });
  inputDuration.addEventListener('change', () => {
    engine.flushPendingAnalysis();
  });

  inputBitrate.addEventListener('input', () => {
    valBitrate.textContent = `${inputBitrate.value} Mbps`;
  });

  selectFormat.addEventListener('change', () => {
    updateObsPanel();
  });

  // 手動移行ポイント調整スライダー
  inputManualCut.addEventListener('input', () => {
    const frame = parseInt(inputManualCut.value, 10);
    engine.setManualCutFrame(frame);
    valManualCut.textContent = `${frame}f (${engine.getEffectiveCutMs()}ms)`;
    const totalFrames = engine.getTotalFrames();
    const pct = totalFrames > 1 ? (frame / (totalFrames - 1)) * 100 : 50;
    cutpointMarker.style.left = `${pct}%`;
    updateObsPanel();
  });

  btnResetCutPoint.addEventListener('click', () => {
    engine.setManualCutFrame(null);
    valManualCut.textContent = '自動算出';
    const cutFrame = engine.getEffectiveCutFrame();
    inputManualCut.value = String(cutFrame);
    const totalFrames = engine.getTotalFrames();
    const pct = totalFrames > 1 ? (cutFrame / (totalFrames - 1)) * 100 : 50;
    cutpointMarker.style.left = `${pct}%`;
    updateObsPanel();
    showToast('移行ポイントを自動算出値にリセットしました');
  });

  // OBS設定メモコピーボタン
  btnCopyObsConfig.addEventListener('click', () => {
    const cutMs = engine.getEffectiveCutMs();
    const cutFrame = engine.getEffectiveCutFrame();
    const isTrackMatte = selectFormat.value.startsWith('trackmatte');
    const filename = getOutputFilename();

    const configText = [
      '【OBS スティンガー設定値】',
      `- トランジション種別: スティンガー`,
      `- 映像ファイル: ${filename}`,
      `- 移行ポイント (時間): ${cutMs} ms`,
      `- 移行ポイント (フレーム): ${cutFrame} frame`,
      `- トラックマットを使用する: ${isTrackMatte ? 'チェック (有効)' : 'チェックなし'}`,
      isTrackMatte ? '- マットレイアウト: 横並び（左: 透過映像、右: マスク）' : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(configText).then(() => {
      showToast('OBS設定パラメータをクリップボードにコピーしました！');
    });
  });

  // OBSガイドのアコーディオン開閉
  guideToggle.addEventListener('click', () => {
    const isHidden = guideContent.style.display === 'none';
    guideContent.style.display = isHidden ? 'block' : 'none';
    guideArrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });

  // エクスポート実行
  btnStartExport.addEventListener('click', startExport);
  btnCancelExport.addEventListener('click', () => {
    if (exportPipeline) {
      exportPipeline.cancel();
    }
    hideExportModal();
  });

  // ウィンドウリサイズ時に波形キャンバス再描画
  window.addEventListener('resize', () => {
    drawCoverageWaveform();
  });
}

// キーボードショートカット
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // 入力フォームフォーカス中はスキップ
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      engine.togglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      engine.pause();
      engine.stepFrame(-1);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      engine.pause();
      engine.stepFrame(1);
    } else if (e.code === 'Home') {
      e.preventDefault();
      engine.pause();
      engine.seekToFrame(0);
    } else if (e.code === 'End') {
      e.preventDefault();
      engine.pause();
      engine.seekToFrame(engine.getTotalFrames() - 1);
    }
  });
}

// トースト通知表示
function showToast(message: string) {
  toastMessage.textContent = message;
  toastMessage.classList.add('show');
  setTimeout(() => {
    toastMessage.classList.remove('show');
  }, 2800);
}

// エクスポートモーダルの表示・非表示
function showExportModal() {
  exportModal.classList.add('show');
  exportProgressBar.style.width = '0%';
  exportPercentText.textContent = '0%';
  exportResultArea.style.display = 'none';
  btnDownloadExport.style.display = 'none';
  btnCancelExport.textContent = 'キャンセル';
}

function hideExportModal() {
  exportModal.classList.remove('show');
  if (exportVideoPreview.src) {
    URL.revokeObjectURL(exportVideoPreview.src);
    exportVideoPreview.src = '';
  }
}

// エクスポートのメイン実行
async function startExport() {
  engine.pause();
  engine.flushPendingAnalysis();
  showExportModal();

  const resKey = selectResolution.value as ResolutionPreset;
  const resolution = RESOLUTIONS[resKey];
  const fps = parseInt(selectFps.value, 10) as 30 | 60;
  const durationSec = parseFloat(inputDuration.value);
  const bitrateMbps = parseInt(inputBitrate.value, 10);
  const format = selectFormat.value as any;

  const exportConfig: ExportConfig = {
    resolutionKey: resKey,
    resolution,
    fps,
    format,
    durationSec,
    bitrateMbps,
  };

  exportPipeline = new VideoExportPipeline();

  try {
    const result = await exportPipeline.exportVideo(
      currentPreset,
      currentOptions,
      exportConfig,
      (ev) => {
        exportStatusText.textContent = ev.statusMessage;
        exportPercentText.textContent = `${ev.progressPercent}%`;
        exportProgressBar.style.width = `${ev.progressPercent}%`;
      },
      engine.getEffectiveCutFrame()
    );

    // 成功処理
    exportStatusText.textContent = '書き出し完了！';
    exportPercentText.textContent = '100%';
    exportProgressBar.style.width = '100%';
    exportDetailsBox.style.display = 'none';

    // プレビュービデオとダウンロードボタンの設定
    exportVideoPreview.src = result.downloadUrl;
    exportVideoPreview.play().catch(() => {});
    exportResultArea.style.display = 'flex';

    const sizeMb = (result.filesizeBytes / (1024 * 1024)).toFixed(2);
    exportResultFileInfo.textContent = `サイズ: ${sizeMb} MB (${result.width}×${result.height}, ${result.fps}fps)`;
    exportResultCutInfo.textContent = `移行ポイント: ${engine.getEffectiveCutMs()} ms`;

    btnDownloadExport.href = result.downloadUrl;
    btnDownloadExport.download = result.filename;
    btnDownloadExport.style.display = 'inline-flex';
    btnCancelExport.textContent = '閉じる';

    // 完了祝賀演出
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });
  } catch (err: any) {
    exportStatusText.textContent = 'エラーが発生しました';
    exportDetailsBox.textContent = `エラー: ${err.message || err}`;
    exportDetailsBox.style.display = 'block';
    exportProgressBar.style.backgroundColor = '#ef4444';
  }
}

// 起動
init();

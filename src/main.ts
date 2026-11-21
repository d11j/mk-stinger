import confetti from 'canvas-confetti';
import { ALL_PRESETS, PRESET_MAP } from './engine/presets';
import { AnimationEngine, BackgroundMode } from './engine/AnimationEngine';
import { ExportConfig, RESOLUTIONS, ResolutionPreset } from './types';
import { VideoExportPipeline } from './encoder/VideoExportPipeline';

// DOM 要素の取得
const previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
const scrubberTrack = document.getElementById('scrubberTrack') as HTMLDivElement;
const scrubberProgress = document.getElementById('scrubberProgress') as HTMLDivElement;

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

const spriteWipeSpecificControls = document.getElementById('spriteWipeSpecificControls') as HTMLElement;
const selectSpriteType = document.getElementById('selectSpriteType') as HTMLSelectElement;
const customImageContainer = document.getElementById('customImageContainer') as HTMLElement;
const btnUploadImageTrigger = document.getElementById('btnUploadImageTrigger') as HTMLButtonElement;
const inputSpriteCustomImage = document.getElementById('inputSpriteCustomImage') as HTMLInputElement;
const customImagePreviewWrapper = document.getElementById('customImagePreviewWrapper') as HTMLElement;
const customImageThumb = document.getElementById('customImageThumb') as HTMLImageElement;
const customImageName = document.getElementById('customImageName') as HTMLElement;
const customImageDim = document.getElementById('customImageDim') as HTMLElement;
const btnClearCustomImage = document.getElementById('btnClearCustomImage') as HTMLButtonElement;
const inputSpriteSize = document.getElementById('inputSpriteSize') as HTMLInputElement;
const valSpriteSize = document.getElementById('valSpriteSize') as HTMLElement;
const inputSpriteSizeScatter = document.getElementById('inputSpriteSizeScatter') as HTMLInputElement;
const valSpriteSizeScatter = document.getElementById('valSpriteSizeScatter') as HTMLElement;
const inputSpriteCount = document.getElementById('inputSpriteCount') as HTMLInputElement;
const valSpriteCount = document.getElementById('valSpriteCount') as HTMLElement;
const inputSpriteScatter = document.getElementById('inputSpriteScatter') as HTMLInputElement;
const valSpriteScatter = document.getElementById('valSpriteScatter') as HTMLElement;
const inputSpriteRotate = document.getElementById('inputSpriteRotate') as HTMLInputElement;
const inputSpriteLineAngle = document.getElementById('inputSpriteLineAngle') as HTMLInputElement;
const valSpriteLineAngle = document.getElementById('valSpriteLineAngle') as HTMLElement;

const outputFormatInfo = document.getElementById('outputFormatInfo') as HTMLElement;
const selectResolution = document.getElementById('selectResolution') as HTMLSelectElement;
const selectFps = document.getElementById('selectFps') as HTMLSelectElement;
const inputDuration = document.getElementById('inputDuration') as HTMLInputElement;
const valDuration = document.getElementById('valDuration') as HTMLElement;
const inputBitrate = document.getElementById('inputBitrate') as HTMLInputElement;
const valBitrate = document.getElementById('valBitrate') as HTMLElement;

const obsFilename = document.getElementById('obsFilename') as HTMLElement;
const obsOutputResolution = document.getElementById('obsOutputResolution') as HTMLElement;
const btnCopyObsConfig = document.getElementById('btnCopyObsConfig') as HTMLButtonElement;

const guideToggle = document.getElementById('guideToggle') as HTMLElement;
const guideContent = document.getElementById('guideContent') as HTMLElement;
const guideArrow = document.getElementById('guideArrow') as HTMLElement;

const btnStartExport = document.getElementById('btnStartExport') as HTMLButtonElement;
const exportModal = document.getElementById('exportModal') as HTMLElement;
const exportStatusText = document.getElementById('exportStatusText') as HTMLElement;
const exportPercentText = document.getElementById('exportPercentText') as HTMLElement;
const exportProgressBar = document.getElementById('exportProgressBar') as HTMLElement;
const exportDetailsBox = document.getElementById('exportDetailsBox') as HTMLElement;

const btnOpenLicense = document.getElementById('btnOpenLicense') as HTMLButtonElement;
const btnLicenseSummaryLink = document.getElementById('btnLicenseSummaryLink') as HTMLButtonElement;
const btnExportLicenseLink = document.getElementById('btnExportLicenseLink') as HTMLButtonElement;
const licenseModal = document.getElementById('licenseModal') as HTMLElement;
const btnCloseLicense = document.getElementById('btnCloseLicense') as HTMLButtonElement;
const exportResultArea = document.getElementById('exportResultArea') as HTMLElement;
const exportVideoPreview = document.getElementById('exportVideoPreview') as HTMLVideoElement;
const exportResultFileInfo = document.getElementById('exportResultFileInfo') as HTMLElement;
const exportResultLayoutInfo = document.getElementById('exportResultLayoutInfo') as HTMLElement;
const btnCancelExport = document.getElementById('btnCancelExport') as HTMLButtonElement;
const btnDownloadExport = document.getElementById('btnDownloadExport') as HTMLAnchorElement;
const toastMessage = document.getElementById('toastMessage') as HTMLElement;

// 現在の設定
let currentPresetId = 'hex';
let currentPreset = PRESET_MAP.get(currentPresetId)!;
let currentOptions = { ...currentPreset.defaultOptions };

const DEFAULT_EXPORT_DETAILS_TEXT = 'WebCodecs API により、ブラウザ上で直接高速エンコードを実行しています。';

let exportPipeline: VideoExportPipeline | null = null;
let isExporting = false;

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
    onPlayStateChange: handlePlayStateChange,
  });
  updateObsPanel();
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
  spriteWipeSpecificControls.style.display = currentPresetId === 'sprite-wipe' ? 'flex' : 'none';
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
  } else if (currentPresetId === 'sprite-wipe') {
    selectSpriteType.value = currentOptions.spriteType ?? 'star';
    customImageContainer.style.display = currentOptions.spriteType === 'custom' ? 'flex' : 'none';
    inputSpriteSize.value = String(currentOptions.spriteSize ?? 96);
    valSpriteSize.textContent = `${inputSpriteSize.value}px`;
    const sizeScatterVal = currentOptions.sizeScatter ?? 0.4;
    inputSpriteSizeScatter.value = String(sizeScatterVal);
    valSpriteSizeScatter.textContent = `${Math.round(sizeScatterVal * 100)}%`;
    inputSpriteCount.value = String(currentOptions.spriteCount ?? 16);
    valSpriteCount.textContent = `${inputSpriteCount.value}個`;
    inputSpriteScatter.value = String(currentOptions.spriteScatter ?? 36);
    valSpriteScatter.textContent = `${inputSpriteScatter.value}px`;
    inputSpriteRotate.checked = currentOptions.spriteRotate !== false;
    inputSpriteLineAngle.value = String(currentOptions.angleDeg ?? 26);
    valSpriteLineAngle.textContent = `${inputSpriteLineAngle.value}°`;

    if (currentOptions.customImage) {
      customImagePreviewWrapper.style.display = 'flex';
      customImageThumb.src = currentOptions.customImage.src;
    } else {
      customImagePreviewWrapper.style.display = 'none';
    }
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

// 出力ファイル名の取得
function getOutputFilename(): string {
  const resKey = selectResolution.value as ResolutionPreset;
  const fps = selectFps.value;
  return `stinger_${currentPresetId}_${resKey}_${fps}fps.webm`;
}

// OBS設定パネル・出力形式表示の更新
function updateObsPanel() {
  const resKey = selectResolution.value as ResolutionPreset;
  const res = RESOLUTIONS[resKey];
  const outputWidth = res.width * 2;
  const outputHeight = res.height;

  outputFormatInfo.textContent = `トラックマット WebM (VP9 / ${outputWidth}×${outputHeight})`;
  obsFilename.textContent = getOutputFilename();
  obsOutputResolution.textContent = `${outputWidth}×${outputHeight} (横並び)`;
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

  inputHasGlow.addEventListener('change', () => {
    currentOptions.hasGlow = inputHasGlow.checked;
    engine.updateOptions(currentOptions);
  });

  // HEX 特有設定
  inputHexStagger.addEventListener('input', () => {
    const val = parseFloat(inputHexStagger.value);
    valHexStagger.textContent = String(val);
    currentOptions.staggerDelay = val;
    engine.updateOptions(currentOptions);
  });

  inputHexRotation.addEventListener('change', () => {
    currentOptions.rotationEffect = inputHexRotation.checked;
    engine.updateOptions(currentOptions);
  });

  // LINE WIPE 特有設定
  inputLineWidth.addEventListener('input', () => {
    const val = parseInt(inputLineWidth.value, 10);
    valLineWidth.textContent = `${val}px`;
    currentOptions.bandWidth = val;
    engine.updateOptions(currentOptions);
  });

  inputLineAngle.addEventListener('input', () => {
    const val = parseInt(inputLineAngle.value, 10);
    valLineAngle.textContent = `${val}°`;
    currentOptions.angleDeg = val;
    engine.updateOptions(currentOptions);
  });

  inputLineSpeedLines.addEventListener('change', () => {
    currentOptions.speedLines = inputLineSpeedLines.checked;
    engine.updateOptions(currentOptions);
  });

  // SPRITE WIPE (DECORATED LINE) 特有設定
  selectSpriteType.addEventListener('change', () => {
    currentOptions.spriteType = selectSpriteType.value;
    customImageContainer.style.display = currentOptions.spriteType === 'custom' ? 'flex' : 'none';
    engine.updateOptions(currentOptions);
  });

  btnUploadImageTrigger.addEventListener('click', () => {
    inputSpriteCustomImage.click();
  });

  inputSpriteCustomImage.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        currentOptions.customImage = img;
        currentOptions.spriteType = 'custom';
        selectSpriteType.value = 'custom';
        customImageContainer.style.display = 'flex';
        customImagePreviewWrapper.style.display = 'flex';
        customImageThumb.src = img.src;
        customImageName.textContent = file.name;
        customImageDim.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
        engine.updateOptions(currentOptions);
        showToast(`画像「${file.name}」を読み込みました`);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });

  btnClearCustomImage.addEventListener('click', () => {
    currentOptions.customImage = null;
    inputSpriteCustomImage.value = '';
    customImagePreviewWrapper.style.display = 'none';
    engine.updateOptions(currentOptions);
    showToast('カスタム画像を解除しました');
  });

  inputSpriteSize.addEventListener('input', () => {
    const val = parseInt(inputSpriteSize.value, 10);
    valSpriteSize.textContent = `${val}px`;
    currentOptions.spriteSize = val;
    engine.updateOptions(currentOptions);
  });

  inputSpriteSizeScatter.addEventListener('input', () => {
    const val = parseFloat(inputSpriteSizeScatter.value);
    valSpriteSizeScatter.textContent = `${Math.round(val * 100)}%`;
    currentOptions.sizeScatter = val;
    engine.updateOptions(currentOptions);
  });

  inputSpriteCount.addEventListener('input', () => {
    const val = parseInt(inputSpriteCount.value, 10);
    valSpriteCount.textContent = `${val}個`;
    currentOptions.spriteCount = val;
    engine.updateOptions(currentOptions);
  });

  inputSpriteScatter.addEventListener('input', () => {
    const val = parseInt(inputSpriteScatter.value, 10);
    valSpriteScatter.textContent = `${val}px`;
    currentOptions.spriteScatter = val;
    engine.updateOptions(currentOptions);
  });

  inputSpriteRotate.addEventListener('change', () => {
    currentOptions.spriteRotate = inputSpriteRotate.checked;
    engine.updateOptions(currentOptions);
  });

  inputSpriteLineAngle.addEventListener('input', () => {
    const val = parseInt(inputSpriteLineAngle.value, 10);
    valSpriteLineAngle.textContent = `${val}°`;
    currentOptions.angleDeg = val;
    engine.updateOptions(currentOptions);
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
    engine.setConfig(fps, dur);
    updateObsPanel();
  });

  inputDuration.addEventListener('input', () => {
    const dur = parseFloat(inputDuration.value);
    valDuration.textContent = `${dur.toFixed(1)} 秒`;
    const fps = parseInt(selectFps.value, 10) as 30 | 60;
    engine.setConfig(fps, dur);
  });

  inputBitrate.addEventListener('input', () => {
    valBitrate.textContent = `${inputBitrate.value} Mbps`;
  });

  // OBS設定メモコピーボタン
  btnCopyObsConfig.addEventListener('click', () => {
    const resKey = selectResolution.value as ResolutionPreset;
    const res = RESOLUTIONS[resKey];
    const filename = getOutputFilename();

    const configText = [
      '【OBS スティンガー設定値】',
      `- トランジション種別: スティンガー`,
      `- 動画ファイル: ${filename}`,
      `- 出力解像度: ${res.width * 2}×${res.height} (横並び)`,
      `- トラックマットを使用する: チェック (有効)`,
      `- マットレイアウト: 同じファイル、並べて表示（左: 透過映像、右: マスク）`,
    ].join('\n');

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
      exportPipeline = null;
    }
    isExporting = false;
    btnStartExport.disabled = false;
    hideExportModal();
  });

  // ライセンス・利用条件モーダル
  const openLicenseModal = () => licenseModal.classList.add('show');
  const closeLicenseModal = () => licenseModal.classList.remove('show');
  btnOpenLicense.addEventListener('click', openLicenseModal);
  btnLicenseSummaryLink.addEventListener('click', openLicenseModal);
  btnExportLicenseLink.addEventListener('click', openLicenseModal);
  btnCloseLicense.addEventListener('click', closeLicenseModal);
  licenseModal.addEventListener('click', (e) => {
    if (e.target === licenseModal) {
      closeLicenseModal();
    }
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

    if (e.code === 'Escape' && licenseModal.classList.contains('show')) {
      licenseModal.classList.remove('show');
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
  exportStatusText.textContent = 'レンダリング準備中...';
  exportProgressBar.style.width = '0%';
  exportProgressBar.style.background = '';
  exportProgressBar.style.backgroundColor = '';
  exportPercentText.textContent = '0%';
  exportDetailsBox.textContent = DEFAULT_EXPORT_DETAILS_TEXT;
  exportDetailsBox.style.display = '';
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
  if (isExporting) {
    return;
  }

  isExporting = true;
  btnStartExport.disabled = true;

  engine.pause();
  showExportModal();

  const resKey = selectResolution.value as ResolutionPreset;
  const resolution = RESOLUTIONS[resKey];
  const fps = parseInt(selectFps.value, 10) as 30 | 60;
  const durationSec = parseFloat(inputDuration.value);
  const bitrateMbps = parseInt(inputBitrate.value, 10);

  const exportConfig: ExportConfig = {
    resolutionKey: resKey,
    resolution,
    fps,
    durationSec,
    bitrateMbps,
  };

  const pipeline = new VideoExportPipeline();
  exportPipeline = pipeline;

  try {
    const result = await pipeline.exportVideo(
      currentPreset,
      currentOptions,
      exportConfig,
      (ev) => {
        if (exportPipeline !== pipeline) {
          return;
        }
        exportStatusText.textContent = ev.statusMessage;
        exportPercentText.textContent = `${ev.progressPercent}%`;
        exportProgressBar.style.width = `${ev.progressPercent}%`;
      }
    );

    if (exportPipeline !== pipeline) {
      return;
    }

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
    exportResultLayoutInfo.textContent = '形式: 横並びトラックマット (WebM)';

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
    if (exportPipeline !== pipeline) {
      return;
    }
    exportStatusText.textContent = 'エラーが発生しました';
    exportDetailsBox.textContent = `エラー: ${err.message || err}`;
    exportDetailsBox.style.display = 'block';
    exportProgressBar.style.background = '#ef4444';
  } finally {
    if (exportPipeline === pipeline) {
      exportPipeline = null;
      isExporting = false;
      btnStartExport.disabled = false;
    }
  }
}

// 起動
init();

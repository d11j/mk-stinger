import confetti from 'canvas-confetti';
import { ALL_PRESETS, PRESET_MAP } from './engine/presets';
import { AnimationEngine, BackgroundMode } from './engine/AnimationEngine';
import { ExportConfig, RESOLUTIONS, ResolutionPreset } from './types';
import { VideoExportPipeline } from './encoder/VideoExportPipeline';
import { PresetParamsPanel } from './ui/PresetParamsPanel';
import { readImageFile, setupDropZone } from './ui/fileHelpers';
import { COLOR_THEMES, ColorPalette, generateRandomColorPalette } from './ui/colorThemes';
import { PresetStateStore } from './state/PresetStateStore';

// DOM 要素の取得
const previewCanvas = document.getElementById('previewCanvas') as HTMLCanvasElement;
const scrubberTrack = document.getElementById('scrubberTrack') as HTMLDivElement;
const scrubberProgress = document.getElementById('scrubberProgress') as HTMLDivElement;

const btnToStart = document.getElementById('btnToStart') as HTMLButtonElement;
const btnStepPrev = document.getElementById('btnStepPrev') as HTMLButtonElement;
const btnTogglePlay = document.getElementById('btnTogglePlay') as HTMLButtonElement;
const btnStepNext = document.getElementById('btnStepNext') as HTMLButtonElement;
const btnToEnd = document.getElementById('btnToEnd') as HTMLButtonElement;
const btnToggleLoop = document.getElementById('btnToggleLoop') as HTMLButtonElement;
const btnOneShotTest = document.getElementById('btnOneShotTest') as HTMLButtonElement;
const iconPlay = document.getElementById('iconPlay') as HTMLElement;
const iconPause = document.getElementById('iconPause') as HTMLElement;

const sceneSimControls = document.getElementById('sceneSimControls') as HTMLElement;
const sceneASlot = document.getElementById('sceneASlot') as HTMLElement;
const sceneBSlot = document.getElementById('sceneBSlot') as HTMLElement;
const sceneAFileName = document.getElementById('sceneAFileName') as HTMLElement;
const sceneBFileName = document.getElementById('sceneBFileName') as HTMLElement;
const btnUploadSceneA = document.getElementById('btnUploadSceneA') as HTMLButtonElement;
const btnUploadSceneB = document.getElementById('btnUploadSceneB') as HTMLButtonElement;
const btnClearSceneA = document.getElementById('btnClearSceneA') as HTMLButtonElement;
const btnClearSceneB = document.getElementById('btnClearSceneB') as HTMLButtonElement;
const inputSceneAImage = document.getElementById('inputSceneAImage') as HTMLInputElement;
const inputSceneBImage = document.getElementById('inputSceneBImage') as HTMLInputElement;

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
const glowColorInput = document.getElementById('glowColorInput') as HTMLInputElement;
const colorThemeList = document.getElementById('colorThemeList') as HTMLDivElement;
const btnRandomColors = document.getElementById('btnRandomColors') as HTMLButtonElement;
const btnResetColors = document.getElementById('btnResetColors') as HTMLButtonElement;
const inputBorderWidth = document.getElementById('inputBorderWidth') as HTMLInputElement;
const valBorderWidth = document.getElementById('valBorderWidth') as HTMLElement;
const inputHasGlow = document.getElementById('inputHasGlow') as HTMLInputElement;
const glowBlurControlGroup = document.getElementById('glowBlurControlGroup') as HTMLElement;
const inputGlowBlur = document.getElementById('inputGlowBlur') as HTMLInputElement;
const valGlowBlur = document.getElementById('valGlowBlur') as HTMLElement;

const presetSpecificControls = document.getElementById('presetSpecificControls') as HTMLElement;

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

// 現在の設定（同一セッション内のプリセット別ドラフト・カラー引き継ぎを管理）
const stateStore = new PresetStateStore(PRESET_MAP, 'hex');

const DEFAULT_EXPORT_DETAILS_TEXT =
  'WebCodecs API により、ブラウザ上で直接高速エンコードを実行しています。';

let exportPipeline: VideoExportPipeline | null = null;
let isExporting = false;

// AnimationEngine の初期化
const engine = new AnimationEngine(
  previewCanvas,
  stateStore.getCurrentPreset(),
  stateStore.getCurrentOptions()
);

// スキーマ駆動パラメータパネルの初期化
const presetParamsPanel = new PresetParamsPanel(presetSpecificControls, {
  onOptionChange: (key, value) => {
    stateStore.updateOption(key, value);
    engine.updateOptions(stateStore.getCurrentOptions());
  },
  onToast: showToast,
});

// 画面読み込み時の初期UIセットアップ
function init() {
  renderPresetCards();
  renderColorThemes();
  syncOptionsToUI();
  presetParamsPanel.render(stateStore.getCurrentPreset().params, stateStore.getCurrentOptions());
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
  const activePresetId = stateStore.getCurrentPresetId();
  presetList.innerHTML = '';
  for (const preset of ALL_PRESETS) {
    const card = document.createElement('div');
    card.className = `preset-card ${preset.id === activePresetId ? 'active' : ''}`;
    card.innerHTML = `
      <div class="preset-card-title">${preset.name}</div>
      <div class="preset-card-desc">${preset.category}</div>
    `;
    card.addEventListener('click', () => {
      selectPreset(preset.id);
    });
    presetList.appendChild(card);
  }
  presetDescription.textContent = stateStore.getCurrentPreset().description;
}

function selectPreset(presetId: string) {
  const result = stateStore.selectPreset(presetId);
  if (!result) return;

  engine.setPreset(result.preset, result.options);
  renderPresetCards();
  syncOptionsToUI();
  presetParamsPanel.render(result.preset.params, result.options);
  updateObsPanel();
}

// カラーテーマプリセットチップのレンダリング
function renderColorThemes() {
  colorThemeList.innerHTML = '';
  for (const theme of COLOR_THEMES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-theme-chip';
    btn.dataset.themeId = theme.id;
    btn.title = `${theme.name} (${theme.reference})`;

    const swatches = document.createElement('span');
    swatches.className = 'color-theme-swatches';
    for (const hex of [
      theme.colors.primaryColor,
      theme.colors.secondaryColor,
      theme.colors.accentColor,
    ]) {
      const dot = document.createElement('span');
      dot.className = 'color-theme-dot';
      dot.style.backgroundColor = hex;
      swatches.appendChild(dot);
    }

    const name = document.createElement('span');
    name.className = 'color-theme-name';
    name.textContent = theme.name;

    btn.append(swatches, name);
    btn.addEventListener('click', () => {
      applyColorPalette(theme.colors, theme.id);
    });
    colorThemeList.appendChild(btn);
  }
  updateActiveColorThemeUI();
}

function updateActiveColorThemeUI() {
  const activeThemeId = stateStore.getActiveColorThemeId();
  colorThemeList.querySelectorAll<HTMLButtonElement>('.color-theme-chip').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeId === activeThemeId);
  });
}

function applyColorPalette(palette: ColorPalette, themeId: string | null) {
  stateStore.applyColorPalette(palette, themeId);

  syncOptionsToUI();
  engine.updateOptions(stateStore.getCurrentOptions());
}

// UIコントロールの値を現在の options に同期
function syncOptionsToUI() {
  const currentOptions = stateStore.getCurrentOptions();

  primaryColorInput.value = currentOptions.primaryColor ?? '#6366f1';
  secondaryColorInput.value = currentOptions.secondaryColor ?? '#06b6d4';
  accentColorInput.value = currentOptions.accentColor ?? '#ec4899';
  borderColorInput.value = currentOptions.borderColor ?? '#38bdf8';
  glowColorInput.value = currentOptions.glowColor ?? currentOptions.borderColor ?? '#38bdf8';

  updateActiveColorThemeUI();

  inputBorderWidth.value = String(currentOptions.borderWidth ?? 3);
  valBorderWidth.textContent = `${inputBorderWidth.value}px`;

  const hasGlow = !!currentOptions.hasGlow;
  inputHasGlow.checked = hasGlow;
  glowBlurControlGroup.style.display = hasGlow ? 'flex' : 'none';

  const glowBlurVal = currentOptions.glowBlur ?? 15;
  inputGlowBlur.value = String(glowBlurVal);
  valGlowBlur.textContent = `${glowBlurVal}px`;
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
  return `stinger_${stateStore.getCurrentPresetId()}_${resKey}_${fps}fps.webm`;
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

// 解像度バッジ更新
function updateCanvasResBadge() {
  const resKey = selectResolution.value as ResolutionPreset;
  const res = RESOLUTIONS[resKey];
  if (engine.getBackgroundMode() === 'side_by_side') {
    canvasResBadge.textContent = `${res.width * 2}×${res.height} (32:9)`;
  } else {
    canvasResBadge.textContent = `${res.width}×${res.height}`;
  }
}

// 背景モード切り替え
function setBackgroundMode(mode: BackgroundMode) {
  document.querySelectorAll<HTMLButtonElement>('.bg-btn').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-bg') === mode);
  });
  engine.setBackgroundMode(mode);
  previewCanvas.classList.toggle('side-by-side', mode === 'side_by_side');
  sceneSimControls.style.display = mode === 'scene_sim' ? 'flex' : 'none';
  updateCanvasResBadge();
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

  const syncLoopButtonUI = (isLooping: boolean) => {
    btnToggleLoop.classList.toggle('active', isLooping);
    btnToggleLoop.setAttribute('aria-pressed', String(isLooping));
  };

  btnToggleLoop.addEventListener('click', () => {
    const nextLoop = !engine.getIsLooping();
    engine.setLooping(nextLoop);
    syncLoopButtonUI(nextLoop);
  });

  btnOneShotTest.addEventListener('click', () => {
    if (engine.getBackgroundMode() !== 'scene_sim') {
      setBackgroundMode('scene_sim');
    }
    engine.playOneShot();
    syncLoopButtonUI(engine.getIsLooping());
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
      const mode = btn.getAttribute('data-bg') as BackgroundMode;
      setBackgroundMode(mode);
    });
  });

  // 配信切替テスト用 カスタムシーン画像設定
  const setupSceneImageSlot = (
    scene: 'A' | 'B',
    slotEl: HTMLElement,
    fileNameEl: HTMLElement,
    uploadBtn: HTMLButtonElement,
    clearBtn: HTMLButtonElement,
    fileInput: HTMLInputElement
  ) => {
    const loadSceneFile = (file: File) => {
      readImageFile(
        file,
        (img) => {
          engine.setCustomSceneImage(scene, img);
          fileNameEl.textContent = file.name;
          clearBtn.style.display = 'inline-flex';
          showToast(`Scene ${scene} に「${file.name}」を設定しました`);
        },
        () => {
          showToast('画像ファイル（PNG / JPEG / WebP / SVG 等）を選択してください');
        }
      );
    };

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        loadSceneFile(files[0]);
      }
    });
    clearBtn.addEventListener('click', () => {
      engine.setCustomSceneImage(scene, null);
      fileInput.value = '';
      fileNameEl.textContent = 'デフォルト';
      clearBtn.style.display = 'none';
      showToast(`Scene ${scene} をデフォルトに戻しました`);
    });
    setupDropZone(slotEl, loadSceneFile);
  };

  setupSceneImageSlot(
    'A',
    sceneASlot,
    sceneAFileName,
    btnUploadSceneA,
    btnClearSceneA,
    inputSceneAImage
  );
  setupSceneImageSlot(
    'B',
    sceneBSlot,
    sceneBFileName,
    btnUploadSceneB,
    btnClearSceneB,
    inputSceneBImage
  );

  // カラーピッカー変更
  const updateColors = () => {
    stateStore.updateColors({
      primaryColor: primaryColorInput.value,
      secondaryColor: secondaryColorInput.value,
      accentColor: accentColorInput.value,
      borderColor: borderColorInput.value,
      glowColor: glowColorInput.value,
    });
    updateActiveColorThemeUI();
    engine.updateOptions(stateStore.getCurrentOptions());
  };

  primaryColorInput.addEventListener('input', updateColors);
  secondaryColorInput.addEventListener('input', updateColors);
  accentColorInput.addEventListener('input', updateColors);
  borderColorInput.addEventListener('input', updateColors);
  glowColorInput.addEventListener('input', updateColors);

  // ランダム配色 & 初期色リセット
  btnRandomColors.addEventListener('click', () => {
    applyColorPalette(generateRandomColorPalette(), null);
  });

  btnResetColors.addEventListener('click', () => {
    stateStore.resetColorsToPresetDefault();
    syncOptionsToUI();
    engine.updateOptions(stateStore.getCurrentOptions());
  });

  // ボーダー幅 & グロー
  inputBorderWidth.addEventListener('input', () => {
    const val = parseInt(inputBorderWidth.value, 10);
    valBorderWidth.textContent = `${val}px`;
    stateStore.updateOption('borderWidth', val);
    engine.updateOptions(stateStore.getCurrentOptions());
  });

  inputHasGlow.addEventListener('change', () => {
    stateStore.updateOption('hasGlow', inputHasGlow.checked);
    glowBlurControlGroup.style.display = inputHasGlow.checked ? 'flex' : 'none';
    engine.updateOptions(stateStore.getCurrentOptions());
  });

  inputGlowBlur.addEventListener('input', () => {
    const val = parseInt(inputGlowBlur.value, 10);
    valGlowBlur.textContent = `${val}px`;
    stateStore.updateOption('glowBlur', val);
    engine.updateOptions(stateStore.getCurrentOptions());
  });

  // 出力設定: 解像度 / FPS / デュレーション
  selectResolution.addEventListener('change', () => {
    const resKey = selectResolution.value as ResolutionPreset;
    const res = RESOLUTIONS[resKey];
    engine.resize(res.width, res.height);
    updateCanvasResBadge();
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
      stateStore.getCurrentPreset(),
      stateStore.getCurrentOptions(),
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

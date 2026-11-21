/**
 * 画像ファイルを読み込み HTMLImageElement として返す共通ヘルパー
 */
export function readImageFile(
  file: File,
  onLoad: (img: HTMLImageElement) => void,
  onInvalid?: () => void
): void {
  if (!file.type.startsWith('image/')) {
    onInvalid?.();
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}

/**
 * ドラッグ＆ドロップ領域の共通セットアップ
 */
export function setupDropZone(element: HTMLElement, onFileDrop: (file: File) => void): void {
  let dragDepth = 0;

  element.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    element.classList.add('drag-over');
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  element.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      element.classList.remove('drag-over');
    }
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    element.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      onFileDrop(files[0]);
    }
  });
}

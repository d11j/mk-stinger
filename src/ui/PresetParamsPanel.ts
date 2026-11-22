import {
  BooleanParamField,
  ImageParamField,
  ParamVisibilityCondition,
  PresetParamField,
  RangeParamField,
  SelectParamField,
} from '../types';
import { readImageFile, setupDropZone } from './fileHelpers';

export interface PresetParamsPanelCallbacks {
  onOptionChange: (key: string, value: any) => void;
  onToast: (message: string) => void;
}

interface FieldEntry {
  element: HTMLElement;
  visibleWhen?: ParamVisibilityCondition<Record<string, any>>;
}

function formatRangeValue(field: RangeParamField<any>, value: number): string {
  if (field.format === 'percent') {
    return `${Math.round(value * 100)}%`;
  }
  return `${value}${field.unit ?? ''}`;
}

/**
 * PresetPlugin.params スキーマから左パネル固有パラメータ UI を動的生成するコンポーネント
 */
export class PresetParamsPanel {
  private container: HTMLElement;
  private callbacks: PresetParamsPanelCallbacks;
  private currentOptions: Record<string, any> = {};
  private fieldEntries: FieldEntry[] = [];

  constructor(container: HTMLElement, callbacks: PresetParamsPanelCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(schema: PresetParamField[], options: Record<string, any>): void {
    this.container.innerHTML = '';
    this.currentOptions = options;
    this.fieldEntries = [];

    for (const field of schema) {
      const wrapper = document.createElement('div');
      wrapper.className = 'param-field';

      switch (field.type) {
        case 'range':
          this.buildRangeField(wrapper, field);
          break;
        case 'boolean':
          this.buildBooleanField(wrapper, field);
          break;
        case 'select':
          this.buildSelectField(wrapper, field);
          break;
        case 'image':
          this.buildImageField(wrapper, field);
          break;
      }

      this.container.appendChild(wrapper);
      this.fieldEntries.push({
        element: wrapper,
        visibleWhen: field.visibleWhen as ParamVisibilityCondition<Record<string, any>> | undefined,
      });
    }

    this.updateVisibility();
  }

  private buildRangeField(wrapper: HTMLElement, field: RangeParamField<any>): void {
    const rawVal = Number(this.currentOptions[field.key] ?? field.min);

    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = field.label;

    const valueEl = document.createElement('span');
    valueEl.className = 'control-value';
    valueEl.textContent = formatRangeValue(field, rawVal);

    row.appendChild(label);
    row.appendChild(valueEl);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'input-range';
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = String(field.step);
    input.value = String(rawVal);

    input.addEventListener('input', () => {
      const nextVal = Number(input.value);
      valueEl.textContent = formatRangeValue(field, nextVal);
      this.handleValueChange(field.key, nextVal);
    });

    wrapper.appendChild(row);
    wrapper.appendChild(input);
  }

  private buildBooleanField(wrapper: HTMLElement, field: BooleanParamField<any>): void {
    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = field.label;

    const checkboxLabel = document.createElement('label');
    checkboxLabel.className = 'param-checkbox-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(this.currentOptions[field.key]);

    const checkboxText = document.createElement('span');
    checkboxText.className = 'param-checkbox-text';
    checkboxText.textContent = field.checkboxLabel ?? '有効';

    checkbox.addEventListener('change', () => {
      this.handleValueChange(field.key, checkbox.checked);
    });

    checkboxLabel.appendChild(checkbox);
    checkboxLabel.appendChild(checkboxText);

    row.appendChild(label);
    row.appendChild(checkboxLabel);
    wrapper.appendChild(row);
  }

  private buildSelectField(wrapper: HTMLElement, field: SelectParamField<any>): void {
    const label = document.createElement('span');
    label.className = 'control-label param-select-label';
    label.textContent = field.label;

    const select = document.createElement('select');
    select.className = 'input-select';

    for (const opt of field.options) {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      select.appendChild(optionEl);
    }

    const currentVal = this.currentOptions[field.key];
    if (currentVal !== undefined && currentVal !== null) {
      select.value = String(currentVal);
    }

    select.addEventListener('change', () => {
      this.handleValueChange(field.key, select.value);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
  }

  private buildImageField(wrapper: HTMLElement, field: ImageParamField<any>): void {
    const uploadBox = document.createElement('div');
    uploadBox.className = 'custom-upload-box param-image-box';

    const headerRow = document.createElement('div');
    headerRow.className = 'param-image-header';

    const title = document.createElement('span');
    title.className = 'param-image-title';
    title.textContent = field.label;

    const uploadBtn = document.createElement('button');
    uploadBtn.type = 'button';
    uploadBtn.className = 'btn-secondary param-image-upload-btn';
    uploadBtn.textContent = '画像を選択';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = field.accept ?? 'image/*';
    fileInput.style.display = 'none';

    headerRow.appendChild(title);
    headerRow.appendChild(uploadBtn);
    headerRow.appendChild(fileInput);

    // 選択中画像のプレビューエリア
    const previewWrapper = document.createElement('div');
    previewWrapper.className = 'param-image-preview';

    const thumbBox = document.createElement('div');
    thumbBox.className = 'custom-image-thumb-box';

    const thumbImg = document.createElement('img');
    thumbImg.alt = 'preview';
    thumbBox.appendChild(thumbImg);

    const metaBox = document.createElement('div');
    metaBox.className = 'param-image-meta';

    const fileNameEl = document.createElement('div');
    fileNameEl.className = 'param-image-name';

    const dimEl = document.createElement('div');
    dimEl.className = 'param-image-dim';

    metaBox.appendChild(fileNameEl);
    metaBox.appendChild(dimEl);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn-icon param-image-clear-btn';
    clearBtn.title = '画像を解除';
    clearBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `;

    previewWrapper.appendChild(thumbBox);
    previewWrapper.appendChild(metaBox);
    previewWrapper.appendChild(clearBtn);

    const existingImg = this.currentOptions[field.key] as HTMLImageElement | null | undefined;
    if (existingImg) {
      previewWrapper.style.display = 'flex';
      thumbImg.src = existingImg.src;
      fileNameEl.textContent = existingImg.dataset.fileName || 'カスタム画像';
      dimEl.textContent = `${existingImg.naturalWidth}×${existingImg.naturalHeight}`;
    } else {
      previewWrapper.style.display = 'none';
    }

    const loadImage = (file: File) => {
      readImageFile(
        file,
        (img) => {
          img.dataset.fileName = file.name;
          previewWrapper.style.display = 'flex';
          thumbImg.src = img.src;
          fileNameEl.textContent = file.name;
          dimEl.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
          this.handleValueChange(field.key, img);
          this.callbacks.onToast(`画像「${file.name}」を読み込みました`);
        },
        () => {
          this.callbacks.onToast('画像ファイル（PNG / JPEG / WebP / SVG 等）を選択してください');
        }
      );
    };

    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        loadImage(files[0]);
      }
    });

    setupDropZone(uploadBox, loadImage);

    clearBtn.addEventListener('click', () => {
      fileInput.value = '';
      previewWrapper.style.display = 'none';
      this.handleValueChange(field.key, null);
      this.callbacks.onToast('カスタム画像を解除しました');
    });

    uploadBox.appendChild(headerRow);
    uploadBox.appendChild(previewWrapper);

    if (field.hint) {
      const hintEl = document.createElement('div');
      hintEl.className = 'param-image-hint';
      hintEl.textContent = field.hint;
      uploadBox.appendChild(hintEl);
    }

    wrapper.appendChild(uploadBox);
  }

  private handleValueChange(key: string, value: any): void {
    this.currentOptions[key] = value;
    this.callbacks.onOptionChange(key, value);
    this.updateVisibility();
  }

  private updateVisibility(): void {
    for (const entry of this.fieldEntries) {
      if (!entry.visibleWhen) {
        entry.element.style.display = 'flex';
        continue;
      }
      const isVisible = this.currentOptions[entry.visibleWhen.key] === entry.visibleWhen.equals;
      entry.element.style.display = isVisible ? 'flex' : 'none';
    }
  }
}

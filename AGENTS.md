# mk-stinger 開発者・エージェント向け技術ドキュメント (AGENTS.md)

本ドキュメントは、OBS向けスティンガートランジション動画ジェネレーター「**mk-stinger**」のシステム構成、実装上の重要決定事項、および開発中に直面したハマりポイント（落とし穴）と解決策をまとめたナレッジベースです。今後の機能拡張・リファクタリング・デバッグ時の指針として活用してください。

---

## 1. プロジェクト概要 & 技術スタック

* **目的**: ブラウザ完結（サーバーレス）で、OBS Studio 用の高品質スティンガートランジション動画（トラックマット WebM）を生成する。
* **主要技術**:
  * **ビルド / 言語**: TypeScript, Vite 6
  * **描画層**: HTML5 Canvas 2D API / OffscreenCanvas
  * **エンコード**: WebCodecs API (`VideoEncoder`, `VideoFrame`)
  * **多重化 (Muxing)**: `mediabunny` (VP9 with Alpha)
  * **UI**: Vanilla CSS (Cyber/Studio ダークテーマ), Lucide アイコン, `canvas-confetti`
  * **テスト / 品質管理**: Vitest (`@napi-rs/canvas`), ESLint, Prettier

---

## 2. コアアーキテクチャ & 設計パターン

### 2.1. 決定論的（Deterministic）アニメーションエンジン
* **原則**: `requestAnimationFrame` や実時間（`performance.now()` によるデルタタイム）に依存した描画は禁止。
* **実装方式**:
  * `render(progress, frameIndex, totalFrames, width, height, options)`
  * $progress \in [0.0, 1.0]$ を厳密に計算し、離散フレームごとに状態を一意に決定。
  * プレビュー再生時も、フレームインデックスを加算する離散ステップタイマーで動作させ、描画落ちやフレーム間隔のブレを排除。

### 2.2. トラックマットレイアウト (Side-by-Side: 3840×1080) の真の仕様
OBS のトラックマット仕様に準拠：
* **解像度**: 横幅が2倍（1080p出力時は **3840×1080**、720p出力時は **2560×720**）
* **左半分 (0〜1919px)**: **アニメーション実映像（背景透過・アルファチャンネル保持）**
  * オブジェクト（六角形など）が存在しない部分は完全透明（Alpha = 0）。
  * これにより、スティンガー動画の展開前・縮小消滅時に背後のシーン（Scene A / Scene B）が自然に透過露出する。
  * ※ 背景透過アルファチャンネルを保持するため、**出力フォーマットは WebM (VP9 with Alpha) に固定**。
* **右半分 (1920〜3839px)**: **トランジション進行マスク（Scene A → Scene B ワイプ）**
  * **黒（#000000）**: 移行前シーン（**From Scene / Scene A**）を表示
  * **白（#ffffff）**: 移行後シーン（**To Scene / Scene B**）を表示
  * **グレー（中間調）**: Scene A と Scene B のクロスフェード・半透明ブレンド
  * ※ アニメーション開始時は **全面黒** で、スティンガーの進行を経て、アニメーション終了時には **全面白** にならなければならない。
* **実装方式 (`TrackMatteRenderer.ts` & 必須 `PresetPlugin.renderMatte`)**:
  * `TrackMatteRenderer`: `outputCanvas` を `alpha: true` にし、合成前に `clearRect` で全体を透明初期化。
  * 左半分にアニメーションを背景透過のまま描画し、右半分に不透明な黒/白マスクを描画。
  * 全プリセットに `renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options)` の実装を必須化。
  * 六角形（HEX）が左から充填されていく波や斜めラインの通過に合わせて、通過領域を白（Scene B）で塗り広げる。
  * プレビューの「配信切替テスト」でも、このマスクキャンバスを `destination-in` 合成することで、OBS と 100% 同一のシーン切り替えをブラウザ上で完全シミュレート。
  * マスクのみでシーン切り替えが完結するため、移行ポイント（カットポイント）の自動算出や手動調整は廃止済み。

### 2.3. ファイル命名規則
* **形式**: `stinger_{presetId}_{resolutionKey}_{fps}fps.webm`
  * 例: `stinger_hex_1080p_60fps.webm`
* **特徴**:
  * トラックマット専用化により移行ポイントのフレーム数入力が不要となったため、プリセット・解像度・FPS が一目で分かるシンプルな命名に統一。

### 2.4. セッション内状態管理 & 設定 URL 共有 (`PresetStateStore.ts`, `urlShare.ts`)
* **プリセット別ドラフト・カラー引き継ぎ & 共通ロゴ状態 (`src/state/PresetStateStore.ts`)**:
  * 同一セッション内でプリセットごとの編集ドラフト（固有パラメータやアップロード済みカスタム画像など）をメモリ内に保持し、プリセット切替時に復元する。
  * ユーザーがカラー変更（個別色編集・テーマ適用・ランダム配色）を行った場合、切替先プリセットへも現在のカラーパレットを引き継ぐ。「初期色」リセットを実行すると引き継ぎが解除される。
  * 全プリセット共通の `logoOverlay`（ロゴ画像参照・アニメーション・サイズ・位置・表示タイミング・シャドウ設定）をプリセット横断で保持し、`updateLogoOverlay()` 内で開始/終了タイミングの逆転防止ガード（最小区間幅 `0.05`）を適用する。
* **設定 URL 共有・復元 (`src/state/urlShare.ts`)**:
  * `buildShareUrl()` で `preset` およびデフォルト値との差分パラメータのみを URL クエリ化（共通カラー、ディテール、プリセット固有 `p.<key>`、有効時のロゴオーバーレイ `logo` / `logo.*`、出力設定）。画像ファイル本体（`image` 型の固有パラメータや `logoOverlay.image`）は URL 共有対象外。
  * `parseShareUrl()` で未知キー・不正値を無視しつつ、スキーマおよび各設定の `min`/`max`/`step` に沿って安全にクランプ復元（`logo.start` / `logo.end` の逆転補正含む）する。復元後にカスタム画像フィールドまたはロゴオーバーレイが有効な場合は再選択案内を表示する。

### 2.5. カラーシステム & スキーマ駆動パラメータ UI (`colorThemes.ts`, `PresetParamsPanel.ts`)
* **カラー設定 (`src/ui/colorThemes.ts`)**:
  * `glowColor` は `borderColor` から独立して設定可能。8種の定番テーマプリセット（Tokyo Night, Dracula, Catppuccin, Nord, Synthwave, Gruvbox, Gaming Red, Monochrome）と、HSL ハーモニー理論に基づくランダム配色生成を提供。
* **スキーマ駆動 UI (`src/ui/PresetParamsPanel.ts`)**:
  * 各 `PresetPlugin.params`（`range` / `boolean` / `select` / `image` と `visibleWhen` 条件）から固有パラメータ UI を動的生成する。`image` フィールドはファイル選択およびドラッグ＆ドロップに対応。

### 2.6. ロゴ画像オーバーレイレイヤー (`LogoOverlayRenderer.ts`)
* **決定論的合成とプレビュー/書き出し一致**:
  * プレビュー側（`AnimationEngine.ts` の通常表示および `side_by_side` 左半分の `bufferCtx`）と書き出し側（`VideoExportPipeline.ts` の `animCtx`）の双方で、`preset.render(...)` の直後に `renderLogoOverlay(...)` を呼び出し、見た目とタイミングを完全一致させている。
  * トラックマットマスク側（`matte` モード、`side_by_side` 右半分、`TrackMatteRenderer` の `maskCtx`）には一切描画せず、シーン遷移マスクへ干渉させない。
* **境界非表示・解像度スケーリング・テスト互換**:
  * `computeLogoOverlayState()` で `progress <= startProgress` または `progress >= endProgress` のフレームを常に `visible: false` とし、`progress = 0.0 / 1.0` でのロゴ残留を防止。
  * ロゴサイズは画像のアスペクト比を維持して長辺を `height * scale` にフィットさせ、シャドウぼかし量は `shadowBlur * (height / 1080)` で解像度スケーリングする。
  * `renderLogoOverlay()` 内の画像寸法取得は `img.naturalWidth || img.width` フォールバックを持ち、ブラウザの `HTMLImageElement` と Vitest (`@napi-rs/canvas`) 上のオフスクリーン `Canvas` の双方でそのままテスト可能としている。

---

## 3. 実装のハマりポイントと解決策 (Gotchas & Solutions)

### 🚨 1. 【最重要仕様の落とし穴】トラックマットマスクは「アニメーションのアルファ」ではない！
* **勘違いしやすいポイント**:
  * 「右半分のマスク＝アニメーション自体の透過度（アルファ）」と誤解し、$(R=A, G=A, B=A)$ を出力してしまうこと。
* **なぜアルファそのままでは破綻するのか？**:
  * OBS のトラックマットにおいて、マスクの白は「次のシーン（Scene B）」、黒は「元のシーン（Scene A）」を意味する。
  * もしスティンガーのアルファ値をそのままマスクにすると：
    1. 六角形が出現すると、六角形の形にくり抜かれて Scene B が見える。
    2. 六角形が縮小消滅すると、マスクが黒に戻るため、**せっかく切り替わった Scene B が消えて元の Scene A に戻ってしまう（遷移がキャンセルされる）**。
* **正しいマスクの仕様**:
  * トランジションとは **「Scene A（黒）から Scene B（白）へと不可逆的に移り変わるもの」**。
  * **開始フレーム**: 全面黒（Scene A）
  * **進行フェーズ**:
    * **方式1（カットポイント切替型）**:
      アニメーションが全画面を完全不透明で覆い尽くしているカットポイント区間において、マスクを一気に黒から全面白（#ffffff）へ切り替える。
    * **方式2（シェイプ連動ワイプ型）**:
      六角形が左から画面を覆っていく波に追従し、六角形の内部・通過領域を黒から白へと塗り広げていく。六角形が縮小消滅する頃には背後が完全な白（Scene B）となって現れる。
  * **終了フレーム**: 全面白（Scene B）
* **対策方針**:
  * トラックマット生成器 (`TrackMatteRenderer.ts`) およびプリセット描画において、カラー映像とは別に「トランジションマスク（黒→白の進行）」を描画・合成するアーキテクチャとする。

---

### 🚨 2. WebCodecs H.264 の AVC Level と解像度（3840×1080）の上限エラー
* **発生したエラー**:
  ```
  VideoEncoder error: NotSupportedError: The provided resolution (3840x1080) has a coded area (3840*1088=4177920) which exceeds the maximum coded area (2228224) supported by the AVC level (4.2) indicated by the codec string (0x2A). You must either specify a lower resolution or higher AVC level.
  ```
* **原因**:
  * トラックマットは横並びのため 3840×1080（coded area: 4,177,920 サンプル）となり、4Kクラスの水平解像度になる。
  * H.264 の **Level 4.0 (`0x28`) や Level 4.2 (`0x2A`)** は最大 2,228,224 サンプルまでの制限があり、ブラウザのエンコーダが弾く。
* **解決策** (`src/encoder/VideoExportPipeline.ts`):
  * **H.264 Level 5.1 (`avc1.640033` / `avc1.4d0033`)** または **Level 5.2 (`avc1.640034`)** を指定する。
  * `resolveOptimalCodec()` メソッドを実装し、`VideoEncoder.isConfigSupported()` を用いてブラウザ/GPUがサポートする最適なコーデック（Level 5.1 / 5.2 等）を自動判定・選択するアーキテクチャにした。

---

### 🚨 3. インスタンス生成中のコールバック発火による TDZ (Temporal Dead Zone) エラー
* **発生したエラー**:
  ```
  ReferenceError: Cannot access 'engine' before initialization
  ```
* **原因**:
  * `const engine = new AnimationEngine(...)` のコンストラクタ実行中に初回フレーム描画 `renderCurrentFrame()` が走り、渡された `onFrameUpdate` コールバックが発火。
  * コールバック内で `engine.getFps()` のようにまだ代入完了していない `engine` 変数を参照したため TDZ エラーが発生した。
* **解決策**:
  * コンストラクタ中では外部コールバックを発火させないようガードフラグ `isInitialized` を導入。
  * インスタンス生成完了後に明示的に `engine.init(events)` を呼び出すライフサイクルに分離。
  * さらに `onFrameUpdate(frame, progress, totalFrames, fps)` のようにコールバック引数自体に `fps` を渡すことで、コールバック内での `engine` への過剰な依存を排除した。

---

### 🚨 4. WebCodecs における GPU メモリリーク
* **注意点**:
  * `new VideoFrame(canvas, { timestamp })` を生成した後、エンコードキューに渡したまま放置すると、GPU メモリ・RAM が即座に枯渇しブラウザがクラッシュする。
* **解決策**:
  ```ts
  const videoFrame = new VideoFrame(sourceCanvas, { timestamp, duration });
  try {
    videoEncoder.encode(videoFrame, { keyFrame });
  } finally {
    videoFrame.close(); // 必ずエンコード投入直後に解放する
  }
  ```

---

### 🚨 5. 六角形（HEX）アニメーションのシームレス充填とアンチエイリアスの隙間
* **仕様要件 (SPEC.md 7.1)**:
  * 六角形の高さは画面の高さの 1/3。画面左から充填し、充填完了時に画面遷移（完全不透明）して縮小消滅。
* **ハマりポイント**:
  * Canvas 2D で正六角形を幾何学的に敷き詰める際、浮動小数点の座標計算とアンチエイリアス処理により、隣接する六角形の境界に 0.5〜1px の透過隙間（Alpha < 255）が生じ、アルファ検出が 100% に到達しないことがある。
* **解決策**:
  * トランジション保持期間中（完全不透明区間）は各セルのスケールを微小に拡大（`scale = 1.035`）し、境界をわずかに重ね合わせることで、完全な $A = 255$ の密閉を実現した。

---

### 🚨 6. サンドボックス環境下での外部コマンド実行
* **注意点**:
  * Standard Sandbox Mode ではワークスペース外（`C:\Program Files\nodejs` 等）へのアクセスがブロックされ、`npm` や `node` が見つからないエラーになる。
* **解決策**:
  * パッケージのインストールやビルドなど Node.js バイナリを呼ぶコマンドでは `BypassSandbox: true` を明示する。

---

### 🚨 7. Chromium WebCodecs のアルファ未対応問題と mediabunny による突破
* **発生したエラー**:
  ```
  VideoEncoder error: NotSupportedError: Alpha encoding is not currently supported.
  ```
* **原因**:
  * Chromium（Chrome / Edge 等）のネイティブ `VideoEncoder` は、仕様上 `alpha: 'keep'` があるにもかかわらず、ブラウザ実装がアルファチャンネル付きのエンコードに未対応。直接 `alpha: 'keep'` を指定すると `NotSupportedError` を投げて強制終了する。
* **解決策**:
  * 重い外部 Wasm（`ffmpeg.wasm` 30MB〜）を導入する代わりに、Remotion 製の Web メディアライブラリ **`mediabunny`** を採用。
  * `mediabunny` の `CanvasSource(canvas, { codec: 'vp9', alpha: 'keep' })` は、Chromium の単一エンコーダ制約を回避するため、内部で **「カラー用エンコーダ」と「アルファ用エンコーダ」の2系統並列 `VideoEncoder`** を自動駆動し、WebM コンテナ（VP9 Alpha Side Data / BlockAdditions）として統合出力する。
  * これにより、外部巨大 Wasm のダウンロードや SharedArrayBuffer / COOP・COEP 制限を受けることなく、**ブラウザネイティブの高速ハードウェア支援を活かしたまま、本物の透過アルファ付き WebM の完全生成**を実現した。

---

### 🚨 8. 高頻度 UI 操作時のプレビュー再描画スロットリング
* **背景**:
  * かつて存在した全フレーム同期解析（`TransitionAnalyzer`）はトラックマット専用化に伴い廃止されたため、設定変更時のメインスレッド負荷は大幅に解消された。
* **現行の最適化**:
  * `AnimationEngine.requestRender()` で `requestAnimationFrame` によるスロットリングを行い、カラーピッカーやスライダーの高頻度 `input` イベントでも 1 フレーム（16.6ms）あたり最大 1 回の再描画に抑制している。

---

## 4. ディレクトリ構成

```
mk-stinger/
├── index.html                   // メインHTML（スタジオUI・タイムライン・OBS設定カード・モーダル）
├── package.json                 // 依存関係・テスト/Lint/Formatスクリプト（mediabunny, vitest 等）
├── tsconfig.json                // TS設定
├── vite.config.ts               // Vite設定（ビルド時の HTML 出力名を dist/mk-stinger.html へ変更）
├── vitest.config.ts             // Vitest設定
├── eslint.config.js             // ESLint設定
├── .prettierrc                  // Prettier設定
├── README.md                    // プロジェクト概要・起動方法・OBS設定・利用条件
├── SPEC.md                      // プロジェクト仕様書
├── AGENTS.md                    // 本ドキュメント（開発知見・ガイド）
└── src/
    ├── main.ts                  // UIコントローラ、イベントバインド、エクスポート実行
    ├── style.css                // Cyber/OBS風ダークテーマデザインシステム
    ├── types.ts                 // 型定義（PresetPlugin, ExportConfig 等）
    ├── engine/
    │   ├── AnimationEngine.ts   // 決定論的レンダリングエンジン & 離散再生コントローラ
    │   ├── LogoOverlayRenderer.ts // 全プリセット共通の決定論的ロゴ画像オーバーレイ描画
    │   ├── __tests__/           // ロゴオーバーレイ描画のユニットテスト
    │   ├── utils/
    │   │   ├── easing.ts        // 共通イージング関数ユーティリティ
    │   │   └── __tests__/       // イージングのユニットテスト
    │   └── presets/
    │       ├── index.ts         // プリセット一覧レジストリ
    │       ├── FadeAnimation.ts // シンプルフェード（クロスフェード / カラーフェード、ロゴ向け）
    │       ├── ShutterGateAnimation.ts // レイヤーシャッターゲート（ホールド＆衝突フラッシュ、既定プリセット）
    │       ├── HexAnimation.ts  // 必須要件のHEXハニカム充填
    │       ├── HyperJumpAnimation.ts // ハイパージャンプ（収縮リング＋中心フラッシュ展開）
    │       ├── LineWipeAnimation.ts // 斜めラインワイプ（トラックマット特化・非全面被覆型）
    │       ├── SpriteWipeAnimation.ts // デコレーションラインワイプ（1本線＋星/ハート/画像スプライト装飾）
    │       ├── GlitchAnimation.ts// サイバーグリッド
    │       ├── SlashAnimation.ts// 斜めスライス＆スピードライン
    │       └── __tests__/       // 全プリセットの境界フレーム・renderMatte検証テスト
    ├── state/
    │   ├── PresetStateStore.ts  // プリセット別ドラフト・カラー引き継ぎ & 共通ロゴ状態管理
    │   ├── urlShare.ts          // URL クエリ形式での設定共有・安全復元
    │   └── __tests__/           // 状態管理・URL共有のユニットテスト
    ├── ui/
    │   ├── PresetParamsPanel.ts // params スキーマ駆動の動的UI生成コンポーネント
    │   ├── colorThemes.ts       // カラーテーマプリセット & HSL ランダム配色生成
    │   ├── fileHelpers.ts       // 画像読み込み・ドラッグ＆ドロップ共通ヘルパー
    │   └── __tests__/           // カラーテーマ・ランダム配色のユニットテスト
    ├── renderer/
    │   ├── TrackMatteRenderer.ts// Side-by-Side (3840x1080) マスク高速合成
    │   └── __tests__/           // トラックマット合成のユニットテスト
    └── encoder/
        └── VideoExportPipeline.ts// WebCodecs + mediabunny によるトラックマット WebM 書き出し
```

---

## 5. 新規プリセット追加手順

新しいアニメーションを追加する場合は、`src/engine/presets/` に新規ファイルを作成し、`PresetPlugin<T>` を実装します。

1. **プラグイン定義**:
   ```ts
   import { PresetPlugin, BasePresetOptions } from '../../types';

   export interface MyPresetOptions extends BasePresetOptions {
     // 固有パラメータ
   }

   export const MyPresetPlugin: PresetPlugin<MyPresetOptions> = {
     id: 'my-preset',
     name: 'MY PRESET',
     category: 'カスタム',
     description: '...',
     defaultOptions: { ... },
     params: [
       // スキーマ定義（左パネルの UI が自動生成される）
       { key: 'myParam', type: 'range', label: 'パラメータ', min: 0, max: 100, step: 5, unit: 'px' },
     ],
     render(ctx, progress, frameIndex, totalFrames, width, height, options) {
       // progress: 0.0 -> 1.0 に基づいて背景透過アニメーションを決定論的に描画
     },
     renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options) {
       // progress: 0.0 (全面黒 = Scene A) -> 1.0 (全面白 = Scene B) の遷移マスクを描画
     }
   };
   ```
2. **レジストリ登録**:
   * `src/engine/presets/index.ts` の `ALL_PRESETS` 配列に追加するだけで、UIのカードや固有パラメータ設定UIに自動反映されます。`index.html` や `src/main.ts` の編集は不要です。

---

## 6. ブランチ命名規則

既存のブランチ形式に合わせ、`<type>/<kebab-case>`（Issue 紐づけ時は `<type>/<issue番号>-<kebab-case>`）を基本とします。

* 機能追加: `feature/<issue番号>-<kebab-case>`（例: `feature/5-output-license-terms`）
* バグ修正: `fix/<issue番号>-<kebab-case>`
* リファクタリング: `refactor/<issue番号>-<kebab-case>`
* ドキュメント更新: `docs/<kebab-case>`（Issue 紐づけ時は `docs/<issue番号>-<kebab-case>`）

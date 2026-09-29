# mk-stinger 開発者・エージェント向け技術ドキュメント (AGENTS.md)

本ドキュメントは、OBS向けスティンガートランジション動画ジェネレーター「**mk-stinger**」のシステム構成、実装上の重要決定事項、および開発中に直面したハマりポイント（落とし穴）と解決策をまとめたナレッジベースです。今後の機能拡張・リファクタリング・デバッグ時の指針として活用してください。

---

## 1. プロジェクト概要 & 技術スタック

* **目的**: ブラウザ完結（サーバーレス）で、OBS Studio 用の高品質スティンガートランジション動画（トラックマット MP4/WebM）を生成する。
* **主要技術**:
  * **ビルド / 言語**: TypeScript, Vite 6
  * **描画層**: HTML5 Canvas 2D API / OffscreenCanvas
  * **エンコード**: WebCodecs API (`VideoEncoder`, `VideoFrame`)
  * **多重化 (Muxing)**: `mp4-muxer` (H.264), `webm-muxer` (VP9)
  * **UI**: Vanilla CSS (Cyber/Studio ダークテーマ), Lucide アイコン, `canvas-confetti`

---

## 2. コアアーキテクチャ & 設計パターン

### 2.1. 決定論的（Deterministic）アニメーションエンジン
* **原則**: `requestAnimationFrame` や実時間（`performance.now()` によるデルタタイム）に依存した描画は禁止。
* **実装方式**:
  * `render(progress, frameIndex, totalFrames, width, height, options)`
  * $progress \in [0.0, 1.0]$ を厳密に計算し、離散フレームごとに状態を一意に決定。
  * プレビュー再生時も、フレームインデックスを加算する離散ステップタイマーで動作させ、描画落ちやフレーム間隔のブレを排除。

### 2.2. トランジションポイント（カットポイント）自動算出
* **アルゴリズム** (`src/engine/TransitionAnalyzer.ts`):
  1. 描画結果を 16:9 の縮小バッファ（64×36 ピクセル）へ `drawImage` 転写。
  2. `getImageData` でピクセル走査し、全ピクセルのアルファ値が $\ge 253$（完全不透明）となるフレーム区間 `[startFrame, endFrame]` を探索。
  3. ピークフレームを `transitionFrame = Math.floor((startFrame + endFrame) / 2)` として決定。
  4. ミリ秒変換: `transitionMs = Math.round((transitionFrame / fps) * 1000)`。
  5. UI のシークバー背景に不透明度波形（カバレッジグラフ）を描画し、視覚的な確認を可能にする。

### 2.3. トラックマットレイアウト (Side-by-Side: 3840×1080) の真の仕様
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
  * ※ アニメーション開始時は **全面黒** で、スティンガーの進行（またはカットポイント）を経て、アニメーション終了時には **全面白** にならなければならない。
* **実装方式 (`TrackMatteRenderer.ts` & `PresetPlugin.renderMatte`)**:
  * `TrackMatteRenderer`: `outputCanvas` を `alpha: true` にし、合成前に `clearRect` で全体を透明初期化。
  * 左半分にアニメーションを背景透過のまま描画し、右半分に不透明な黒/白マスクを描画。
  * 各プリセットに `renderMatte(ctx, progress, frameIndex, totalFrames, width, height, options, cutFrame)` を実装。
  * 六角形（HEX）が左から充填されていく波に合わせて、通過したセルを白（Scene B）で塗り広げる。
  * 完全充填後は全面白（#ffffff）を維持し、六角形が縮小消滅した際、背後から新しいシーン（Scene B）が綺麗に露出する。
  * プレビューの「配信切替テスト」でも、このマスクキャンバスを `destination-in` 合成することで、OBS と 100% 同一のシーン切り替えをブラウザ上で完全シミュレート。

### 2.4. ファイル命名規則（移行ポイント埋め込み親切設計）
* **形式**: `stinger_{presetId}_{resolutionKey}_{fps}fps_{cutFrame}f.webm`
  * 例: `stinger_hex_1080p_60fps_66f.webm`
* **メリット**:
  * OBS Studio でスティンガー設定を行う際、ユーザーが「何フレームで切り替えればいいか？」を一目で確認・入力できる。
  * UI の「OBS Studio 設定パラメータ」カードやクリップボードコピー機能とも完全に連携。

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

### 🚨 8. 色・設定変更時の全フレーム同期解析によるUI極大ラグと最適化
* **発生した現象**:
  * カラーピッカーで色を変更したりスライダーを動かした際、UIが極端に重くなりフリーズする。
* **原因**:
  * `updateOptions()` 内で、設定が変更されるたびに `recalculateTransition()`（全フレーム＝例えば60fps×2秒なら120フレームの描画＋ピクセル走査）がメインスレッドで同期実行されていた。
  * カラーピッカーのドラッグやスライダー操作では1秒間に数十回〜数百回の `input` イベントが発生するため、数千フレーム分のキャンバス描画とピクセル走査が重なりUIがブロックされていた。
* **解決策**:
  1. **色プロパティのスキップ判定**:
     * `primaryColor` や `borderColor` などの色は、物体の幾何学形状やアルファカバレッジ（不透明度・カットポイント）に一切影響しない。
     * 色のみの変更時は `recalculateTransition()` を完全にスキップし、現在の1フレームのみ再描画することで処理負荷を 99.9% 削減。
  2. **ジオメトリ・スライダーのデバウンス解析**:
     * 形状やタイミングに関わるスライダー操作（`staggerDelay` 等）の際は、プレビュー画面は即時反映しつつ、重い全フレーム解析はデバウンス（150ms）して操作停止時に1回だけ実行する。
  3. **`requestAnimationFrame` によるプレビュー描画のスロットリング**:
     * `renderCurrentFrame()` を rAF で束ね、高頻度イベントでも1フレーム（16.6ms）あたり最大1回の描画に抑制。

---

## 4. ディレクトリ構成

```
mk-stinger/
├── index.html                   // メインHTML（スタジオUI・タイムライン・OBS設定カード・モーダル）
├── package.json                 // 依存関係（mp4-muxer, webm-muxer, lucide, canvas-confetti）
├── tsconfig.json                // TS設定
├── vite.config.ts               // Vite設定
├── SPEC.md                      // プロジェクト仕様書
├── AGENTS.md                    // 本ドキュメント（開発知見・ガイド）
└── src/
    ├── main.ts                  // UIコントローラ、イベントバインド、エクスポート実行
    ├── style.css                // Cyber/OBS風ダークテーマデザインシステム
    ├── types.ts                 // 型定義（PresetPlugin, ExportConfig, TransitionAnalysis 等）
    ├── engine/
    │   ├── AnimationEngine.ts   // 決定論的レンダリングエンジン & 離散再生コントローラ
    │   ├── TransitionAnalyzer.ts// トランジションポイント・カバレッジ自動解析
    │   └── presets/
    │       ├── index.ts         // プリセット一覧レジストリ
    │       ├── HexAnimation.ts  // 必須要件のHEXハニカム充填
    │       ├── LineWipeAnimation.ts // 斜めラインワイプ（トラックマット特化・非全面被覆型）
    │       ├── SpriteWipeAnimation.ts // デコレーションラインワイプ（1本線＋星/ハート/画像スプライト装飾）
    │       ├── SlashAnimation.ts// 斜めスライス＆スピードライン
    │       ├── IrisAnimation.ts // メカニカルサークルアイリス
    │       └── GlitchAnimation.ts// サイバーグリッド
    ├── renderer/
    │   └── TrackMatteRenderer.ts// Side-by-Side (3840x1080) マスク高速合成
    └── encoder/
        └── VideoExportPipeline.ts// WebCodecs + Muxer 最適コーデック解決＆書き出し
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
     render(ctx, progress, frameIndex, totalFrames, width, height, options) {
       // progress: 0.0 -> 1.0 に基づいて決定論的に描画
       // ※ progress 0.46〜0.54 付近で全画面を完全不透明で覆うこと
     }
   };
   ```
2. **レジストリ登録**:
   * `src/engine/presets/index.ts` の `ALL_PRESETS` 配列に追加するだけで、UIのカードや選択肢に自動反映されます。

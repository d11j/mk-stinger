# mk-stinger 🎬

インストール不要・ブラウザ完結でOBS Studio用の高品質スティンガートランジション動画を生成するWebツール

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646CFF.svg)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 📌 アプリの概要

**mk-stinger** は、OBS Studio などの配信ソフトで使用できる **スティンガートランジション動画（トラックマット WebM）** を、インストール不要・ブラウザ完結でリアルタイムに作成・出力できるジェネレーターです。

従来の動画編集ソフトを使わずとも、幾何学アニメーションやサイバー調のスティンガーをパラメータ調整しながら作成でき、OBS設定に必要な「移行ポイント（カットポイントのフレーム数・ミリ秒）」を自動算出します。

### ✨ 主な特徴

- ⚡ **インストール不要＆ブラウザ完結**: 動画のアップロードや外部サーバー処理は一切不要。PCのブラウザ（WebCodecs API）で高速にエンコードして直接ダウンロードできます。
- 📐 **OBSトラックマット完全準拠 (Side-by-Side)**:
  - 3840×1080 (1080p) / 2560×720 (720p) の横並びトラックマット動画を出力。
  - 左半分にアルファ透過アニメーション映像、右半分にシーン切替マスク（黒: Scene A → 白: Scene B）を合成。
  - 背景透過（アルファ）対応のWebM形式で出力されます。
- 🎯 **移行ポイント（カットポイント）自動算出**:
  - アニメーションが画面を覆う瞬間を自動解析し、OBSに入力すべき「移行フレーム数（f）」および「移行時間（ms）」を即座に提示。
  - 出力ファイル名にも自動でフレーム数が埋め込まれます（例: `stinger_hex_1080p_60fps_66f.webm`）。
- 🎨 **豊富な組み込みプリセット**:
  - **HEX**: 画面左から六角形が充填され、収縮消滅するハニカムトランジション
  - **Line Wipe**: 斜めラインが重なり合いながら画面を横断するワイプトランジション
  - **Decorated Line**: 星やハートなどのスプライトがラインに沿って舞うデコレーションワイプ
  - **Slash**: スピード感ある複数の鋭角スライスブレード
  - **Iris**: 幾何学リングとメカニカルな絞りアイリス
  - **Glitch**: サイバーグリッドとデジタルグリッチノイズ
- 🎮 **配信切替シミュレーター**:
  - プレビュー上で「Scene A → Scene B」の実際の切り替え動作をリアルタイムに確認可能。
  - コマ送り・シークバー・不透明度カバレッジ波形の可視化に対応。

---

## 🚀 起動方法

### 前提要件
- **Node.js**: v18.0.0 以上
- **ブラウザ**: WebCodecs API に対応したモダンブラウザ（Google Chrome, Microsoft Edge など Chromium 系を推奨）

### 手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/d11j/mk-stinger.git
   cd mk-stinger
   ```

2. **依存パッケージのインストール**
   ```bash
   npm install
   ```

3. **開発サーバーの起動**
   ```bash
   npm run dev
   ```
   起動後、ターミナルに表示されるローカルURL（通常は `http://localhost:5173`）をブラウザで開きます。

### その他のコマンド

- **プロダクションビルド**:
  ```bash
  npm run build
  ```
- **ビルド成果物のローカルプレビュー**:
  ```bash
  npm run preview
  ```

---

## 🎥 OBS Studio での設定手順

mk-stinger でエクスポートした動画は、以下の手順で OBS Studio に登録できます。

1. OBS Studio の「**シーントランジション**」ドックを開き、追加（`+`）から「**スティンガー**」を選択。
2. 「**動画ファイル**」で出力したファイル（`.webm`）を選択。
3. 「**移行ポイント種別**」を **フレーム**（または 時間(ミリ秒)）に設定。
4. 「**移行ポイント**」に、mk-stinger の画面またはファイル名に記載された数値を入力（例: `66`）。
5. トラックマット動画を使用する場合：
   - 「**トラックマットを使用する**」にチェックを入れる。
   - 「**マットレイアウト**」を **横並び（左: 映像、右: マスク）** に設定。
6. 「**OK**」を押して設定完了です。

---

## 🛠️ 技術スタック

| 分類 | 使用技術 |
| :--- | :--- |
| **開発環境 / 言語** | TypeScript, Vite 6 |
| **レンダリング** | HTML5 Canvas 2D API, OffscreenCanvas |
| **エンコード** | WebCodecs API (`VideoEncoder`, `VideoFrame`) |
| **コンテナ化 (Muxing)** | `mediabunny` (VP9 with Alpha) |
| **UI / アイコン** | Vanilla CSS (Cyber Studio Theme), Lucide Icons, Canvas Confetti |

---

## 📚 開発ドキュメント

より詳細なシステムアーキテクチャや設計思想、実装上の知見については以下を参照してください。

- [SPEC.md](./SPEC.md) - プロジェクト仕様書
- [AGENTS.md](./AGENTS.md) - アーキテクチャ詳細、トラックマット仕様、実装上のハマりポイント・知見集

---

## 📄 ライセンス

[MIT License](./LICENSE)

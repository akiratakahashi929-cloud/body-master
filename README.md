# BODY MASTER v2 🏋️
**体型管理 & 筋トレ DX ツール**

日々のカレンダー・体重・身長・トレーニングの進捗を一元管理するWebアプリです。

## 機能
- 📅 **カレンダー進捗管理** — 毎日の記録をカレンダー表示
- ⚖️ **体重・腹囲トラッキング** — グラフで進捗を可視化
- 🍚 **カロリー管理** — 摂取カロリー・必要カロリーを自動計算
- 💪 **トレーニングログ** — 種目・セット・重量・ボリュームを記録
- 📊 **Google スプレッドシート連携** — GAS (Google Apps Script) でデータ保存

## フォルダ構成
```
body-master/
├── index.html      # メインHTML
├── style.css       # スタイルシート
├── app.js          # アプリロジック
├── gas_code.gs     # Google Apps Script コード
└── .gitignore
```

## Google Apps Script セットアップ
1. [Google スプレッドシート](https://docs.google.com/spreadsheets/d/1tlMgu_eg_5zbk0hpKbui6M4BTgVjjP317cLDbfxyu4I/edit) を開く
2. 「拡張機能」→「Apps Script」→ `gas_code.gs` の内容をコピー
3. 「デプロイ」→「新しいデプロイ」→ ウェブアプリとして公開
4. アプリのGAS URLを設定

## スプレッドシート
- **日次データ**: 体重・腹囲・カロリー・トレーニング記録
- **トレーニング**: 種目別セット詳細・ボリューム
- **プロフィール**: 身長・年齢・活動レベル・目標設定

## 開発環境
- HTML5 + Vanilla JavaScript + CSS
- バックエンド: Google Apps Script (GAS)
- データ保存: Google スプレッドシート

---
*管理者: akira.takahashi929@gmail.com*

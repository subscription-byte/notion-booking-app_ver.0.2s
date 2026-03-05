# 予約システム - Googleカレンダー連携予約アプリ

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 概要

Google Calendar APIと連携したモバイルファースト対応の予約システムです。URLパスで営業者を識別し、自動でGoogleカレンダーに予約データを登録・管理できます。

**重要: このバージョンはGoogleカレンダー連携版です。Notion連携版は元のリポジトリ（booking-app）を参照してください。**

## 開発者向けドキュメント

- [Google Calendar API リファレンス](docs/google-calendar-api.md) - カレンダー色ID、API仕様、データ構造
- [変更履歴](CHANGELOG.md) - 詳細な変更履歴

## 最新の変更履歴

詳細は [CHANGELOG.md](CHANGELOG.md) を参照してください。

### 直近の主な変更

### 2026年3月5日
- **ドキュメント整備**: Google Calendar APIリファレンスを作成
  - docs/google-calendar-api.md を新規作成
  - カレンダー色ID一覧（正確な情報）
  - イベント構造、API仕様、データ構造を記載
  - Claude Code等の開発ツールが正確な情報を参照できるように整備

- **機能追加**: 予約元を一覧で識別できるように場所情報と色分けを追加
  - 通常リンク: 場所「X DM」、colorId '2'（セージ色・緑）
  - PersonA（LINE連携）: 場所「公式LINE（公認）」、colorId '11'（トマト色・赤）
  - Googleカレンダーの一覧表示で予約元が一目で分かるように改善

- **セキュリティ**: 検索エンジン・AI学習クローラーのアクセスを拒否
  - robots.txt: 全クローラー + AI/LLMクローラーを明示的に拒否
  - index.html: noindex/nofollowメタタグを追加
  - 直リンクでのアクセスは引き続き可能
  - Google検索結果に表示されず、AI学習データとして収集されない

### 2026年2月14日〜3月4日 - Google Calendar API移行作業
- **重要**: Notion APIからGoogle Calendar APIへの完全移行を実施
  - フロントエンドのAPIリクエストを全てGoogle Calendar形式に変更
  - バックエンド関数（line-callback, scheduled-reminder）をGoogle Calendar APIに移行
  - セッションID検索を2099年データから取得する方式に変更
  - 日付フォーマットをISO 8601形式（JST）に統一

- **バグ修正**: LINE予約の動作を修正
  - セッション方式の予約作成フローを修正
  - 戻るボタンで確認画面状態を正しくリセット
  - 日付フォーマットを統一してタイムゾーンのズレを解消

- **UX改善**: デバッグ機能の追加と削除
  - 画面左上に状態表示を追加（開発時）
  - 予約エラーをアラート表示
  - PWAインストールプロンプトを無効化
  - デバッグ情報はテストモード時のみ表示

### 2026年2月13日
- **機能追加**: 通常リンク・personBでXリンク/IDのバリデーション実装
  - X（x.com/twitter.com）のリンクまたは@で始まるIDのみ入力可能に
  - myfans.jp等のリンクは明示的に拒否
  - エラーメッセージで分かりやすく案内
- **UX改善**: 名前欄に注意書きを追加
  - 全画面で「X上でのお名前をご入力ください」と表示
  - プレースホルダーも「X上でのお名前を入力」に統一

### それ以前の変更

[CHANGELOG.md](CHANGELOG.md) を参照してください。

## 主な機能

### 📅 予約管理
- 平日のみ予約可能（祝日を自動除外）
- 1時間単位の時間枠管理
- リアルタイムで予約状況を表示
- 固定ブロック時間設定（火曜11:00-16:00など）
- 対面通話・撮影の前後ブロック機能

### 🏷️ 営業経路タグ付け
- URLパスで営業者を識別
- Notionの「経路」列（select型）に自動タグ付け
- 同じコードベースで複数の営業経路に対応

**アクセスURL**:
- 通常: `https://mfagencybooking.netlify.app/` → タグなし
- PersonA: `https://mfagencybooking.netlify.app/personA` → 「公認X」タグ
- PersonB: `https://mfagencybooking.netlify.app/personB` → 「まゆ紹介」タグ

### 📱 レスポンシブUI
- モバイルファースト設計
- ガラスモーフィズムデザイン
- Fluid背景アニメーション
- タッチ操作最適化

### 🔔 エラー検知・通知
- システムエラー検知
- 日付ズレ検知
- ChatWork通知連携
- データ検証機能

### 📤 予約情報共有
- LINE・X（Twitter）共有ボタン
- ワンタップコピー機能
- 予約完了画面から直接共有可能

### 🔐 LINE連携機能（実装済み）
- LINE Login OAuth 2.0 認証
- プロフィール情報の自動取得
- 予約完了時のLINE通知送信
- NotionへのLINE User ID保存

### 🧪 テストモード
- 隠しテストモード（ヘッダー3回タップ）
- ID/PW認証でアクセス制限
- 本番環境で開発機能をテスト可能

## 技術スタック

### フロントエンド
- **React** 19.1.0
- **Tailwind CSS** 3.4.17
- **Lucide React** (アイコン)
- **Create React App** 5.0.1

### バックエンド（Netlify Functions）
- **Notion API** (データベース操作)
- **ChatWork API** (通知機能)
- **LINE Messaging API** (通知送信)
- **LINE Login API** (OAuth認証)
- Serverless Functions

### ホスティング
- **Netlify**
- リダイレクト機能でURLパス管理

## プロジェクト構成

```
booking-app/
├── src/
│   ├── components/
│   │   ├── EnhancedNotionBooking.jsx  # メイン予約コンポーネント
│   │   ├── FluidCanvas.jsx            # 背景アニメーション
│   │   └── FluidBackground.jsx        # 背景ラッパー
│   ├── App.js                          # アプリエントリーポイント
│   └── index.js
├── netlify/
│   └── functions/
│       ├── notion-create.js            # Notion予約作成API
│       ├── notion-query.js             # Notionデータ取得API
│       ├── notion-archive.js           # Notion予定削除API
│       ├── chatwork-notify.js          # ChatWork通知API
│       ├── line-callback.js            # LINE OAuth コールバック
│       └── line-notify.js              # LINE通知送信API
├── netlify.toml                         # Netlify ビルド設定
├── public/
│   └── _redirects                      # Netlifyリダイレクト設定
└── package.json
```

## 環境変数

`.env.local` に以下を設定:

```
# Notion API
NOTION_TOKEN=your_notion_integration_token

# ChatWork API
CHATWORK_API_TOKEN=your_chatwork_api_token
CHATWORK_ROOM_ID=your_chatwork_room_id

# LINE Messaging API（通知用）
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token

# LINE Login（OAuth認証用）
LINE_CHANNEL_ID=your_line_login_channel_id
LINE_CHANNEL_SECRET=your_line_login_channel_secret

# React アプリ用（フロントエンド）
REACT_APP_LINE_CHANNEL_ID=your_line_login_channel_id
REACT_APP_TEST_USER_ID=your_test_user_id
REACT_APP_TEST_USER_PW=your_test_user_password
```

**注意**: Netlifyの環境変数設定に加えて、`netlify.toml` の `[build.environment]` にも `REACT_APP_LINE_CHANNEL_ID` を設定する必要があります。

## Notion データベース構造

**必須プロパティ**:
- `名前` (title) - 予約者名
- `予定日` (date) - 予約日時
- `X` (url) - Xまたはmyfansリンク
- `備考` (rich_text) - 備考
- `経路` (select) - 営業経路タグ
- `対応者` (people) - 担当者
- `通話方法` (select) - 対面/撮影などの区分
- `LINE User ID` (text) - LINE連携時のユーザーID
- `myfans登録状況` (select) - myfans登録状況（登録済/未登録）
- `P登録状況` (select) - プレミアムクリエイター登録状況（登録済/未登録）

## 予約ロジック

### ブロック時間ルール
1. **火曜日**: 11:00-16:00 常にブロック
2. **水曜日**: 13:00のみブロック
3. **全日（火曜以外）**: 15:00-16:00ブロック
4. **対面通話**: 前後3時間ブロック
5. **撮影**: 当日すべて + 後3時間ブロック

### 祝日管理
2025年の祝日データをハードコーディング（[EnhancedNotionBooking.jsx](src/components/EnhancedNotionBooking.jsx):51-56）

---

## LINE連携の設定手順

### 1. LINE Developersコンソールで2つのチャネルを作成

#### LINE Messaging API チャネル（通知用）
1. プロバイダーを選択 → 新規チャネル作成 → **Messaging API**
2. チャネル基本設定から以下を取得：
   - **Channel Access Token** → `LINE_CHANNEL_ACCESS_TOKEN`

#### LINE Login チャネル（認証用）
1. プロバイダーを選択 → 新規チャネル作成 → **LINE Login**
2. チャネル基本設定から以下を取得：
   - **Channel ID** → `LINE_CHANNEL_ID` / `REACT_APP_LINE_CHANNEL_ID`
   - **Channel Secret** → `LINE_CHANNEL_SECRET`
3. LINE Login設定：
   - **コールバックURL**: `https://mfagencybooking.netlify.app/.netlify/functions/line-callback`
   - **OpenID Connect**: 有効化
   - **公開設定**: 開発中（テスターを追加）または公開済み

### 2. Netlifyに環境変数を設定
- Site settings → Environment variables → Add a variable
- 上記で取得した値を設定

### 3. netlify.toml に環境変数を追加
```toml
[build.environment]
  REACT_APP_LINE_CHANNEL_ID = "your_line_channel_id"
```

### 4. Notionデータベースに列を追加
- 列名: `LINE User ID`
- 型: テキスト

---

## 今後の追加予定機能

### ⏰ 予約リマインド機能
- 予約日前日の通知
- 予約日当日15分前の通知
- Notion定期スクリーニング + LINE通知

**実装方法**:
- **GitHub Actions**（推奨・無料）
  - 毎日定期実行でNotionをチェック
  - 該当予約にLINE通知送信
- **Netlify Scheduled Functions**（有料プラン必要）
- **外部サービス**（Zapier/Make.com）

**影響範囲**:
- 新規ファイル: `.github/workflows/reminder.yml`
- 新規スクリプト: `scripts/send-reminder.js`
- 既存コードへの影響: **なし**（完全独立システム）

### 💰 コスト概算
- LINE Messaging API: 無料枠あり（月1000通まで）
- GitHub Actions: 完全無料
- Netlify Scheduled Functions: 有料プラン（月$19〜）※使用しない場合

---

## デプロイ方法

### Netlify自動デプロイ（推奨）

このプロジェクトはGitHub連携で自動デプロイされます。

**手順:**
1. 変更をコミット
   ```bash
   git add .
   git commit -m "変更内容"
   ```
2. GitHubにプッシュ
   ```bash
   git push
   ```
3. Netlifyが自動的にビルド＆デプロイを開始

**デプロイ状況確認:**
- ダッシュボード: https://app.netlify.com/sites/mfagencybooking/deploys
- 本番URL: https://mfagencybooking.netlify.app

**所要時間:** 約2〜3分

### 手動デプロイ（非推奨）

緊急時のみ使用：
```bash
npm run build
npx netlify deploy --prod --dir=build --site=6bdba099-821f-44be-80eb-3782e6917a0b
```

---

## 開発の基本フロー

### ローカル開発環境の起動
```bash
npm start
```
→ http://localhost:3000 で開発サーバーが起動

### 本番ビルドのテスト
```bash
npm run build
```
→ `build/`フォルダに本番用ファイルが生成

### 変更を本番に反映
```bash
git add .
git commit -m "変更内容"
git push
```
→ Netlifyが自動デプロイ

---

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

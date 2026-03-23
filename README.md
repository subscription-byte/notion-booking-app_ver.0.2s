# 予約システム - Googleカレンダー連携予約アプリ

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 概要

Google Calendar APIと連携したモバイルファースト対応の予約システムです。URLパスで営業者を識別し、自動でGoogleカレンダーに予約データを登録・管理できます。

**重要: このバージョンはGoogleカレンダー連携版です。Notion連携版は元のリポジトリ（booking-app）を参照してください。**

## 最新アップデート（2026-03-23）

- 冒頭注意事項を初期フォーム画面に常時表示（対応時間・連絡必須・キャンセルポリシー）
- 予約完了後モーダル追加・自動リダイレクトタイマー廃止（手動ボタンに変更）
- 完了モーダルのX遷移ボタンにコピー完了フィードバック追加（押下後1.5秒で遷移）
- 作業方針: ビジュアル変更はローカル確認優先、外部API連携はデプロイ優先（`docs/claude-code-instructions.md` に記載）
- 詳細は [変更履歴](CHANGELOG.md) を参照

## 開発者向けドキュメント

- [Google Calendar API リファレンス](docs/google-calendar-api.md) - カレンダー色ID、API仕様、データ構造
- [変更履歴](CHANGELOG.md) - プロジェクトの変更履歴
- [セットアップガイド](docs/setup-guide.md) - 環境構築手順
- [移行アップデート](docs/migration-updates.md) - Notion→Googleカレンダー移行の記録
- [社内引き継ぎ手順](docs/handover.md) - 引き継ぎドキュメント
- [Claude Code 使用方法](docs/claude-code-instructions.md) - Claude Code開発時の注意事項

## 主な機能

### 📅 予約管理
- 平日のみ予約可能（祝日を自動除外）
- 1時間単位の時間枠管理
- リアルタイムで予約状況を表示
- 固定ブロック時間設定（火曜11:00-16:00など）
- 対面通話・撮影の前後ブロック機能

### 🏷️ 営業経路タグ付け
- URLパスで営業者を識別
- Googleカレンダーイベントの `extendedProperties.private.route` に経路タグを保存
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

### 🔔 通知機能
- 予約完了時にChatWork専用ルームへ自動通知（`CHATWORK_BOOKING_ROOM_ID`）
  - 通常予約: 日付・氏名・Xリンク・備考・経路・myfans/P登録状況を通知
  - LINE連携予約: サーバーサイドから直接ChatWork APIを呼び出し
- システムエラー・日付ズレ検知時もChatWork通知（`CHATWORK_ROOM_ID`、別ルーム）
- データ検証機能

### 📤 予約情報共有
- LINE・X（Twitter）共有ボタン
- ワンタップコピー機能
- 予約完了画面から直接共有可能

### 🔐 LINE連携機能（実装済み）
- LINE Login OAuth 2.0 認証（PersonA: `line-callback.js` / PersonC: `line-callback-c.js`）
- プロフィール情報の自動取得
- 予約完了時のLINE通知送信（チャネル別トークンで正しい公式アカウントから送信）
- 前日リマインド時にGoogle MeetリンクをLINEへ自動付与
- Googleカレンダーの `extendedProperties.private` に `lineUserId` / `lineChannel` を保存
- 複数LINE公式アカウント対応: `lineChannel` フィールドでチャネルを識別

**Netlify環境変数（PersonC追加時）:**
- `LINE_CHANNEL_ID_C` / `LINE_CHANNEL_SECRET_C` / `LINE_CHANNEL_ACCESS_TOKEN_C`
- コールバックURL: `https://mfagencybooking.netlify.app/.netlify/functions/line-callback-c`

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
- **Google Calendar API** (予約データ操作)
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
│   │   ├── CalendarBooking.jsx        # メイン予約コンポーネント
│   │   ├── FluidCanvas.jsx            # 背景アニメーション
│   │   └── FluidBackground.jsx        # 背景ラッパー
│   ├── App.js                          # アプリエントリーポイント
│   └── index.js
├── netlify/
│   └── functions/
│       ├── google-calendar-create.js   # Googleカレンダー予約作成API
│       ├── google-calendar-query.js    # Googleカレンダーデータ取得API
│       ├── google-calendar-delete.js   # Googleカレンダー予定削除API
│       ├── chatwork-notify.js          # ChatWork通知API
│       ├── line-callback.js            # LINE OAuth コールバック
│       ├── line-notify.js              # LINE通知送信API
│       └── scheduled-reminder.js       # 定期リマインド送信
├── netlify.toml                         # Netlify ビルド設定
├── public/
│   └── _redirects                      # Netlifyリダイレクト設定
└── package.json
```

## 環境変数

`.env.local` に以下を設定:

```
# Google Calendar API
GOOGLE_CALENDAR_ID=your_google_calendar_id
GOOGLE_SERVICE_ACCOUNT_KEY=your_service_account_json

# ChatWork API
CHATWORK_API_TOKEN=your_chatwork_api_token
CHATWORK_ROOM_ID=your_chatwork_room_id
CHATWORK_BOOKING_ROOM_ID=your_chatwork_booking_room_id

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

## Googleカレンダー イベントデータ構造

予約情報は Google カレンダーイベントとして保存され、主な値は `extendedProperties.private` で管理します。

**主な保存キー**:
- `route` - 営業経路タグ
- `callMethod` - 通話方法（対面/撮影/公式LINE など）
- `lineUserId` - LINE連携時のユーザーID
- `myfansStatus` - myfans登録状況（登録済/未登録）
- `premiumStatus` - プレミアムクリエイター登録状況（登録済/未登録）
- `bookingStatus` - 予約状態（予約完了/仮登録）
- `sessionId` - LINE連携予約のセッション識別子

## 予約ロジック

### ブロック時間ルール
1. **火曜日**: 11:00-16:00 常にブロック
2. **水曜日**: 13:00のみブロック
3. **全日（火曜以外）**: 15:00-16:00ブロック
4. **対面通話**: 前後3時間ブロック
5. **撮影**: 当日すべて + 後3時間ブロック
6. **Googleカレンダー色ID判定（機能色）**:
   - `7`（ピーコック）= 通常予約（X DM経由）
   - `2`（セージ）= PersonC LINE連携予約
   - `11`（トマト）= PersonA LINE連携予約
   - `1`（ラベンダー）= 対面ブロック扱い（手動設定時）
   - `3`（ブドウ）= 撮影ブロック扱い（手動設定時）

### 祝日管理
`src/config/data/holidays.json` で管理（2026年分まで反映済み）

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

### 4. Googleカレンダー側の設定
- 予約データは Googleカレンダーの `extendedProperties.private` に保存されるため、Notionの列追加は不要

---

## 今後の追加予定機能

### ⏰ 予約リマインド機能
- 予約日前日の通知（実装済み）
- 予約日当日15分前の通知（現在停止中）
- Googleカレンダー定期スクリーニング + LINE通知

**実装方法**:
- **GitHub Actions**（推奨・無料）
  - 毎日定期実行でGoogleカレンダーをチェック
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

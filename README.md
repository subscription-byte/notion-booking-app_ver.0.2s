# 予約システム - Notion連携予約アプリ

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 概要

Notion APIと連携したモバイルファースト対応の予約システムです。URLパスで営業者を識別し、自動でNotionに予約データを登録・管理できます。

## 最新の変更履歴

### 2025年12月2日
- **機能追加**: LINE連携機能を実装（OAuth 2.0認証）
  - LINE Loginチャネルを使用したユーザー認証
  - LINEプロフィール情報（User ID、表示名）の自動取得
  - 予約完了時にLINE通知を自動送信（LINE Messaging API）
  - Notionデータベースに「LINE User ID」列を追加
- **機能追加**: テストモード実装
  - ヘッダー3回タップ + ID/PW認証で入室
  - テストモード専用機能（LINE通知テストボタン）を追加
  - 認証情報を環境変数化してセキュリティ強化
- **セキュリティ強化**: Netlify Functions全般
  - Notion API呼び出しにデータベースID検証を追加
  - ChatWork通知APIに型ホワイトリスト・フィールド検証を追加
  - データ削除時の所有権検証を追加
- **トラブルシューティング**: 環境変数の埋め込み問題を解決
  - `netlify.toml` に `[build.environment]` を追加して環境変数を明示的に設定
  - React アプリの本番ビルドで `REACT_APP_LINE_CHANNEL_ID` が正しく埋め込まれるように修正

### 2025年12月1日
- **重要**: 予約終了時刻の判定ロジックを修正（11月20日の変更で導入されたバグを修正）
  - 予約が13:00に終わる場合、13:00-14:00の枠が正しく予約可能に
  - 12月の予約枠が誤ってブロックされていた問題を解消
- 予約情報入力画面の戻るボタンを修正（最初の画面→時間選択画面に戻るように変更）

### 2025年11月25日
- 初期ロード時に4週分のデータを一括取得し、空きのある週へ自動ジャンプ
- 過去の週（offset < 0）へのナビゲーション・データ取得を完全に無効化
- offset 0で左側の週状態表示を透明化（配置は維持）
- PC表示時の最大幅を制限（max-w-2xl: 672px）
- `handleWeekChange`に防御的チェックを追加

### 2025年11月20日（続き）
- スマホ表示の横幅を大幅に拡大（画面いっぱいに近い表示）
- 縦幅を調整してスクロール不要に最適化
- 週データのキャッシュ機能を実装（ページ遷移の高速化）
- 前週・翌週データの事前読み込み機能を追加
- 日付表示部分の幅を固定して中央揃えに統一
- 「ご予約可能な時間帯」の文字列を削除
- 各画面のパディング調整（トップページは広く、他ページは適切な余白）
- スマホ表示の縮小を解除（90%→100%）

### 2025年11月20日
- カルーセル式UIを追加（前週・翌週の予約状況を3D表示）
- スワイプ操作による週移動機能を追加
- 左右矢印クリックでの週移動機能を追加
- 空きのある週への自動ジャンプ機能を追加
- 予約終了時刻のスロット判定バグを修正（>=に変更）
- ヘッダー・ボタン・凡例の幅を日付カード幅に統一
- ヘッダーのフローティングアニメーションを削除

### 2025年11月10日
- 名前欄に「撮影」「対面」が含まれる場合もブロック判定を適用
- スマホ表示を90%縮小（PCは100%）
- スクロールバウンスエフェクトを無効化
- 予約情報入力画面の日時表示を拡大
- フッター説明文を削除

### 2025年10月27日
- 営業者ごとのタグ付け機能を追加
- URLパスで「公認X」「まゆ紹介」タグの自動設定

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

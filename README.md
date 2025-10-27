# 予約システム - Notion連携予約アプリ

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## 最新の変更点 (2025年10月27日)

### 営業者ごとのタグ付け機能を追加

複数の営業者が同じ予約ツールを使用できるよう、URLパスで営業者を識別し、Notionに自動でタグを付ける機能を実装しました。

**機能概要**:
- URLパスで営業者を識別
- Notionの「経路」列（select型）に自動タグ付け
- 同じコードベースで複数の営業経路に対応

**アクセスURL**:
- 通常: `https://mfagencybooking.netlify.app/` → タグなし
- PersonA: `https://mfagencybooking.netlify.app/personA` → 「公認X」タグ
- PersonB: `https://mfagencybooking.netlify.app/personB` → 「まゆ紹介or加藤」タグ

**実装内容**:
1. `public/_redirects` ファイルでNetlifyリダイレクト設定
2. URLパラメータ `ref` を取得してタグに変換
3. Notion APIでselectプロパティとして送信

**技術的詳細**:
- Notionのselectプロパティは `{ select: { name: "値" } }` の形式
- rich_textプロパティは `{ rich_text: [{ text: { content: "値" } }] }` の形式
- リダイレクトステータス: 302（一時的リダイレクト）

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

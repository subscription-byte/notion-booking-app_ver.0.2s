README更新、変更履歴追記、デプロイを一括で実行してください。

以下の手順を順番に実行:
1. `/upd` - README.mdに変更内容を追記（新機能追加時のみ）
2. `/logupd` - CHANGELOG.mdに変更履歴を追記
3. `/dp` - 変更をデプロイ（git add → commit → push）

注意:
- 新機能追加の場合のみREADMEを更新、バグ修正・リファクタリングの場合はCHANGELOGのみ
- コミットメッセージには変更内容を簡潔に記載
- 必ず Claude Code署名を含める
- デプロイ完了後、Netlifyが自動ビルドを開始（2-3分）

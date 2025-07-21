# E2Eテスト用呼び出しBotセットアップガイド

## 概要

E2Eテストで、メインのDiscord Claude Botを呼び出すための専用Botアカウントを作成する手順です。
このBotは実際のユーザーの代わりにメンションを送信し、より現実的なテストを可能にします。

## 役割分離

- **メインBot（既存）**: Claude Code連携・応答処理を担当
- **呼び出しBot（新規）**: E2Eテスト時にメインBotを呼び出すユーザー役

## Discord Developer Portalでの新Bot作成手順

### 1. Discord Developer Portalにアクセス

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. メインBotと同じDiscordアカウントでログイン

### 2. 新しいアプリケーションを作成

1. 「New Application」ボタンをクリック
2. アプリケーション名を入力（例：`Discord Claude Bot E2E Caller`）
3. 「Create」をクリック

### 3. Botの基本設定

1. 左メニューから「Bot」を選択
2. 「Add Bot」をクリック
3. Bot名を設定（例：`Claude-E2E-Caller`）
4. プロフィール画像を設定（任意）

### 4. 重要な設定変更

以下の設定を**必ず**変更してください：

- **Public Bot**: ❌ オフ（プライベートBot）
- **Requires OAuth2 Code Grant**: ❌ オフ
- **Presence Intent**: ❌ オフ（不要）
- **Server Members Intent**: ❌ オフ（不要）
- **Message Content Intent**: ✅ オン（**重要**）

### 5. Botトークンの取得

1. 「Token」セクションで「Reset Token」をクリック
2. 表示されたトークンをコピー（**一度しか表示されません**）
3. `.env.e2e`ファイルの`CALLER_BOT_TOKEN`に設定

## Bot招待とサーバー設定

### 1. OAuth2 URL生成

1. 左メニューから「OAuth2」→「URL Generator」を選択
2. **Scopes**で「bot」を選択
3. **Bot Permissions**で以下を選択：
   - ✅ View Channels
   - ✅ Send Messages
   - ✅ Read Message History

### 2. Botをサーバーに招待

1. 生成されたURLをコピーしてブラウザで開く
2. テスト用サーバーを選択
3. 権限を確認して「認証」をクリック

### 3. チャンネル権限の設定

テスト用チャンネルで以下の権限を両方のBotに付与：

**メインBot**:
- ✅ View Channel
- ✅ Send Messages
- ✅ Read Message History
- ✅ Use Slash Commands（将来対応）

**呼び出しBot**:
- ✅ View Channel
- ✅ Send Messages
- ✅ Read Message History

## 環境変数設定

`.env.e2e`ファイルに以下を追加：

```env
# 既存のメインBot設定
DISCORD_BOT_TOKEN=メインBotのトークン
TEST_CHANNEL_ID=テスト用チャンネルID

# 新しい呼び出しBot設定
CALLER_BOT_TOKEN=呼び出しBotのトークン

# 環境識別子
NODE_ENV=test
```

## セキュリティ注意事項

1. **トークンの管理**
   - トークンは絶対に公開しない
   - `.env.e2e`をgitにコミットしない
   - 必要に応じてトークンを再生成

2. **権限の最小化**
   - 呼び出しBotは最小限の権限のみ付与
   - テスト用チャンネルでのみ動作させる

3. **Bot識別**
   - Bot名やプロフィールでテスト用であることを明示
   - 本番環境では使用しない

## 動作確認

1. 両方のBotがオンライン状態であることを確認
2. テスト用チャンネルでメッセージ送信テスト
3. E2Eテストスクリプトの実行

## トラブルシューティング

### よくある問題

1. **Botがメッセージを送信できない**
   - チャンネル権限を確認
   - `Send Messages`権限が付与されているか確認

2. **Message Content Intentエラー**
   - Developer PortalでMessage Content Intentが有効になっているか確認

3. **401 Unauthorized**
   - トークンが正しく設定されているか確認
   - トークンが漏洩していないか確認

### ログ確認

```bash
# E2Eテスト実行時のログを確認
deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout 90
```

## 更新履歴

- 2025-07-20: 初版作成
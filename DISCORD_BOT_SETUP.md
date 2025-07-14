# Discord Bot 設定手順ガイド

## 1. Discord Developer Portal でのBot作成

### 1.1 アプリケーション作成
1. [Discord Developer Portal](https://discord.com/developers/applications) にログイン
2. 右上の「New Application」をクリック
3. Bot名を入力して「Create」をクリック

### 1.2 Botアカウントの作成
1. 左サイドバーの「Bot」をクリック
2. 「Add Bot」をクリック
3. 確認ダイアログで「Yes, do it!」をクリック

### 1.3 重要な設定
- **MESSAGE CONTENT INTENT**: 必ず有効化（メッセージ内容読み取りに必要）
- **PUBLIC BOT**: 個人使用の場合はOFFに設定
- **REQUIRE OAUTH2 CODE GRANT**: 通常は無効のまま

## 2. Bot Token の取得

### 2.1 Token取得手順
1. Botページで「Reset Token」をクリック
2. 「Copy」ボタンでTokenをコピー
3. **重要**: Tokenは絶対に他人に教えない
4. 流出した場合は「Regenerate」で再生成

### 2.2 Token の保存
```bash
# .env ファイルに保存（推奨）
DISCORD_BOT_TOKEN=your_bot_token_here
```

## 3. Bot 権限設定

### 3.1 必要な基本権限
- **Send Messages**: メッセージ送信
- **Read Message History**: メッセージ履歴読み取り
- **View Channels**: チャンネル表示

### 3.2 スレッド関連権限
- **Send Messages in Threads**: スレッド内メッセージ送信
- **Create Public Threads**: パブリックスレッド作成
- **Read Message History**: スレッド履歴読み取り

## 4. サーバーへの招待

### 4.1 招待URL作成（2025年版）
1. 左サイドバーの「OAuth2」→「URL Generator」をクリック
2. **SCOPES** で「bot」を選択
3. **BOT PERMISSIONS** で必要な権限を選択
4. 生成されたURLをコピー

### 4.2 サーバーに招待
1. 生成したURLをブラウザで開く
2. 招待先サーバーを選択
3. 「Authorize」をクリック
4. **注意**: 2FA有効サーバーの場合、Bot所有者も2FA必須

## 5. 開発環境設定

### 5.1 環境変数設定
```bash
# .env ファイル作成
DISCORD_BOT_TOKEN=your_actual_bot_token
```

### 5.2 権限確認
Bot招待後、以下を確認：
- サーバー設定 → 連携サービス → ボット → 権限設定
- チャンネル別権限（チャンネル設定 → 権限タブ）

## トラブルシューティング

### よくある問題
1. **メッセージが読み取れない**: MESSAGE CONTENT INTENTが無効
2. **スレッドに参加できない**: スレッド権限が不足
3. **Bot が反応しない**: Token が正しくない、またはBot がオフライン

### 権限不足の場合
- Developer Portal で権限を追加
- 招待URLを再生成して再招待
- サーバー管理者に権限設定を依頼
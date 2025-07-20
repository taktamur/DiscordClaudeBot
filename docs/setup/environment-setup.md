# 環境設定ガイド

Discord Claude Bot では、テスト環境と本番環境を分離するための環境別設定機能を提供しています。

## 概要

以下の環境がサポートされています：

- **production** (デフォルト): 本番環境用、`.env` ファイルを使用
- **test**: E2Eテスト環境用、`.env.e2e` ファイルを使用
- **development**: 開発環境用、`.env` ファイルを使用

## 設定ファイル

### 1. 環境別設定ファイルの作成

```bash
# 本番環境用（デフォルト）
cp .env.example .env

# E2Eテスト環境用
cp .env.example .env.e2e
```

### 2. 各環境ファイルの設定

#### .env (本番環境用)
```env
# 本番用Bot Token
DISCORD_BOT_TOKEN=your_production_bot_token_here
NODE_ENV=production
```

#### .env.e2e
```env
# E2Eテスト用Bot Token
DISCORD_BOT_TOKEN=your_test_bot_token_here
TEST_CHANNEL_ID=your_test_channel_id_here
NODE_ENV=test
```

## 環境の切り替え方法

### 1. 環境変数での指定

```bash
# テスト環境で実行
NODE_ENV=test deno run --allow-net --allow-env --allow-read main.ts

# 本番環境で実行
NODE_ENV=production deno run --allow-net --allow-env --allow-read main.ts
```

### 2. プログラム内での切り替え

```typescript
import { switchEnvironment } from "./src/config.ts";

// テスト環境に切り替え
await switchEnvironment("test");

// 本番環境に切り替え
await switchEnvironment("production");
```

## Bot アカウントの分離

### Discord Developer Portal での設定

1. **テスト用Bot作成**
   - Discord Developer Portal で新しいアプリケーションを作成
   - Bot タブでトークンを生成
   - `.env.e2e` に設定

2. **本番用Bot設定**
   - 既存の本番用Botトークンを使用
   - `.env` に設定

### 権限とサーバー招待

- テスト用Botと本番用Botは別々のトークンを使用
- それぞれ適切なサーバーに招待
- 同時実行が可能（異なるトークンのため）

## 使用例

### 開発・テスト時

```bash
# 30秒で自動終了するテストモード
NODE_ENV=test deno run --allow-net --allow-env --allow-read main.ts --timeout 30

# テスト自動実行
NODE_ENV=test deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout 90
```

### 本番運用時

```bash
# 本番環境で永続実行
NODE_ENV=production deno run --allow-net --allow-env --allow-read main.ts
```

## 注意事項

- テスト用と本番用で異なるDiscord Botトークンを使用してください
- `.env` と `.env.e2e` ファイルは `.gitignore` に追加されています
- 本番環境では `TEST_CHANNEL_ID` は通常不要ですが、緊急時のテスト用に設定可能です
- 環境ファイルが見つからない場合は、システムの環境変数が使用されます

## トラブルシューティング

### 設定ファイルが読み込まれない

```bash
# 現在の環境を確認
echo $NODE_ENV

# ファイルの存在確認
ls -la .env*
```

### Bot トークンエラー

```bash
# 環境変数の確認
echo $DISCORD_BOT_TOKEN
```

環境別設定により、テスト環境と本番環境の完全な分離が可能になります。
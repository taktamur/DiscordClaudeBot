# Discord Bot テスト自動化

Discord Claude Botの機能を自動でテストするシステムです。手動でDiscordクライアントを操作することなく、ボットの動作確認が可能です。

## 概要

### 動作原理
1. ボットが指定されたテストチャンネルに自己メンション付きメッセージを送信
2. 自分のメッセージを検知してメンション処理ロジックが実行
3. Claude Code連携を含む全機能がテスト
4. 応答時間と内容を検証して結果レポートを生成

### テストシナリオ
- **基本応答テスト**: 「こんにちは」→ 応答の有無確認
- **Claude連携テスト**: 「2+2は？」→ 数値応答確認（パターンマッチング）
- **短文処理テスト**: 「はい」→ 応答の有無確認

## セットアップ

### 1. 環境変数設定
`.env`ファイルにテスト用チャンネルIDを追加：

```bash
DISCORD_BOT_TOKEN=your_bot_token_here
TEST_CHANNEL_ID=your_test_channel_id_here
```

### 2. チャンネルID取得方法
1. Discord開発者モードを有効化（設定→詳細設定→開発者モード）
2. テスト用チャンネルを右クリック→「IDをコピー」
3. 上記の`TEST_CHANNEL_ID`に設定

### 3. ボット権限確認
テストチャンネルでボットが以下の権限を持つことを確認：
- メッセージを送信
- メッセージ履歴を読む
- メンションを付けて送信

## 実行方法

### 基本実行
```bash
deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout=90
```

### 環境変数を事前設定
```bash
export DISCORD_BOT_TOKEN="your_token"
export TEST_CHANNEL_ID="your_channel_id"
deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout=90
```

### 権限フラグの説明
- `--allow-net`: Discord API通信
- `--allow-env`: 環境変数読み取り
- `--allow-read`: 設定ファイル読み取り
- `--allow-run`: Claude CLI実行（重要！）

## テスト結果の見方

### 成功例
```
テスト結果レポート
==================================================
総テスト数: 3
成功: 3
失敗: 0
成功率: 100.0%
--------------------------------------------------
✅ 成功 基本応答テスト (1175ms)
  応答: <@1395924041532964894> こんにちは！お疲れ様です。
✅ 成功 Claude連携テスト (6617ms)  
  応答: <@1395924041532964894> 2+2は4です！
✅ 成功 短文処理テスト (953ms)
  応答: <@1395924041532964894> はい！
==================================================
テスト完了: 全テスト成功
```

### 失敗例とトラブルシューティング

#### 1. 環境変数エラー
```
TEST_CHANNEL_ID environment variable is required for test mode
```
**解決**: `.env`ファイルに`TEST_CHANNEL_ID`を設定

#### 2. 権限エラー
```
NotCapable: Requires run access to "claude"
```
**解決**: `--allow-run`フラグを追加

#### 3. チャンネルアクセスエラー
```
テストチャンネルが見つかりません
```
**解決**: 
- チャンネルIDが正しいか確認
- ボットがチャンネルにアクセス可能か確認

#### 4. タイムアウトエラー
```
❌ 失敗 Claude連携テスト (60000ms)
  エラー: タイムアウト
```
**解決**: 
- Claude Code CLIが正常に動作するか確認
- タイムアウト時間を延長（`--timeout=120`等）

## CI/CD統合

### 終了コード
- **0**: 全テスト成功
- **1**: 一部またはすべてのテスト失敗

### GitHub Actions例
```yaml
name: Bot Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
      - name: Run Bot Tests
        env:
          DISCORD_BOT_TOKEN: ${{ secrets.DISCORD_BOT_TOKEN }}
          TEST_CHANNEL_ID: ${{ secrets.TEST_CHANNEL_ID }}
        run: |
          deno run --allow-net --allow-env --allow-read --allow-run main.ts --test --timeout=120
```

## 制限事項

### テストモード時の注意
- ボット自身のメッセージにも反応するため、通常運用時とは動作が異なる
- テスト実行中はテストチャンネルに複数のメッセージが投稿される
- 他のユーザーがテストチャンネルでボットにメンションした場合、テスト結果に影響する可能性

### パフォーマンス考慮
- Claude Code CLI実行によりテスト時間が長くなる（通常30-90秒）
- 連続実行時はレート制限に注意
- テスト用チャンネルは専用のプライベートチャンネル推奨

## 実装詳細

### 主要クラス
- **TestRunner** (`src/test/test-runner.ts`): テスト実行とレポート生成
- **DiscordBot** (`src/bot.ts`): テストモードフラグによる動作切り替え

### テストフロー
1. `main.ts`で`--test`オプション検知
2. `DiscordBot.setTestMode(true)`でテストモード有効化
3. `TestRunner`でテストシナリオ実行
4. 各シナリオでメッセージ送信→応答待機→検証
5. 結果レポート生成後、プロセス終了

### カスタマイズ
テストシナリオは`TestRunner`クラスの`DEFAULT_SCENARIOS`で定義されており、必要に応じて追加・変更可能です。
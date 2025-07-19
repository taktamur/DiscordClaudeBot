# Claude Code CLI 詳細仕様調査結果

## 概要

Discord Claude Bot実装のため、Claude Code CLIの詳細仕様を調査しました。

## 基本仕様

### ヘルプ情報
```bash
claude --help
```

### 主要オプション
- `-p, --print`: 非インタラクティブ出力（パイプ用）
- `--output-format`: 出力形式（text, json, stream-json）
- `--input-format`: 入力形式（text, stream-json）
- `--model`: 使用モデル指定
- `--fallback-model`: フォールバックモデル
- `-c, --continue`: 最新の会話を継続
- `-r, --resume`: セッション再開

## 実行テスト結果

### 1. 基本実行
```bash
claude -p "こんにちは、簡単なテストです。今の時刻を教えてください。"
```
- **終了コード**: 0（成功）
- **出力**: 通常のClaude応答
- **実行時間**: 数秒程度

### 2. 特殊文字エスケープ
以下の特殊文字がすべて正常に処理されることを確認：

| テストケース | 結果 | 終了コード |
|-------------|------|-----------|
| 基本テスト | ✅ 正常 | 0 |
| ダブルクォート `"` | ✅ 正常 | 0 |
| シングルクォート `'` | ✅ 正常 | 0 |
| バックスラッシュ `\` | ✅ 正常 | 0 |
| 改行 `\n` | ✅ 正常 | 0 |
| 特殊文字 `!@#$%^&*()` | ✅ 正常 | 0 |
| 日本語混在 | ✅ 正常 | 0 |
| 長文・複数行 | ✅ 正常 | 0 |

**重要**: 特殊文字のエスケープは不要。Deno.Commandの引数配列で直接渡せる。

### 3. エラー処理

| エラーケース | 終了コード | 出力先 |
|-------------|-----------|--------|
| 不正なオプション | 1 | stderr |
| 存在しないサブコマンド | 0 | stdout（Claudeが通常応答） |
| 空のプロンプト | 1 | stderr |

**エラーメッセージ例**:
- 不正オプション: `error: unknown option '--invalid-option'`
- 空プロンプト: `Error: Input must be provided either through stdin or as a prompt argument when using --print`

### 4. 実行時間制限
- **長時間実行テスト**: 36.66秒で終了
- **終了コード**: 1（エラー）
- **エラー内容**: プロンプト解析エラー（Bad substitution）

**注意**: 非常に複雑なプロンプト（大量の計算要求等）は内部処理でエラーになる可能性があります。

## Discord Bot実装への推奨事項

### 1. プロンプト実行方法
```typescript
const cmd = new Deno.Command("claude", {
  args: ["-p", prompt],
  stdout: "piped",
  stderr: "piped"
});

const result = await cmd.output();
```

### 2. エラーハンドリング
```typescript
if (result.code === 0) {
  // 成功：標準出力を使用
  const output = new TextDecoder().decode(result.stdout);
} else {
  // エラー：標準エラーを確認
  const error = new TextDecoder().decode(result.stderr);
}
```

### 3. 特殊文字対応
- エスケープ処理は不要
- 引数配列で直接渡すことで安全に処理される
- 改行やクォートも問題なし

### 4. タイムアウト設定
```typescript
// 推奨：手動でタイムアウト設定
const timeout = setTimeout(() => {
  // プロセス強制終了
}, 60000); // 60秒

try {
  const result = await cmd.output();
  clearTimeout(timeout);
} catch (error) {
  // タイムアウトまたはその他のエラー処理
}
```

### 5. 出力形式

#### デフォルト（text）形式
```bash
claude -p "プロンプト"
```
- **用途**: 通常のテキスト応答
- **出力**: Claudeの応答テキストのみ
- **特徴**: シンプルで人間が読みやすい

#### JSON形式
```bash
claude -p "プロンプト" --output-format json
```
- **用途**: 構造化された応答が必要な場合
- **出力構造**:
  ```json
  {
    "type": "result",
    "subtype": "success",
    "is_error": false,
    "duration_ms": 5236,
    "duration_api_ms": 4812,
    "num_turns": 1,
    "result": "Claudeの応答テキスト",
    "session_id": "セッションID",
    "total_cost_usd": 0.005323,
    "usage": {
      "input_tokens": 3,
      "cache_creation_input_tokens": 1341,
      "cache_read_input_tokens": 13413,
      "output_tokens": 59,
      "server_tool_use": {
        "web_search_requests": 0
      },
      "service_tier": "standard"
    }
  }
  ```
- **メリット**: 実行時間、コスト、トークン使用量等の詳細情報が取得可能

#### Stream-JSON形式
```bash
claude -p "プロンプト" --output-format stream-json --verbose
```
- **用途**: リアルタイム処理、進行状況の監視
- **特徴**: 複数行のJSONが順次出力される
- **出力例**:
  ```json
  {"type":"system","subtype":"init","cwd":"/path","session_id":"...","tools":[...]}
  {"type":"assistant","message":{"content":[...],"usage":{...}}}
  {"type":"result","subtype":"success","duration_ms":38577,...}
  ```
- **注意**: `--verbose`フラグが必須

#### Discord Bot実装での活用方法

**Text形式**: シンプルな応答で十分な場合
```typescript
const output = new TextDecoder().decode(result.stdout);
await msg.reply(output);
```

**JSON形式**: 詳細情報が必要な場合
```typescript
const jsonData = JSON.parse(output);
await msg.reply(`${jsonData.result}\n\n⏱️ ${jsonData.duration_ms}ms | 💰 $${jsonData.total_cost_usd.toFixed(6)}`);
```

**Stream-JSON形式**: リアルタイム進行表示
```typescript
// プロセス開始時にタイピング表示
await msg.channel.startTyping();

// ストリーム処理で進行状況を監視
const lines = output.split('\n');
lines.forEach(line => {
  const data = JSON.parse(line);
  if (data.type === 'assistant') {
    // 中間結果の表示等
  }
});
```

## Discord連携での注意点

### 1. Discord文字制限対応
- Discordメッセージ制限: 2000文字
- Claude出力が長い場合は分割送信が必要

### 2. 応答時間対応
- Discord応答制限: 数秒以内
- 長時間処理時はタイピング表示等の検討が必要

### 3. エラー時の対応
- 終了コード1の場合、ユーザーに適切なエラーメッセージを返す
- ネットワークエラー等の例外処理も必要

## 実装例

```typescript
async function executeClaude(prompt: string): Promise<string> {
  try {
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    });
    
    const result = await cmd.output();
    
    if (result.code === 0) {
      return new TextDecoder().decode(result.stdout);
    } else {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(`Claude error: ${error}`);
    }
  } catch (error) {
    throw new Error(`Failed to execute Claude: ${error.message}`);
  }
}
```

## 結論

Claude Code CLIは安定して動作し、特殊文字も適切に処理されます。Discord Bot実装時は、タイムアウト処理と長文応答の分割送信に注意が必要です。
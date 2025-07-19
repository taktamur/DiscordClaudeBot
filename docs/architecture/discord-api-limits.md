# Discord API制限事項調査結果

## 概要

Discord Claude Bot実装において考慮すべきDiscord APIの制限事項を調査しました。

## メッセージ制限

### 文字数制限
- **通常ユーザー**: 2000文字
- **Discord Nitroユーザー**: 4000文字
- **Bot**: 通常ユーザーと同じ2000文字制限

### 対応策
```typescript
function splitMessage(text: string, maxLength: number = 2000): string[] {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks: string[] = [];
  let currentChunk = "";
  
  // 改行で分割を試行
  const lines = text.split('\n');
  
  for (const line of lines) {
    if ((currentChunk + line + '\n').length > maxLength) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      // 1行が制限を超える場合は強制分割
      if (line.length > maxLength) {
        const subChunks = line.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
        chunks.push(...subChunks);
      } else {
        currentChunk = line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
```

## レート制限

### グローバルレート制限
- **制限**: 50リクエスト/秒（API全体）
- **対象**: Bot単位

### ルート別レート制限
- **メッセージ送信**: 5メッセージ/秒（チャンネル別）
- **DM送信**: より厳しい制限あり
- **その他**: エンドポイント別に異なる制限

### レート制限ヘッダー
```typescript
interface RateLimitHeaders {
  'X-RateLimit-Limit': string;        // リクエスト上限
  'X-RateLimit-Remaining': string;    // 残りリクエスト数
  'X-RateLimit-Reset': string;        // リセット時刻（UNIX timestamp）
  'X-RateLimit-Reset-After': string;  // リセットまでの秒数
  'X-RateLimit-Bucket': string;       // バケットID
}
```

### エラー制限
- **無効リクエスト制限**: 10,000回/10分でIP制限
- **対象ステータス**: 401, 403, 429

## Embed制限

### 基本制限
- **説明(description)**: 2048文字（一部で4096文字）
- **フィールド名**: 256文字
- **フィールド値**: 1024文字
- **総文字数**: 6000文字（メッセージ内全embed合計）

### Embed例
```typescript
interface DiscordEmbed {
  title?: string;           // 256文字
  description?: string;     // 2048文字
  fields?: Array<{
    name: string;          // 256文字
    value: string;         // 1024文字
    inline?: boolean;
  }>;
  footer?: {
    text: string;          // 2048文字
  };
  author?: {
    name: string;          // 256文字
  };
}
```

## Discord Claude Bot実装での対策

### 1. メッセージ分割処理
```typescript
async function sendLongMessage(channel: any, text: string) {
  const chunks = splitMessage(text, 1900); // 余裕を持って1900文字
  
  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `[${i + 1}/${chunks.length}] ` : '';
    await channel.send(prefix + chunks[i]);
    
    // レート制限回避のため少し待機
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}
```

### 2. レート制限対応
```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  
  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.process();
    });
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      await request();
      await new Promise(resolve => setTimeout(resolve, 200)); // 5req/sec制限対応
    }
    
    this.processing = false;
  }
}
```

### 3. エラーハンドリング
```typescript
async function sendMessageWithRetry(channel: any, content: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await channel.send(content);
    } catch (error) {
      if (error.code === 50035) { // 文字数制限エラー
        // メッセージ分割処理
        return await sendLongMessage(channel, content);
      }
      
      if (error.code === 429) { // レート制限エラー
        const retryAfter = error.retryAfter || 1000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        continue;
      }
      
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

## Discord Claude Bot特有の考慮事項

### 1. Claude応答の長文対応
- Claude Code出力は2000文字を超える可能性が高い
- 自動分割処理が必須
- コードブロックの分割に注意

### 2. 応答時間とレート制限
- Claude Code実行時間が長い場合の対応
- タイピング表示の活用
- 複数ユーザーからの同時リクエスト制御

### 3. エラー時の適切な応答
```typescript
async function handleClaudeError(channel: any, error: Error) {
  const errorMessage = `❌ Claude Code実行エラー:\n\`\`\`\n${error.message}\n\`\`\``;
  
  if (errorMessage.length > 2000) {
    await channel.send("❌ Claude Code実行エラーが発生しました（詳細はログを確認してください）");
  } else {
    await channel.send(errorMessage);
  }
}
```

## 推奨実装パターン

1. **メッセージ分割**: 1900文字で自動分割
2. **レート制限**: キュー処理で200ms間隔
3. **エラー処理**: 3回までリトライ
4. **タイピング表示**: 長時間処理時に活用
5. **ログ記録**: レート制限エラーの監視

これらの制限を適切に処理することで、安定したDiscord Claude Botの動作が期待できます。
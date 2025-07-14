# エラーシナリオと対処法調査結果

## 概要

Discord Claude Bot運用時に発生する可能性があるエラーシナリオを調査し、適切な対処法をまとめました。

## 1. Claude Code実行エラー

### 1-1. コマンドライン引数エラー
```typescript
// エラー例
// 終了コード: 1
// エラー: "error: unknown option '--config'"
// エラー: "Error: --resume requires a valid session ID when used with --print"

// 対処法
async function handleClaudeExecution(prompt: string): Promise<string> {
  try {
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt], // 検証済みの引数のみ使用
      stdout: "piped",
      stderr: "piped",
      timeout: 60000 // 60秒タイムアウト
    });

    const result = await cmd.output();
    
    if (result.code !== 0) {
      const error = new TextDecoder().decode(result.stderr);
      throw new ClaudeExecutionError(result.code, error);
    }

    return new TextDecoder().decode(result.stdout);
  } catch (error) {
    if (error instanceof ClaudeExecutionError) {
      return handleClaudeError(error);
    }
    throw error;
  }
}

class ClaudeExecutionError extends Error {
  constructor(public code: number, public stderr: string) {
    super(`Claude execution failed with code ${code}: ${stderr}`);
  }
}

function handleClaudeError(error: ClaudeExecutionError): string {
  switch (error.code) {
    case 1:
      if (error.stderr.includes("unknown option")) {
        return "❌ 不正なコマンドオプションが指定されました。";
      }
      if (error.stderr.includes("requires a valid session ID")) {
        return "❌ セッション管理エラーが発生しました。";
      }
      return "❌ Claude実行時にエラーが発生しました。";
    case 2:
      return "❌ プロンプトの解析に失敗しました。";
    default:
      return "❌ 予期しないエラーが発生しました。";
  }
}
```

### 1-2. ネットワークエラー
```typescript
class NetworkErrorHandler {
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1秒

  async executeWithRetry(prompt: string): Promise<string> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.executeClaude(prompt);
      } catch (error) {
        if (this.isNetworkError(error) && attempt < this.maxRetries - 1) {
          console.log(`ネットワークエラー、${attempt + 1}回目のリトライ: ${error.message}`);
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw new Error("最大リトライ回数に達しました");
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorKeywords = [
      'network',
      'timeout',
      'connection',
      'proxy',
      'dns',
      'ENOTFOUND',
      'ECONNREFUSED'
    ];
    
    return networkErrorKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async executeClaude(prompt: string): Promise<string> {
    // Claude実行ロジック
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    });

    const result = await cmd.output();
    
    if (result.code !== 0) {
      const error = new TextDecoder().decode(result.stderr);
      throw new Error(error);
    }

    return new TextDecoder().decode(result.stdout);
  }
}
```

## 2. プロセス制御エラー

### 2-1. メモリ不足・リソース枯渇
```typescript
class ResourceManager {
  private runningProcesses = 0;
  private readonly maxConcurrentProcesses = 3;
  private readonly maxMemoryUsage = 512 * 1024 * 1024; // 512MB

  async executeWithResourceControl(prompt: string): Promise<string> {
    // 同時実行制限
    if (this.runningProcesses >= this.maxConcurrentProcesses) {
      throw new Error("システムが混雑しています。しばらく待ってからお試しください。");
    }

    // プロンプトサイズ制限
    if (prompt.length > 50000) { // 50KB制限
      throw new Error("プロンプトが大きすぎます。内容を短くしてください。");
    }

    this.runningProcesses++;
    
    try {
      const cmd = new Deno.Command("claude", {
        args: ["-p", prompt],
        stdout: "piped",
        stderr: "piped"
      });

      const child = cmd.spawn();
      
      // タイムアウト設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("処理時間制限（60秒）に達しました。"));
        }, 60000);
      });

      const result = await Promise.race([
        child.output(),
        timeoutPromise
      ]);

      if (result.code !== 0) {
        const error = new TextDecoder().decode(result.stderr);
        throw new Error(`Claude実行エラー: ${error}`);
      }

      return new TextDecoder().decode(result.stdout);
    } finally {
      this.runningProcesses--;
    }
  }

  getStatus(): { running: number; maxConcurrent: number; available: boolean } {
    return {
      running: this.runningProcesses,
      maxConcurrent: this.maxConcurrentProcesses,
      available: this.runningProcesses < this.maxConcurrentProcesses
    };
  }
}
```

### 2-2. プロセス異常終了
```typescript
class ProcessMonitor {
  async executeWithMonitoring(prompt: string): Promise<string> {
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    });

    const child = cmd.spawn();
    let processKilled = false;

    // プロセス監視
    const monitorInterval = setInterval(() => {
      // プロセスのヘルスチェックロジック
      // 実際の実装では、プロセスのCPU使用率やメモリ使用量を監視
    }, 5000);

    try {
      const result = await child.output();
      clearInterval(monitorInterval);

      // 異常終了の検出
      if (result.signal !== null) {
        throw new Error(`プロセスがシグナル ${result.signal} で終了しました`);
      }

      if (result.code !== 0 && !processKilled) {
        const error = new TextDecoder().decode(result.stderr);
        throw new Error(`プロセスが異常終了しました（終了コード: ${result.code}）: ${error}`);
      }

      return new TextDecoder().decode(result.stdout);
    } catch (error) {
      clearInterval(monitorInterval);
      
      if (!processKilled) {
        try {
          child.kill("SIGTERM");
          // 強制終了の猶予時間
          setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch (e) {
              // プロセスが既に終了している場合のエラーを無視
            }
          }, 5000);
        } catch (e) {
          // kill失敗は無視（プロセスが既に終了している可能性）
        }
      }
      
      throw error;
    }
  }
}
```

## 3. Discord連携エラー

### 3-1. メッセージ長制限エラー
```typescript
class MessageSplitter {
  private readonly maxLength = 1900; // Discord制限より少し小さく設定

  async sendLongMessage(channel: any, text: string): Promise<void> {
    const chunks = this.splitMessage(text);
    
    if (chunks.length === 1) {
      await channel.send(text);
      return;
    }

    // 複数チャンクの場合、番号付きで送信
    for (let i = 0; i < chunks.length; i++) {
      const prefix = `[${i + 1}/${chunks.length}] `;
      const message = prefix + chunks[i];
      
      try {
        await channel.send(message);
        
        // レート制限回避のため少し待機
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      } catch (error) {
        if (error.code === 50035) { // メッセージが長すぎる
          // さらに細かく分割
          const subChunks = this.splitMessage(chunks[i], this.maxLength - prefix.length);
          for (const subChunk of subChunks) {
            await channel.send(prefix + subChunk);
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } else {
          throw error;
        }
      }
    }
  }

  private splitMessage(text: string, maxLength: number = this.maxLength): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = "";

    // コードブロックを考慮した分割
    const codeBlockRegex = /```[\s\S]*?```/g;
    const parts: Array<{text: string, isCode: boolean}> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({text: text.slice(lastIndex, match.index), isCode: false});
      }
      parts.push({text: match[0], isCode: true});
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({text: text.slice(lastIndex), isCode: false});
    }

    for (const part of parts) {
      if (part.isCode) {
        // コードブロックは分割しない
        if ((currentChunk + part.text).length > maxLength) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
          }
          
          if (part.text.length > maxLength) {
            // コードブロックが大きすぎる場合は例外的に分割
            chunks.push(part.text);
          } else {
            currentChunk = part.text;
          }
        } else {
          currentChunk += part.text;
        }
      } else {
        // 通常テキストは行単位で分割
        const lines = part.text.split('\n');
        for (const line of lines) {
          if ((currentChunk + line + '\n').length > maxLength) {
            if (currentChunk.trim()) {
              chunks.push(currentChunk.trim());
              currentChunk = "";
            }
            
            if (line.length > maxLength) {
              // 長い行は単語単位で分割
              const words = line.split(' ');
              let wordChunk = "";
              
              for (const word of words) {
                if ((wordChunk + word + ' ').length > maxLength) {
                  if (wordChunk.trim()) {
                    currentChunk += wordChunk.trim() + '\n';
                  }
                  wordChunk = word + ' ';
                } else {
                  wordChunk += word + ' ';
                }
              }
              
              if (wordChunk.trim()) {
                currentChunk += wordChunk.trim() + '\n';
              }
            } else {
              currentChunk = line + '\n';
            }
          } else {
            currentChunk += line + '\n';
          }
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
```

### 3-2. レート制限エラー
```typescript
class DiscordRateLimiter {
  private messageQueue: Array<{channel: any, content: string, resolve: Function, reject: Function}> = [];
  private processing = false;
  private lastMessageTime = 0;
  private readonly messageInterval = 250; // 4メッセージ/秒制限

  async queueMessage(channel: any, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.messageQueue.push({channel, content, resolve, reject});
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.messageQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.messageQueue.length > 0) {
      const {channel, content, resolve, reject} = this.messageQueue.shift()!;
      
      try {
        // レート制限を考慮した待機
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        
        if (timeSinceLastMessage < this.messageInterval) {
          await new Promise(res => setTimeout(res, this.messageInterval - timeSinceLastMessage));
        }

        await channel.send(content);
        this.lastMessageTime = Date.now();
        resolve();
      } catch (error) {
        if (error.code === 429) { // Rate limit error
          const retryAfter = error.retryAfter || 1000;
          console.log(`レート制限に達しました。${retryAfter}ms後にリトライします。`);
          
          // メッセージをキューの先頭に戻す
          this.messageQueue.unshift({channel, content, resolve, reject});
          
          await new Promise(res => setTimeout(res, retryAfter));
          continue;
        } else {
          reject(error);
        }
      }
    }

    this.processing = false;
  }

  getQueueStatus(): {queueLength: number, processing: boolean} {
    return {
      queueLength: this.messageQueue.length,
      processing: this.processing
    };
  }
}
```

## 4. 統合エラーハンドリング

```typescript
class ErrorHandler {
  constructor(
    private resourceManager: ResourceManager,
    private networkErrorHandler: NetworkErrorHandler,
    private messageSplitter: MessageSplitter,
    private rateLimiter: DiscordRateLimiter
  ) {}

  async handleUserRequest(msg: any, prompt: string): Promise<void> {
    try {
      // リソース状況確認
      const status = this.resourceManager.getStatus();
      if (!status.available) {
        await msg.reply(`⏳ システムが混雑しています（${status.running}/${status.maxConcurrent}プロセス実行中）。しばらく待ってからお試しください。`);
        return;
      }

      // タイピング表示開始
      await msg.channel.startTyping();

      // Claude実行（ネットワークエラーリトライ付き）
      const response = await this.networkErrorHandler.executeWithRetry(prompt);

      // 長文応答の分割送信
      await this.messageSplitter.sendLongMessage(msg.channel, response);

    } catch (error) {
      await this.handleError(msg, error);
    } finally {
      // タイピング表示終了
      try {
        await msg.channel.stopTyping();
      } catch (e) {
        // タイピング停止エラーは無視
      }
    }
  }

  private async handleError(msg: any, error: Error): Promise<void> {
    let userMessage: string;

    if (error instanceof ClaudeExecutionError) {
      userMessage = this.getClaudeErrorMessage(error);
    } else if (error.message.includes("システムが混雑")) {
      userMessage = "🚫 " + error.message;
    } else if (error.message.includes("プロンプトが大きすぎます")) {
      userMessage = "📝 " + error.message;
    } else if (error.message.includes("処理時間制限")) {
      userMessage = "⏰ " + error.message;
    } else if (error.message.includes("最大リトライ回数")) {
      userMessage = "🌐 ネットワークエラーが発生しました。しばらく待ってからお試しください。";
    } else {
      userMessage = "❌ 予期しないエラーが発生しました。管理者にお問い合わせください。";
      
      // 詳細エラーログ
      console.error("未処理エラー:", {
        message: error.message,
        stack: error.stack,
        userId: msg.author.id,
        timestamp: new Date().toISOString()
      });
    }

    try {
      await this.rateLimiter.queueMessage(msg.channel, userMessage);
    } catch (sendError) {
      console.error("エラーメッセージ送信失敗:", sendError);
    }
  }

  private getClaudeErrorMessage(error: ClaudeExecutionError): string {
    if (error.stderr.includes("unknown option")) {
      return "⚙️ システム設定エラーが発生しました。";
    }
    if (error.stderr.includes("session")) {
      return "🔄 セッション管理エラーが発生しました。もう一度お試しください。";
    }
    if (error.stderr.includes("Bad substitution")) {
      return "📝 プロンプトの解析に失敗しました。内容を確認してください。";
    }
    return "🤖 Claude実行時にエラーが発生しました。";
  }
}
```

## 5. 運用監視とアラート

```typescript
class OperationalMonitor {
  private errorCounts = new Map<string, number>();
  private lastReset = Date.now();
  private readonly resetInterval = 3600000; // 1時間

  logError(errorType: string, details: any): void {
    this.resetCountsIfNeeded();
    
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);

    // 閾値チェック
    if (count + 1 >= this.getThreshold(errorType)) {
      this.sendAlert(errorType, count + 1, details);
    }

    console.error(`[${errorType}] エラー発生 (${count + 1}回目):`, details);
  }

  private getThreshold(errorType: string): number {
    const thresholds: Record<string, number> = {
      'claude_execution_error': 10,
      'network_error': 5,
      'rate_limit_error': 20,
      'resource_exhaustion': 3,
      'unknown_error': 5
    };
    
    return thresholds[errorType] || 10;
  }

  private sendAlert(errorType: string, count: number, details: any): void {
    const alertMessage = `🚨 ${errorType} が ${count} 回発生しました`;
    console.error("ALERT:", alertMessage, details);
    
    // 実際の運用では、ここでSlackやメール通知を送信
  }

  private resetCountsIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastReset > this.resetInterval) {
      this.errorCounts.clear();
      this.lastReset = now;
    }
  }

  getErrorSummary(): Record<string, number> {
    this.resetCountsIfNeeded();
    return Object.fromEntries(this.errorCounts);
  }
}
```

## まとめ

Discord Claude Bot運用時の主要なエラーシナリオと対処法：

1. **Claude実行エラー**: 引数検証、リトライ機構、適切なエラーメッセージ
2. **リソース制御エラー**: 同時実行制限、タイムアウト、メモリ監視
3. **Discord連携エラー**: メッセージ分割、レート制限対応、キュー処理
4. **統合エラーハンドリング**: 包括的なエラー分類と適切な応答
5. **運用監視**: エラー監視、アラート、ログ分析

これらの対策により、安定したBot運用が可能になります。
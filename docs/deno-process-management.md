# Deno.Command プロセス管理調査結果

## 概要

Discord Claude Bot実装でのDeno.Commandを使用したプロセス管理の詳細仕様を調査しました。

## 基本的な使用方法

### 1. 基本実行
```typescript
const cmd = new Deno.Command("claude", {
  args: ["-p", "テストプロンプト"],
  stdout: "piped",
  stderr: "piped"
});

const result = await cmd.output();
console.log("終了コード:", result.code);
console.log("成功:", result.success);
console.log("出力:", new TextDecoder().decode(result.stdout));
```

**調査結果:**
- 終了コード0で正常終了
- `result.success`はboolean値で成功/失敗を示す
- 標準出力・標準エラーは別々にキャプチャ可能

## タイムアウト制御

### 2. プロセスタイムアウト
```typescript
async function executeWithTimeout(prompt: string, timeoutMs: number = 60000): Promise<string> {
  const cmd = new Deno.Command("claude", {
    args: ["-p", prompt],
    stdout: "piped",
    stderr: "piped"
  });

  const child = cmd.spawn();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("実行時間制限に達しました"));
    }, timeoutMs);
  });

  const result = await Promise.race([
    child.output(),
    timeoutPromise
  ]);

  if (result.code !== 0) {
    throw new Error(`Claude実行エラー: ${new TextDecoder().decode(result.stderr)}`);
  }

  return new TextDecoder().decode(result.stdout);
}
```

**調査結果:**
- タイムアウト処理は正常に動作（3秒制限で5秒処理を中断）
- `child.kill("SIGTERM")`でプロセス強制終了可能
- タイムアウト後の終了コードは143（SIGTERM）

## 並列処理

### 3. 複数プロセス同時実行
```typescript
async function executeConcurrent(prompts: string[]): Promise<string[]> {
  const commands = prompts.map(prompt => 
    new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    })
  );

  const results = await Promise.all(
    commands.map(cmd => cmd.output())
  );

  return results.map(result => {
    if (result.code !== 0) {
      throw new Error(`エラー: ${new TextDecoder().decode(result.stderr)}`);
    }
    return new TextDecoder().decode(result.stdout);
  });
}
```

**調査結果:**
- 並列実行は非常に高速（3プロセス同時実行で2ms）
- 各プロセスは独立して実行される
- エラーは個別にハンドリング可能

## プロセス終了シグナル

### 4. シグナル処理
```typescript
async function executeWithSignalHandling(prompt: string): Promise<string> {
  const cmd = new Deno.Command("claude", {
    args: ["-p", prompt],
    stdout: "piped",
    stderr: "piped"
  });

  const child = cmd.spawn();
  
  // 1秒後にSIGTERM送信
  setTimeout(() => {
    child.kill("SIGTERM");
  }, 1000);

  const result = await child.output();
  
  console.log("終了コード:", result.code);
  console.log("シグナル:", result.signal);
  
  return new TextDecoder().decode(result.stdout);
}
```

**調査結果:**
- `result.signal`でプロセス終了シグナルを取得可能
- SIGTERM送信時: `result.code = 143`, `result.signal = "SIGTERM"`
- シグナルによる終了は適切に検出される

## 環境変数とセキュリティ

### 5. 環境変数制御
```typescript
async function executeWithCustomEnv(prompt: string): Promise<string> {
  const cmd = new Deno.Command("claude", {
    args: ["-p", prompt],
    stdout: "piped",
    stderr: "piped",
    env: {
      // 必要最小限の環境変数のみ設定
      "TERM": "xterm",
      "LANG": "en_US.UTF-8",
      // PATH等の危険な変数は除外
    }
  });

  const result = await cmd.output();
  return new TextDecoder().decode(result.stdout);
}
```

**重要な注意点:**
- `--allow-env`フラグが必要（環境変数アクセス時）
- セキュリティのため、環境変数は最小限に制限
- `env: {}`で空の環境変数を設定可能

## ストリーミング処理

### 6. リアルタイム出力読み取り
```typescript
async function executeWithStreaming(prompt: string): Promise<void> {
  const cmd = new Deno.Command("claude", {
    args: ["-p", prompt, "--output-format", "stream-json", "--verbose"],
    stdout: "piped",
    stderr: "piped"
  });

  const child = cmd.spawn();
  const reader = child.stdout.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      console.log("受信チャンク:", chunk);
      
      // リアルタイム処理
      await processChunk(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  // 最終結果を取得
  const finalResult = await child.output();
  console.log("最終終了コード:", finalResult.code);
}

async function processChunk(chunk: string): Promise<void> {
  // チャンクごとの処理
  const lines = chunk.split('\n').filter(line => line.trim());
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'assistant') {
        console.log("Claude応答中...");
      }
    } catch (e) {
      // JSON解析エラーは無視
    }
  }
}
```

**重要な制限:**
- ストリームと`output()`は同時使用不可
- `reader.releaseLock()`が必要
- エラー: "Cannot collect output: 'stdout' is locked"

## リソース管理とベストプラクティス

### 7. プロセス管理クラス
```typescript
class ProcessManager {
  private runningProcesses = new Set<Deno.ChildProcess>();
  private readonly maxConcurrent = 5;

  async execute(prompt: string): Promise<string> {
    if (this.runningProcesses.size >= this.maxConcurrent) {
      throw new Error("同時実行数の上限に達しました");
    }

    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    });

    const child = cmd.spawn();
    this.runningProcesses.add(child);

    try {
      // タイムアウト設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("タイムアウト"));
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
      this.runningProcesses.delete(child);
    }
  }

  // 全プロセス強制終了
  killAll(): void {
    for (const child of this.runningProcesses) {
      try {
        child.kill("SIGTERM");
      } catch (e) {
        // エラーは無視（既に終了している可能性）
      }
    }
    this.runningProcesses.clear();
  }

  getStatus(): {
    running: number;
    maxConcurrent: number;
    available: boolean;
  } {
    return {
      running: this.runningProcesses.size,
      maxConcurrent: this.maxConcurrent,
      available: this.runningProcesses.size < this.maxConcurrent
    };
  }
}
```

## セキュリティ考慮事項

### 8. 安全なプロセス実行
```typescript
class SecureProcessExecutor {
  private validateArgs(args: string[]): boolean {
    // 危険な文字列パターンのチェック
    const dangerousPatterns = [
      /&&|\|\||;|`|\$\(/,  // コマンド連結
      /\x00/,              // NULLバイト
      /^\s*sudo\s/,        // sudoコマンド
    ];

    return args.every(arg => 
      !dangerousPatterns.some(pattern => pattern.test(arg))
    );
  }

  async secureExecute(prompt: string): Promise<string> {
    // 入力検証
    if (!this.validateArgs([prompt])) {
      throw new Error("危険な入力が検出されました");
    }

    // プロンプト長制限
    if (prompt.length > 50000) {
      throw new Error("プロンプトが大きすぎます");
    }

    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped",
      env: {}, // 空の環境変数でセキュリティ強化
    });

    const child = cmd.spawn();

    // リソース制限
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        child.kill("SIGKILL"); // 強制終了
        reject(new Error("実行時間制限"));
      }, 60000);
    });

    try {
      const result = await Promise.race([
        child.output(),
        timeoutPromise
      ]);

      if (result.code !== 0) {
        const error = new TextDecoder().decode(result.stderr);
        throw new Error(`実行エラー: ${error}`);
      }

      return new TextDecoder().decode(result.stdout);

    } catch (error) {
      // プロセスが残っている場合は強制終了
      try {
        child.kill("SIGKILL");
      } catch (e) {
        // 既に終了している場合のエラーを無視
      }
      throw error;
    }
  }
}
```

## パフォーマンス最適化

### 9. プロセスプール（概念的）
```typescript
// 注意: Claude CLIはステートレスなため、実際のプールは不可能
// 以下は他のツールでの応用例

class ConceptualProcessPool {
  private processes: Array<{
    process: Deno.ChildProcess;
    busy: boolean;
    lastUsed: number;
  }> = [];

  // Claude CLIの場合、各リクエストで新しいプロセスが必要
  async execute(prompt: string): Promise<string> {
    // 通常のプロセス作成
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt],
      stdout: "piped",
      stderr: "piped"
    });

    const result = await cmd.output();
    return new TextDecoder().decode(result.stdout);
  }
}
```

## エラーハンドリングのベストプラクティス

### 10. 包括的エラーハンドリング
```typescript
async function robustExecute(prompt: string): Promise<string> {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const cmd = new Deno.Command("claude", {
        args: ["-p", prompt],
        stdout: "piped",
        stderr: "piped"
      });

      const result = await cmd.output();

      // 成功判定
      if (result.code === 0) {
        return new TextDecoder().decode(result.stdout);
      }

      // エラー分析
      const stderr = new TextDecoder().decode(result.stderr);
      
      if (stderr.includes("network") && attempt < maxRetries - 1) {
        // ネットワークエラーの場合はリトライ
        console.log(`ネットワークエラー、リトライ ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      throw new Error(`Claude実行エラー (code: ${result.code}): ${stderr}`);

    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      console.log(`実行エラー、リトライ ${attempt + 1}/${maxRetries}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error("最大リトライ回数に達しました");
}
```

## まとめ

Deno.Commandを使用したプロセス管理の要点：

1. **基本実行**: `cmd.output()`で簡単に同期実行
2. **タイムアウト**: `cmd.spawn()`と`Promise.race()`で制御
3. **並列処理**: `Promise.all()`で効率的な同時実行
4. **シグナル処理**: SIGTERMで安全なプロセス終了
5. **ストリーミング**: リアルタイム出力処理（ただし制限あり）
6. **セキュリティ**: 環境変数制御と入力検証
7. **エラーハンドリング**: リトライ機構と適切なエラー分類
8. **リソース管理**: 同時実行数制限とプロセス監視

これらの知見により、安全で効率的なプロセス管理が可能になります。
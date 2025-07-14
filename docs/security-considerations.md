# セキュリティ考慮事項調査結果

## 概要

Discord Claude Bot実装における重要なセキュリティ考慮事項を調査し、対策を検討しました。

## 1. コマンドインジェクション対策

### 脅威
- ユーザーがDiscordメッセージ内で悪意のあるコマンドを注入
- Claude Code CLIに不正な引数を渡される可能性

### 対策
```typescript
// ❌ 危険な実装例
const userInput = msg.content.replace('@botname', '').trim();
const cmd = new Deno.Command("claude", {
  args: ["-p", userInput], // 直接渡すのは危険
});

// ✅ 安全な実装例
function sanitizeInput(input: string): string {
  // 制御文字除去
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // 長さ制限
  const maxLength = 10000;
  if (cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength) + '...';
  }
  
  return cleaned;
}

function validateInput(input: string): boolean {
  // 空文字チェック
  if (!input.trim()) return false;
  
  // 危険なパターンチェック
  const dangerousPatterns = [
    /^\s*sudo\s/,           // sudoコマンド
    /^\s*rm\s+-rf/,         // 削除コマンド
    /&&|\|\||;|`|\$\(/,     // コマンド連結
    /\x00/,                 // NULLバイト
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}

// 使用例
const userInput = sanitizeInput(msg.content.replace('@botname', '').trim());
if (!validateInput(userInput)) {
  await msg.reply("❌ 無効な入力です。");
  return;
}

const cmd = new Deno.Command("claude", {
  args: ["-p", userInput],
  stdout: "piped",
  stderr: "piped"
});
```

## 2. プロセス実行セキュリティ

### 脅威
- 長時間実行によるリソース枯渇
- プロセス乗っ取り

### 対策
```typescript
class SecureProcessExecutor {
  private readonly maxExecutionTime = 60000; // 60秒
  private readonly maxConcurrentProcesses = 5;
  private runningProcesses = 0;

  async executeSecurely(prompt: string): Promise<string> {
    // 同時実行数制限
    if (this.runningProcesses >= this.maxConcurrentProcesses) {
      throw new Error("システムが忙しいため、後でお試しください。");
    }

    this.runningProcesses++;
    
    try {
      const cmd = new Deno.Command("claude", {
        args: ["-p", prompt],
        stdout: "piped",
        stderr: "piped",
        // セキュリティ強化
        env: {}, // 環境変数を空にする
      });

      const child = cmd.spawn();
      
      // タイムアウト設定
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("実行時間制限に達しました。"));
        }, this.maxExecutionTime);
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
}
```

## 3. ユーザー認証・認可

### 脅威
- 無制限なBot使用
- 機能の悪用

### 対策
```typescript
interface UserPermissions {
  canUseBot: boolean;
  maxRequestsPerHour: number;
  maxRequestLength: number;
}

class UserManager {
  private userRequests = new Map<string, number[]>();
  private blockedUsers = new Set<string>();

  getUserPermissions(userId: string, guildId?: string): UserPermissions {
    // デフォルト権限
    let permissions: UserPermissions = {
      canUseBot: true,
      maxRequestsPerHour: 10,
      maxRequestLength: 5000
    };

    // ブロックされたユーザー
    if (this.blockedUsers.has(userId)) {
      permissions.canUseBot = false;
    }

    // ギルド固有の設定
    if (guildId) {
      // ギルド管理者の場合は制限緩和
      // この部分は実際のロール確認ロジックを実装
    }

    return permissions;
  }

  checkRateLimit(userId: string, maxRequests: number): boolean {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1時間前

    // 古いリクエストを削除
    const requests = this.userRequests.get(userId) || [];
    const recentRequests = requests.filter(time => time > hourAgo);
    
    this.userRequests.set(userId, recentRequests);

    // レート制限チェック
    if (recentRequests.length >= maxRequests) {
      return false;
    }

    // 新しいリクエストを記録
    recentRequests.push(now);
    this.userRequests.set(userId, recentRequests);
    
    return true;
  }

  blockUser(userId: string, reason: string) {
    this.blockedUsers.add(userId);
    console.log(`ユーザー ${userId} をブロックしました: ${reason}`);
  }
}
```

## 4. ログ・監視

### 脅威
- セキュリティインシデントの見逃し
- 悪用パターンの検出遅れ

### 対策
```typescript
interface SecurityEvent {
  type: 'rate_limit' | 'invalid_input' | 'command_injection' | 'system_error';
  userId: string;
  guildId?: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

class SecurityLogger {
  private events: SecurityEvent[] = [];

  logEvent(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date()
    };

    this.events.push(securityEvent);
    
    // 重要度によって異なる処理
    switch (event.severity) {
      case 'high':
        console.error('🚨 [HIGH] セキュリティイベント:', securityEvent);
        // 必要に応じてアラート送信
        break;
      case 'medium':
        console.warn('⚠️ [MEDIUM] セキュリティイベント:', securityEvent);
        break;
      case 'low':
        console.log('ℹ️ [LOW] セキュリティイベント:', securityEvent);
        break;
    }

    // 古いイベントを削除（メモリ使用量制限）
    if (this.events.length > 10000) {
      this.events = this.events.slice(-5000);
    }
  }

  getRecentEvents(hours: number = 24): SecurityEvent[] {
    const cutoff = new Date(Date.now() - hours * 3600000);
    return this.events.filter(event => event.timestamp > cutoff);
  }

  detectAnomalies(): SecurityEvent[] {
    // 異常検出ロジック
    const recentEvents = this.getRecentEvents(1);
    const anomalies: SecurityEvent[] = [];

    // 同一ユーザーからの大量リクエスト
    const userCounts = new Map<string, number>();
    recentEvents.forEach(event => {
      const count = userCounts.get(event.userId) || 0;
      userCounts.set(event.userId, count + 1);
    });

    userCounts.forEach((count, userId) => {
      if (count > 50) { // 1時間に50回以上
        anomalies.push({
          type: 'rate_limit',
          userId,
          message: `異常な頻度でのリクエスト: ${count}回/時間`,
          severity: 'high',
          timestamp: new Date()
        });
      }
    });

    return anomalies;
  }
}
```

## 5. 機密情報保護

### 脅威
- API keyやトークンの漏洩
- ログへの機密情報記録

### 対策
```typescript
class SecretManager {
  private static readonly SENSITIVE_PATTERNS = [
    /discord\.gg\/[a-zA-Z0-9]+/gi,     // Discord招待リンク
    /\b[A-Za-z0-9]{24}\.[A-Za-z0-9]{6}\.[A-Za-z0-9_-]{27}\b/g, // Discordトークン
    /sk-[a-zA-Z0-9]{48}/gi,           // OpenAI APIキー
    /AKIA[0-9A-Z]{16}/gi,             // AWS アクセスキー
    /[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}[-\s]?[0-9]{4}/g, // クレジットカード番号
  ];

  static sanitizeForLogging(text: string): string {
    let sanitized = text;
    
    this.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  static detectSensitiveInfo(text: string): boolean {
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }
}

// 使用例
async function handleUserMessage(msg: Message) {
  const content = msg.content;
  
  // 機密情報チェック
  if (SecretManager.detectSensitiveInfo(content)) {
    await msg.reply("⚠️ メッセージに機密情報が含まれている可能性があります。内容を確認してください。");
    
    securityLogger.logEvent({
      type: 'invalid_input',
      userId: msg.author.id,
      guildId: msg.guildId,
      message: 'メッセージに機密情報を検出',
      severity: 'medium'
    });
    return;
  }

  // ログ記録（機密情報をマスク）
  console.log('処理中のメッセージ:', SecretManager.sanitizeForLogging(content));
}
```

## 6. エラー情報の安全な処理

### 脅威
- エラーメッセージを通じた情報漏洩
- スタックトレースの露出

### 対策
```typescript
class SafeErrorHandler {
  static sanitizeError(error: Error): string {
    const message = error.message;
    
    // システムパスを隠す
    const sanitized = message
      .replace(/\/home\/[^\/\s]+/g, '[USER_HOME]')
      .replace(/\/tmp\/[^\/\s]+/g, '[TEMP_DIR]')
      .replace(/file:\/\/\/[^\s]+/g, '[FILE_PATH]');

    return sanitized;
  }

  static async handleError(error: Error, msg: Message, context: string) {
    // 詳細ログ（サーバー側のみ）
    console.error(`[${context}] エラー発生:`, {
      message: error.message,
      stack: error.stack,
      userId: msg.author.id,
      timestamp: new Date().toISOString()
    });

    // ユーザーへの安全なエラーメッセージ
    const userMessage = this.sanitizeError(error);
    const safeMessage = userMessage.length > 500 
      ? "システムエラーが発生しました。管理者にお問い合わせください。"
      : `❌ エラー: ${userMessage}`;

    await msg.reply(safeMessage);

    // セキュリティログ
    securityLogger.logEvent({
      type: 'system_error',
      userId: msg.author.id,
      guildId: msg.guildId,
      message: `${context}でエラー発生: ${this.sanitizeError(error)}`,
      severity: 'medium'
    });
  }
}
```

## 7. 統合セキュリティチェック

```typescript
class SecurityMiddleware {
  constructor(
    private userManager: UserManager,
    private securityLogger: SecurityLogger,
    private processExecutor: SecureProcessExecutor
  ) {}

  async validateRequest(msg: Message): Promise<boolean> {
    const userId = msg.author.id;
    const guildId = msg.guildId;
    const content = msg.content;

    // 1. ユーザー権限チェック
    const permissions = this.userManager.getUserPermissions(userId, guildId);
    if (!permissions.canUseBot) {
      await msg.reply("❌ Bot使用権限がありません。");
      return false;
    }

    // 2. レート制限チェック
    if (!this.userManager.checkRateLimit(userId, permissions.maxRequestsPerHour)) {
      await msg.reply("⏱️ 使用制限に達しました。1時間後にお試しください。");
      this.securityLogger.logEvent({
        type: 'rate_limit',
        userId,
        guildId,
        message: 'レート制限に達しました',
        severity: 'low'
      });
      return false;
    }

    // 3. 入力長制限
    if (content.length > permissions.maxRequestLength) {
      await msg.reply(`❌ メッセージが長すぎます（最大${permissions.maxRequestLength}文字）。`);
      return false;
    }

    // 4. 機密情報チェック
    if (SecretManager.detectSensitiveInfo(content)) {
      await msg.reply("⚠️ 機密情報が含まれている可能性があります。");
      this.securityLogger.logEvent({
        type: 'invalid_input',
        userId,
        guildId,
        message: '機密情報を検出',
        severity: 'medium'
      });
      return false;
    }

    // 5. 入力検証
    const cleanInput = sanitizeInput(content);
    if (!validateInput(cleanInput)) {
      await msg.reply("❌ 無効な入力です。");
      this.securityLogger.logEvent({
        type: 'command_injection',
        userId,
        guildId,
        message: '危険な入力パターンを検出',
        severity: 'high'
      });
      return false;
    }

    return true;
  }
}
```

## 推奨実装パターン

1. **入力検証**: すべてのユーザー入力を検証・サニタイズ
2. **レート制限**: ユーザー別・時間別の使用制限
3. **プロセス制御**: 実行時間・同時実行数制限
4. **ログ監視**: セキュリティイベントの記録・分析
5. **エラー処理**: 機密情報を含まない安全なエラーメッセージ
6. **権限管理**: ユーザー・ギルド別の権限制御

これらのセキュリティ対策を実装することで、安全なDiscord Claude Botの運用が可能になります。
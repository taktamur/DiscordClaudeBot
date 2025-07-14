# パフォーマンス最適化調査結果

## 概要

Discord Claude Bot の高いパフォーマンスを実現するための最適化手法を調査しました。

## 1. プロセス実行最適化

### 1-1. プロセスプール
```typescript
class ProcessPool {
  private readonly maxPoolSize = 3;
  private readonly pool: Array<{
    process: Deno.ChildProcess;
    busy: boolean;
    lastUsed: number;
  }> = [];

  async execute(prompt: string): Promise<string> {
    const worker = await this.getAvailableWorker();
    
    try {
      worker.busy = true;
      const result = await this.sendRequest(worker.process, prompt);
      worker.lastUsed = Date.now();
      return result;
    } finally {
      worker.busy = false;
    }
  }

  private async getAvailableWorker() {
    // 利用可能なワーカーを探す
    let worker = this.pool.find(w => !w.busy);
    
    if (!worker && this.pool.length < this.maxPoolSize) {
      // 新しいワーカーを作成
      worker = await this.createWorker();
      this.pool.push(worker);
    }
    
    if (!worker) {
      // すべてのワーカーが使用中の場合は待機
      await this.waitForAvailableWorker();
      return this.getAvailableWorker();
    }
    
    return worker;
  }

  private async createWorker() {
    // 長時間実行プロセスとしてClaudeを起動（仮想的な実装）
    // 実際のClaude CLIは一回限りの実行のため、この手法は使用できない
    // ここでは概念的な実装例を示す
    
    return {
      process: null as any, // 実際の実装では適切なプロセスオブジェクト
      busy: false,
      lastUsed: Date.now()
    };
  }

  private async waitForAvailableWorker(): Promise<void> {
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.pool.some(w => !w.busy)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  private async sendRequest(process: Deno.ChildProcess, prompt: string): Promise<string> {
    // プロセス間通信でリクエスト送信（仮想的な実装）
    // Claude CLIの場合は、各リクエストごとに新しいプロセスを起動する必要がある
    throw new Error("Claude CLIでは実装不可");
  }

  // プール清掃（古いワーカーの終了）
  cleanup(): void {
    const now = Date.now();
    const timeout = 300000; // 5分

    this.pool.forEach((worker, index) => {
      if (!worker.busy && now - worker.lastUsed > timeout) {
        try {
          // worker.process.kill();
        } catch (e) {
          // エラーは無視
        }
        this.pool.splice(index, 1);
      }
    });
  }
}
```

### 1-2. キャッシュシステム
```typescript
class ResponseCache {
  private cache = new Map<string, {
    response: string;
    timestamp: number;
    hitCount: number;
  }>();
  
  private readonly maxCacheSize = 1000;
  private readonly cacheTTL = 3600000; // 1時間

  async get(prompt: string): Promise<string | null> {
    const key = this.generateKey(prompt);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // TTL チェック
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    
    // ヒット数更新
    cached.hitCount++;
    
    return cached.response;
  }

  set(prompt: string, response: string): void {
    const key = this.generateKey(prompt);
    
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLeastUsed();
    }
    
    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hitCount: 1
    });
  }

  private generateKey(prompt: string): string {
    // プロンプトの正規化とハッシュ化
    const normalized = prompt.trim().toLowerCase().replace(/\s+/g, ' ');
    
    // シンプルなハッシュ関数（実際にはcrypto.subtle.digestを使用推奨）
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    return hash.toString(36);
  }

  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastHitCount = Infinity;
    let oldestTimestamp = Infinity;
    
    for (const [key, value] of this.cache.entries()) {
      if (value.hitCount < leastHitCount || 
          (value.hitCount === leastHitCount && value.timestamp < oldestTimestamp)) {
        leastUsedKey = key;
        leastHitCount = value.hitCount;
        oldestTimestamp = value.timestamp;
      }
    }
    
    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
    }
  }

  // キャッシュ統計
  getStats(): {
    size: number;
    hitRate: number;
    totalHits: number;
    totalRequests: number;
  } {
    const totalHits = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.hitCount, 0);
    
    const totalRequests = this.totalRequests || totalHits;
    
    return {
      size: this.cache.size,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      totalHits,
      totalRequests
    };
  }

  // キャッシュクリア
  clear(): void {
    this.cache.clear();
  }

  // 定期清掃
  startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
        }
      }
    }, 600000); // 10分ごと
  }

  private totalRequests = 0;
  
  // リクエスト統計用
  incrementRequestCount(): void {
    this.totalRequests++;
  }
}
```

## 2. メモリ管理最適化

### 2-1. ストリーミング処理
```typescript
class StreamingProcessor {
  async processLargeResponse(
    channel: any, 
    prompt: string,
    onProgress?: (chunk: string) => void
  ): Promise<void> {
    const cmd = new Deno.Command("claude", {
      args: ["-p", prompt, "--output-format", "stream-json", "--verbose"],
      stdout: "piped",
      stderr: "piped"
    });

    const child = cmd.spawn();
    const reader = child.stdout.getReader();
    const decoder = new TextDecoderStream();
    
    let accumulatedResponse = "";
    let lastSentLength = 0;
    
    try {
      const readableStream = new ReadableStream({
        start(controller) {
          const pump = async (): Promise<void> => {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              return;
            }
            
            controller.enqueue(value);
            await pump();
          };
          
          return pump();
        }
      });

      const stream = readableStream.pipeThrough(decoder);
      const streamReader = stream.getReader();
      
      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;

        // JSON行をパース
        const lines = value.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.type === 'assistant' && data.message?.content) {
              const content = data.message.content;
              if (Array.isArray(content)) {
                for (const item of content) {
                  if (item.type === 'text') {
                    accumulatedResponse += item.text;
                  }
                }
              }
            }
            
            // 進行状況の通知
            if (onProgress && accumulatedResponse.length > lastSentLength + 500) {
              onProgress(accumulatedResponse.slice(lastSentLength));
              lastSentLength = accumulatedResponse.length;
            }
          } catch (parseError) {
            // JSON解析エラーは無視
          }
        }
      }

      // 最終結果を送信
      if (accumulatedResponse) {
        await this.sendMessage(channel, accumulatedResponse);
      }

    } finally {
      reader.releaseLock();
      
      try {
        const finalResult = await child.output();
        if (finalResult.code !== 0) {
          const error = new TextDecoder().decode(finalResult.stderr);
          throw new Error(`Claude execution failed: ${error}`);
        }
      } catch (error) {
        // 既にプロセスが終了している場合のエラーを処理
      }
    }
  }

  private async sendMessage(channel: any, content: string): Promise<void> {
    const chunks = this.splitMessage(content, 1900);
    
    for (let i = 0; i < chunks.length; i++) {
      const message = chunks.length > 1 
        ? `[${i + 1}/${chunks.length}] ${chunks[i]}`
        : chunks[i];
      
      await channel.send(message);
      
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  }

  private splitMessage(text: string, maxLength: number): string[] {
    // メッセージ分割ロジック（既存の実装を使用）
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + maxLength;
      
      if (end < text.length) {
        // 単語境界で分割
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    
    return chunks;
  }
}
```

### 2-2. リソース監視
```typescript
class ResourceMonitor {
  private memoryUsage: number[] = [];
  private cpuUsage: number[] = [];
  private readonly maxSamples = 100;

  startMonitoring(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 5000); // 5秒ごと
  }

  private collectMetrics(): void {
    // Denoのメモリ使用量取得
    const memInfo = Deno.memoryUsage();
    const memoryMB = memInfo.heapUsed / 1024 / 1024;
    
    this.memoryUsage.push(memoryMB);
    if (this.memoryUsage.length > this.maxSamples) {
      this.memoryUsage.shift();
    }

    // CPU使用量は直接取得できないため、処理時間で代替
    const cpuProxy = this.calculateCpuProxy();
    this.cpuUsage.push(cpuProxy);
    if (this.cpuUsage.length > this.maxSamples) {
      this.cpuUsage.shift();
    }

    // 閾値チェック
    this.checkThresholds(memoryMB, cpuProxy);
  }

  private calculateCpuProxy(): number {
    // 簡単なCPU負荷の代替指標
    const start = performance.now();
    let counter = 0;
    const end = start + 10; // 10ms間計算
    
    while (performance.now() < end) {
      counter++;
    }
    
    return counter / 100000; // 正規化
  }

  private checkThresholds(memory: number, cpu: number): void {
    const memoryThreshold = 512; // 512MB
    const cpuThreshold = 0.8; // 80%相当
    
    if (memory > memoryThreshold) {
      console.warn(`⚠️ メモリ使用量が閾値を超過: ${memory.toFixed(2)}MB`);
      this.triggerGarbageCollection();
    }
    
    if (cpu > cpuThreshold) {
      console.warn(`⚠️ CPU使用量が高負荷: ${(cpu * 100).toFixed(1)}%相当`);
    }
  }

  private triggerGarbageCollection(): void {
    // 手動でガベージコレクション（可能な場合）
    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
    }
  }

  getStats(): {
    memory: { current: number; average: number; peak: number };
    cpu: { current: number; average: number; peak: number };
  } {
    const memCurrent = this.memoryUsage[this.memoryUsage.length - 1] || 0;
    const memAverage = this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length || 0;
    const memPeak = Math.max(...this.memoryUsage) || 0;
    
    const cpuCurrent = this.cpuUsage[this.cpuUsage.length - 1] || 0;
    const cpuAverage = this.cpuUsage.reduce((a, b) => a + b, 0) / this.cpuUsage.length || 0;
    const cpuPeak = Math.max(...this.cpuUsage) || 0;
    
    return {
      memory: {
        current: memCurrent,
        average: memAverage,
        peak: memPeak
      },
      cpu: {
        current: cpuCurrent,
        average: cpuAverage,
        peak: cpuPeak
      }
    };
  }
}
```

## 3. ネットワーク最適化

### 3-1. 接続プール
```typescript
class ConnectionPool {
  private connections: Map<string, {
    client: any;
    lastUsed: number;
    inUse: boolean;
  }> = new Map();
  
  private readonly maxConnections = 10;
  private readonly connectionTimeout = 300000; // 5分

  async getConnection(guildId: string): Promise<any> {
    const existing = this.connections.get(guildId);
    
    if (existing && !existing.inUse) {
      existing.inUse = true;
      existing.lastUsed = Date.now();
      return existing.client;
    }
    
    if (this.connections.size >= this.maxConnections) {
      await this.waitForAvailableConnection();
      return this.getConnection(guildId);
    }
    
    // 新しい接続を作成（Discord APIクライアント用）
    const client = await this.createConnection(guildId);
    
    this.connections.set(guildId, {
      client,
      lastUsed: Date.now(),
      inUse: true
    });
    
    return client;
  }

  releaseConnection(guildId: string): void {
    const connection = this.connections.get(guildId);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  private async createConnection(guildId: string): Promise<any> {
    // Discord API接続の作成（実装は使用するライブラリに依存）
    return {};
  }

  private async waitForAvailableConnection(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        const available = Array.from(this.connections.values())
          .some(conn => !conn.inUse);
        
        if (available) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  // 古い接続のクリーンアップ
  cleanup(): void {
    const now = Date.now();
    
    for (const [guildId, connection] of this.connections.entries()) {
      if (!connection.inUse && 
          now - connection.lastUsed > this.connectionTimeout) {
        try {
          // connection.client.destroy();
        } catch (e) {
          // エラーは無視
        }
        this.connections.delete(guildId);
      }
    }
  }

  startCleanupTimer(): void {
    setInterval(() => this.cleanup(), 60000); // 1分ごと
  }
}
```

### 3-2. リクエスト最適化
```typescript
class RequestOptimizer {
  private requestQueue = new Map<string, Array<{
    resolve: Function;
    reject: Function;
    prompt: string;
    timestamp: number;
  }>>();
  
  private processing = new Set<string>();
  private readonly batchDelay = 100; // 100ms以内のリクエストをバッチ処理

  async optimizedRequest(userId: string, prompt: string): Promise<string> {
    // 重複リクエストのバッチ処理
    if (this.hasPendingRequest(userId, prompt)) {
      return this.joinPendingRequest(userId, prompt);
    }
    
    return new Promise((resolve, reject) => {
      if (!this.requestQueue.has(userId)) {
        this.requestQueue.set(userId, []);
      }
      
      this.requestQueue.get(userId)!.push({
        resolve,
        reject,
        prompt,
        timestamp: Date.now()
      });
      
      // バッチ処理の開始
      setTimeout(() => this.processBatch(userId), this.batchDelay);
    });
  }

  private hasPendingRequest(userId: string, prompt: string): boolean {
    const queue = this.requestQueue.get(userId);
    if (!queue) return false;
    
    return queue.some(req => 
      req.prompt === prompt && 
      Date.now() - req.timestamp < this.batchDelay
    );
  }

  private async joinPendingRequest(userId: string, prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueue.get(userId)!;
      const existing = queue.find(req => req.prompt === prompt);
      
      if (existing) {
        // 既存のリクエストに相乗り
        const originalResolve = existing.resolve;
        existing.resolve = (result: string) => {
          originalResolve(result);
          resolve(result);
        };
        
        const originalReject = existing.reject;
        existing.reject = (error: Error) => {
          originalReject(error);
          reject(error);
        };
      } else {
        reject(new Error("Pending request not found"));
      }
    });
  }

  private async processBatch(userId: string): Promise<void> {
    if (this.processing.has(userId)) {
      return;
    }
    
    this.processing.add(userId);
    
    try {
      const queue = this.requestQueue.get(userId);
      if (!queue || queue.length === 0) {
        return;
      }
      
      // 重複するプロンプトをグループ化
      const groups = new Map<string, typeof queue>();
      
      for (const request of queue) {
        if (!groups.has(request.prompt)) {
          groups.set(request.prompt, []);
        }
        groups.get(request.prompt)!.push(request);
      }
      
      // 各グループを並列処理
      const promises = Array.from(groups.entries()).map(
        ([prompt, requests]) => this.executeGroupRequest(prompt, requests)
      );
      
      await Promise.all(promises);
      
      // キューをクリア
      this.requestQueue.delete(userId);
      
    } finally {
      this.processing.delete(userId);
    }
  }

  private async executeGroupRequest(
    prompt: string, 
    requests: Array<{resolve: Function, reject: Function}>
  ): Promise<void> {
    try {
      // Claude実行（1回のみ）
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
      
      const response = new TextDecoder().decode(result.stdout);
      
      // 全てのリクエストに同じ結果を返す
      requests.forEach(req => req.resolve(response));
      
    } catch (error) {
      // 全てのリクエストにエラーを返す
      requests.forEach(req => req.reject(error));
    }
  }
}
```

## 4. 統合パフォーマンスマネージャー

```typescript
class PerformanceManager {
  constructor(
    private cache: ResponseCache,
    private resourceMonitor: ResourceMonitor,
    private connectionPool: ConnectionPool,
    private requestOptimizer: RequestOptimizer,
    private streamingProcessor: StreamingProcessor
  ) {}

  async handleOptimizedRequest(
    msg: any, 
    prompt: string
  ): Promise<void> {
    const startTime = performance.now();
    const userId = msg.author.id;
    
    try {
      // 1. キャッシュチェック
      this.cache.incrementRequestCount();
      const cached = await this.cache.get(prompt);
      
      if (cached) {
        await msg.reply(cached);
        this.logPerformance('cache_hit', performance.now() - startTime);
        return;
      }
      
      // 2. リソース状況確認
      const stats = this.resourceMonitor.getStats();
      if (stats.memory.current > 400) { // 400MB以上
        await msg.reply("⚠️ システム負荷が高いため、処理を制限しています。");
        return;
      }
      
      // 3. リクエスト最適化（バッチ処理）
      const response = await this.requestOptimizer.optimizedRequest(userId, prompt);
      
      // 4. レスポンスキャッシュ
      this.cache.set(prompt, response);
      
      // 5. ストリーミング送信（長文の場合）
      if (response.length > 1000) {
        await this.streamingProcessor.processLargeResponse(msg.channel, prompt);
      } else {
        await msg.reply(response);
      }
      
      this.logPerformance('request_completed', performance.now() - startTime);
      
    } catch (error) {
      this.logPerformance('request_failed', performance.now() - startTime);
      throw error;
    }
  }

  private logPerformance(type: string, duration: number): void {
    console.log(`📊 [${type}] 処理時間: ${duration.toFixed(2)}ms`);
    
    // パフォーマンス統計の収集
    this.collectPerformanceStats(type, duration);
  }

  private performanceStats = new Map<string, number[]>();
  
  private collectPerformanceStats(type: string, duration: number): void {
    if (!this.performanceStats.has(type)) {
      this.performanceStats.set(type, []);
    }
    
    const stats = this.performanceStats.get(type)!;
    stats.push(duration);
    
    // 最新100件のみ保持
    if (stats.length > 100) {
      stats.shift();
    }
  }

  getPerformanceReport(): Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  }> {
    const report: Record<string, any> = {};
    
    for (const [type, durations] of this.performanceStats.entries()) {
      if (durations.length === 0) continue;
      
      const sorted = [...durations].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      
      report[type] = {
        count: durations.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p95: sorted[p95Index] || 0
      };
    }
    
    return report;
  }

  // システム全体の最適化
  async optimizeSystem(): Promise<void> {
    // 1. キャッシュ最適化
    const cacheStats = this.cache.getStats();
    if (cacheStats.hitRate < 0.3) { // ヒット率30%未満
      console.log("⚡ キャッシュヒット率が低下しています。TTLを調整します。");
      // キャッシュ設定の動的調整
    }
    
    // 2. メモリ最適化
    const resourceStats = this.resourceMonitor.getStats();
    if (resourceStats.memory.current > 300) {
      console.log("🧹 メモリ使用量が高いため、クリーンアップを実行します。");
      this.cache.clear();
      this.connectionPool.cleanup();
      
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }
    }
    
    // 3. 接続プール最適化
    this.connectionPool.cleanup();
  }

  startOptimizationTimer(): void {
    // 5分ごとに最適化を実行
    setInterval(() => {
      this.optimizeSystem();
    }, 300000);
  }
}
```

## 5. 運用指標とモニタリング

```typescript
class MetricsCollector {
  private metrics = {
    requestsPerSecond: 0,
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    concurrentUsers: 0
  };

  private requestCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  updateMetrics(
    responseTime: number,
    isError: boolean,
    isCache: boolean,
    memoryUsage: number,
    concurrentUsers: number
  ): void {
    this.requestCount++;
    if (isError) this.errorCount++;

    const now = Date.now();
    const uptimeSeconds = (now - this.startTime) / 1000;

    this.metrics = {
      requestsPerSecond: this.requestCount / uptimeSeconds,
      averageResponseTime: responseTime,
      errorRate: this.errorCount / this.requestCount,
      cacheHitRate: isCache ? 1 : 0, // 実際は累積で計算
      memoryUsage,
      concurrentUsers
    };
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  // Prometheus形式でのメトリクス出力
  exportPrometheusMetrics(): string {
    return `
# HELP discord_bot_requests_total Total number of requests
# TYPE discord_bot_requests_total counter
discord_bot_requests_total ${this.requestCount}

# HELP discord_bot_errors_total Total number of errors
# TYPE discord_bot_errors_total counter
discord_bot_errors_total ${this.errorCount}

# HELP discord_bot_memory_usage_bytes Memory usage in bytes
# TYPE discord_bot_memory_usage_bytes gauge
discord_bot_memory_usage_bytes ${this.metrics.memoryUsage * 1024 * 1024}

# HELP discord_bot_response_time_seconds Response time in seconds
# TYPE discord_bot_response_time_seconds gauge
discord_bot_response_time_seconds ${this.metrics.averageResponseTime / 1000}
    `.trim();
  }
}
```

## まとめ

Discord Claude Bot のパフォーマンス最適化の主要な手法：

1. **プロセス実行最適化**: キャッシュシステム、バッチ処理
2. **メモリ管理**: ストリーミング処理、リソース監視、ガベージコレクション
3. **ネットワーク最適化**: 接続プール、リクエストバッチング
4. **統合管理**: パフォーマンスマネージャー、メトリクス収集
5. **運用監視**: リアルタイム監視、自動最適化

これらの最適化により、高負荷環境でも安定したパフォーマンスを維持できます。
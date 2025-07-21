/**
 * Discord Claude Bot のE2Eテスト実行クラス
 * 専用の呼び出しBotを使ってメインBotの機能をEnd-to-Endテストで実行します
 */

import { Client, GatewayIntents, Message, TextChannel } from "../deps.ts";
import { CONFIG } from "../src/config.ts";
import { Logger } from "../src/utils/logger.ts";

/**
 * E2Eテストシナリオの定義
 */
interface E2ETestScenario {
  name: string;
  message: string;
  expectedPattern?: RegExp;
  timeoutMs: number;
}

/**
 * E2Eテスト結果の定義
 */
interface E2ETestResult {
  scenario: string;
  success: boolean;
  responseTime: number;
  error?: string;
  response?: string;
}

/**
 * Discord Bot のE2Eテスト実行クラス
 * 呼び出しBotを使ってメインBotの機能をテストします
 */
export class E2ETestRunner {
  private mainClient: Client; // メインBot（応答を受信）
  private callerClient: Client | null = null; // 呼び出しBot（メンション送信）
  private logger: Logger;
  private testResults: E2ETestResult[] = [];
  private currentTestId: string | null = null;
  private responseWaiter: {
    resolve: (value: string) => void;
    reject: (reason: string) => void;
  } | null = null;

  /**
   * デフォルトのE2Eテストシナリオ
   */
  private readonly DEFAULT_SCENARIOS: E2ETestScenario[] = [
    {
      name: "基本応答E2Eテスト",
      message: "こんにちは",
      timeoutMs: 30000, // 30秒
    },
    {
      name: "Claude連携E2Eテスト",
      message: "2+2は？",
      expectedPattern: /4/,
      timeoutMs: 60000, // 60秒（Claude実行時間考慮）
    },
    {
      name: "短文処理E2Eテスト",
      message: "さようなら",
      timeoutMs: 60000, // 60秒に延長
    },
  ];

  constructor(mainClient: Client) {
    this.mainClient = mainClient;
    this.logger = new Logger();
    this.setupMessageListener();
  }

  /**
   * メインBotからの応答を監視するリスナーを設定
   */
  private setupMessageListener(): void {
    this.mainClient.on("messageCreate", (msg: Message) => {
      // メインBotのメッセージかつ、テスト実行中の場合
      if (msg.author.id === this.mainClient.user?.id && this.responseWaiter) {
        this.responseWaiter.resolve(msg.content);
        this.responseWaiter = null;
      }
    });
  }

  /**
   * 呼び出しBotを初期化
   */
  private async initializeCallerBot(): Promise<void> {
    const callerToken = Deno.env.get("CALLER_BOT_TOKEN");
    if (!callerToken) {
      throw new Error(
        "CALLER_BOT_TOKEN environment variable is required for E2E testing",
      );
    }

    this.callerClient = new Client({
      intents: [
        GatewayIntents.GUILDS,
        GatewayIntents.GUILD_MESSAGES,
        GatewayIntents.MESSAGE_CONTENT,
      ],
    });

    await this.callerClient.connect(callerToken);
    this.logger.info("呼び出しBotが正常に接続されました");
  }

  /**
   * 呼び出しBotを終了
   */
  private async cleanupCallerBot(): Promise<void> {
    if (this.callerClient) {
      await this.callerClient.destroy();
      this.callerClient = null;
      this.logger.info("呼び出しBotを終了しました");
    }
  }

  /**
   * E2Eテストスイートを実行
   * @param scenarios 実行するE2Eテストシナリオ（省略時はデフォルトシナリオ）
   */
  async runE2ETests(
    scenarios: E2ETestScenario[] = this.DEFAULT_SCENARIOS,
  ): Promise<E2ETestResult[]> {
    this.logger.info("E2Eテストスイートを開始します");

    try {
      // 呼び出しBotを初期化
      await this.initializeCallerBot();

      // 少し待機してBotが完全に起動するのを待つ
      await this.delay(2000);

      const channel = await this.getTestChannel();
      if (!channel) {
        throw new Error("テストチャンネルが見つかりません");
      }

      this.testResults = [];

      for (const scenario of scenarios) {
        this.logger.info(`E2Eテスト実行中: ${scenario.name}`);
        const result = await this.runSingleE2ETest(channel, scenario);
        this.testResults.push(result);

        // テスト間のインターバル（レート制限回避）
        await this.delay(2000);
      }

      this.generateReport();
      return this.testResults;
    } finally {
      // 呼び出しBotを終了
      await this.cleanupCallerBot();
    }
  }

  /**
   * E2Eテストチャンネルを取得（呼び出しBot経由）
   */
  private async getTestChannel(): Promise<TextChannel | null> {
    if (!this.callerClient) {
      throw new Error("呼び出しBotが初期化されていません");
    }

    try {
      const channel = await this.callerClient.channels.fetch(
        CONFIG.TEST_CHANNEL_ID,
      );
      if (channel && channel.type === 0) { // GUILD_TEXT
        return channel as TextChannel;
      }
    } catch (error) {
      this.logger.error(`E2Eテストチャンネルの取得に失敗: ${error}`);
    }
    return null;
  }

  /**
   * 単一のE2Eテストシナリオを実行
   */
  private async runSingleE2ETest(
    channel: TextChannel,
    scenario: E2ETestScenario,
  ): Promise<E2ETestResult> {
    if (!this.callerClient) {
      throw new Error("呼び出しBotが初期化されていません");
    }

    const startTime = Date.now();

    try {
      // メインBotにメンション付きメッセージを送信（呼び出しBot経由）
      const mentionMessage =
        `<@${this.mainClient.user?.id}> ${scenario.message}`;
      this.currentTestId = `test_${Date.now()}`;

      await channel.send(mentionMessage);

      // メインBotからの応答を待機
      const response = await this.waitForResponse(scenario.timeoutMs);
      const responseTime = Date.now() - startTime;

      // 応答パターンの検証
      const success = scenario.expectedPattern
        ? scenario.expectedPattern.test(response)
        : response.length > 0;

      return {
        scenario: scenario.name,
        success,
        responseTime,
        response: response.substring(0, 100), // 最初の100文字のみ記録
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        scenario: scenario.name,
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * ボットからの応答を待機
   */
  private waitForResponse(timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.responseWaiter = { resolve, reject };

      setTimeout(() => {
        if (this.responseWaiter) {
          this.responseWaiter.reject("タイムアウト");
          this.responseWaiter = null;
        }
      }, timeoutMs);
    });
  }

  /**
   * 指定時間待機
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * E2Eテスト結果レポートを生成・出力
   */
  private generateReport(): void {
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter((r) => r.success).length;
    const failedTests = totalTests - successfulTests;

    this.logger.info("=".repeat(50));
    this.logger.info("E2Eテスト結果レポート");
    this.logger.info("=".repeat(50));
    this.logger.info(`総テスト数: ${totalTests}`);
    this.logger.info(`成功: ${successfulTests}`);
    this.logger.info(`失敗: ${failedTests}`);
    this.logger.info(
      `成功率: ${((successfulTests / totalTests) * 100).toFixed(1)}%`,
    );
    this.logger.info("-".repeat(50));

    for (const result of this.testResults) {
      const status = result.success ? "✅ 成功" : "❌ 失敗";
      this.logger.info(
        `${status} ${result.scenario} (${result.responseTime}ms)`,
      );

      if (result.error) {
        this.logger.info(`  エラー: ${result.error}`);
      }

      if (result.response) {
        this.logger.info(`  応答: ${result.response}`);
      }
    }

    this.logger.info("=".repeat(50));
  }

  /**
   * E2Eテスト実行の成功判定
   */
  isAllE2ETestsPassed(): boolean {
    return this.testResults.every((result) => result.success);
  }
}

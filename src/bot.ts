import { Client, GatewayIntents, Message } from "../deps.ts";
import { CONFIG } from "./config.ts";
import { ClaudeExecutor } from "./claude/executor.ts";
import { MessageProcessor } from "./discord/message-processor.ts";
import { Logger } from "./utils/logger.ts";
import { MessageProcessingRules } from "./rules/MessageProcessingRules.ts";

/**
 * Discord Claude Bot のメインクラス
 * Discord に接続してメンションを監視し、Claude Code との連携を行います
 */
export class DiscordBot {
  /** Discord クライアントインスタンス */
  private client: Client;
  /** Claude Code 実行部 */
  private claudeExecutor: ClaudeExecutor;
  /** Discord メッセージ処理部 */
  private messageProcessor: MessageProcessor;
  /** ログ出力部 */
  private logger: Logger;
  /** メッセージ処理判定ルール */
  private messageRules: MessageProcessingRules;
  /** テストモードフラグ */
  private isTestMode: boolean = false;
  /** 処理中のメッセージIDを追跡（重複防止用） */
  private processingMessages = new Set<string>();
  /** 最後のメッセージ送信時刻（レート制限用） */
  private lastMessageTime = 0;

  /**
   * DiscordBot のコンストラクタ
   * 各コンポーネントを初期化し、イベントハンドラーを設定します
   */
  constructor() {
    // Discord クライアントの初期化（必要な権限を指定）
    this.client = new Client({
      intents: [
        GatewayIntents.GUILDS, // サーバー情報の取得
        GatewayIntents.GUILD_MESSAGES, // メッセージの受信
        GatewayIntents.MESSAGE_CONTENT, // メッセージ内容の取得（2022年以降必須）
      ],
    });
    this.claudeExecutor = new ClaudeExecutor();
    this.messageProcessor = new MessageProcessor();
    this.logger = new Logger();

    // メッセージ処理ルールを初期化（botIdは後でupdateBotIdで設定）
    this.messageRules = new MessageProcessingRules(
      "",
      this.isTestMode,
      this.logger,
    );

    this.setupEventHandlers();
  }

  /**
   * Discord イベントハンドラーの設定
   * ボットのログイン完了とメッセージ受信イベントを監視します
   */
  private setupEventHandlers(): void {
    // ボット起動完了時の処理
    this.client.on("ready", () => {
      this.logger.info(
        `ボットが${this.client.user?.username}としてログインしました`,
      );
    });

    // メッセージ受信時の処理
    this.client.on("messageCreate", async (msg: Message) => {
      this.logger.info(
        `メッセージ受信: ${msg.author.username}: ${
          msg.content.substring(0, 50)
        }...`,
      );

      // 重複処理防止チェック
      if (this.processingMessages.has(msg.id)) {
        this.logger.info("既に処理中のメッセージのためスキップ");
        return;
      }

      // botIdを最新の状態に更新
      const botId = this.client.user?.id || "";
      this.messageRules.updateBotId(botId);

      if (this.messageRules.shouldProcess(msg)) {
        this.logger.info("メンション検知 - 処理開始");
        await this.handleMention(msg);
      } else {
        this.logger.info("メンション対象外 - 処理スキップ");
      }
    });
  }

  /**
   * ボットへのメンション処理のメインロジック
   * スレッド履歴取得 → Claude Code 実行 → 応答送信の流れを実行します
   * @param msg メンション元のメッセージ
   */
  private async handleMention(msg: Message): Promise<void> {
    // 処理中としてマーク
    this.processingMessages.add(msg.id);

    try {
      this.logger.info(`${msg.author.username}からのメンションを処理中`);

      // レート制限チェック
      await this.enforceRateLimit();

      // 1. スレッドの会話履歴を取得
      const context = await this.messageProcessor.getThreadHistory(msg);

      // 2. Claude Code 用のプロンプトを構築
      const prompt = this.messageProcessor.buildPrompt(context);

      // 3. Claude Code を実行して応答を取得
      const response = await this.claudeExecutor.execute(prompt);

      // 4. Discord に応答を送信（分割投稿対応）
      await this.messageProcessor.sendResponse(msg, response);
      this.lastMessageTime = Date.now();
    } catch (error) {
      this.logger.error(`メンション処理エラー: ${error}`);
      try {
        await this.enforceRateLimit();

        // エラーの種類に応じてより詳細なメッセージを提供
        let errorMessage =
          "エラーが発生しました。しばらく時間をおいて再度お試しください。";

        if (error instanceof Error) {
          if (error.message.includes("timed out")) {
            errorMessage =
              "処理がタイムアウトしました。もう少し簡単な質問でお試しください。";
          } else if (error.message.includes("Claude execution failed")) {
            errorMessage =
              "Claude Code の実行でエラーが発生しました。システム管理者にお問い合わせください。";
          } else if (error.message.includes("rate limit")) {
            errorMessage =
              "リクエストが多すぎます。しばらく待ってから再度お試しください。";
          }

          // 詳細なエラー情報を追加
          errorMessage += `\n\n詳細: ${error.message}`;
        }

        await msg.reply(errorMessage);
        this.lastMessageTime = Date.now();
      } catch (replyError) {
        this.logger.error(`エラー応答の送信に失敗: ${replyError}`);
      }
    } finally {
      // 処理完了後にマークを削除
      this.processingMessages.delete(msg.id);
    }
  }

  /**
   * レート制限を強制する
   * 前回のメッセージ送信から一定時間経過していない場合は待機
   */
  private async enforceRateLimit(): Promise<void> {
    const minInterval = 1000 / CONFIG.RATE_LIMIT_MESSAGES_PER_SECOND;
    const elapsed = Date.now() - this.lastMessageTime;

    if (elapsed < minInterval) {
      const waitTime = minInterval - elapsed;
      this.logger.info(`レート制限のため ${waitTime}ms 待機中`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * ボットを起動して Discord に接続
   * 環境変数 DISCORD_BOT_TOKEN が設定されている必要があります
   */
  async start(): Promise<void> {
    await this.client.connect(CONFIG.DISCORD_TOKEN, [
      GatewayIntents.GUILDS,
      GatewayIntents.GUILD_MESSAGES,
      GatewayIntents.MESSAGE_CONTENT,
    ]);
  }

  /**
   * ボットを停止して Discord から切断
   */
  async stop(): Promise<void> {
    await this.client.destroy();
  }

  /**
   * Discord クライアントインスタンスを取得（テスト用）
   * @returns Discord クライアントインスタンス
   */
  getClient(): Client {
    return this.client;
  }

  /**
   * テストモードを設定
   * @param isTestMode テストモードの有効/無効
   */
  setTestMode(isTestMode: boolean): void {
    this.isTestMode = isTestMode;
    this.messageRules.setTestMode(isTestMode);
    this.messageProcessor.setTestMode(isTestMode);
    this.logger.info(`テストモード設定: ${isTestMode}`);
  }
}

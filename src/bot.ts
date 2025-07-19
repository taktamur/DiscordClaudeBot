import { Client, Message, GatewayIntents } from "../deps.ts";
import { CONFIG } from "./config.ts";
import { ClaudeExecutor } from "./claude/executor.ts";
import { MessageProcessor } from "./discord/message-processor.ts";
import { Logger } from "./utils/logger.ts";

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

  /**
   * DiscordBot のコンストラクタ
   * 各コンポーネントを初期化し、イベントハンドラーを設定します
   */
  constructor() {
    // Discord クライアントの初期化（必要な権限を指定）
    this.client = new Client({
      intents: [
        GatewayIntents.GUILDS,          // サーバー情報の取得
        GatewayIntents.GUILD_MESSAGES,  // メッセージの受信
        GatewayIntents.MESSAGE_CONTENT, // メッセージ内容の取得（2022年以降必須）
      ],
    });
    this.claudeExecutor = new ClaudeExecutor();
    this.messageProcessor = new MessageProcessor();
    this.logger = new Logger();
    
    this.setupEventHandlers();
  }

  /**
   * Discord イベントハンドラーの設定
   * ボットのログイン完了とメッセージ受信イベントを監視します
   */
  private setupEventHandlers(): void {
    // ボット起動完了時の処理
    this.client.on('ready', () => {
      this.logger.info(`ボットが${this.client.user?.username}としてログインしました`);
    });

    // メッセージ受信時の処理
    this.client.on('messageCreate', async (msg: Message) => {
      if (this.shouldProcessMessage(msg)) {
        await this.handleMention(msg);
      }
    });
  }

  /**
   * メッセージを処理すべきかを判定
   * @param msg Discord メッセージオブジェクト
   * @returns 処理すべき場合 true、そうでなければ false
   */
  private shouldProcessMessage(msg: Message): boolean {
    return !msg.author.bot &&  // ボットからのメッセージは無視
           msg.mentions.users.has(this.client.user?.id || "");  // このボットへのメンションのみ処理
  }

  /**
   * ボットへのメンション処理のメインロジック
   * スレッド履歴取得 → Claude Code 実行 → 応答送信の流れを実行します
   * @param msg メンション元のメッセージ
   */
  private async handleMention(msg: Message): Promise<void> {
    try {
      this.logger.info(`${msg.author.username}からのメンションを処理中`);
      
      // 1. スレッドの会話履歴を取得
      const context = await this.messageProcessor.getThreadHistory(msg);
      
      // 2. Claude Code 用のプロンプトを構築
      const prompt = this.messageProcessor.buildPrompt(context);
      
      // 3. Claude Code を実行して応答を取得
      const response = await this.claudeExecutor.execute(prompt);
      
      // 4. Discord に応答を送信（分割投稿対応）
      await this.messageProcessor.sendResponse(msg, response);
      
    } catch (error) {
      this.logger.error(`メンション処理エラー: ${error}`);
      await msg.reply("エラーが発生しました。しばらく時間をおいて再度お試しください。");
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
}
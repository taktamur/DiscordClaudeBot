import { Message, TextChannel } from "../../deps.ts";
import { CONFIG } from "../utils/Config.ts";
import { Logger } from "../utils/Logger.ts";

/**
 * スレッドの会話履歴を表すインターフェース
 */
export interface ThreadContext {
  messages: Array<{
    author: string; // 発言者の名前
    content: string; // メッセージ内容
    timestamp: string; // 投稿時刻（ISO形式）
  }>;
}

/**
 * Discord メッセージの処理を担当するクラス
 * スレッド履歴の取得、プロンプト構築、応答送信、分割投稿などを処理します
 */
export class MessageProcessor {
  private logger: Logger;
  private isTestMode: boolean = false;

  /**
   * MessageProcessor のコンストラクタ
   */
  constructor() {
    this.logger = new Logger();
  }

  /**
   * テストモードを設定
   * @param isTestMode テストモードの有効/無効
   */
  setTestMode(isTestMode: boolean): void {
    this.isTestMode = isTestMode;
  }

  /**
   * スレッドの会話履歴を取得する
   * 複数の手法を順次試行して、可能な限り多くの履歴を取得します
   * @param msg 基準となるメッセージ
   * @returns スレッドの会話履歴
   */
  async getThreadHistory(msg: Message): Promise<ThreadContext> {
    this.logger.info("スレッド履歴を取得中");

    try {
      const channel = msg.channel;
      const fetchedMessages = await this.fetchChannelMessages(
        channel,
        msg,
        CONFIG.MAX_HISTORY_MESSAGES,
      );

      if (fetchedMessages.length > 0) {
        this.logger.info(
          `履歴から${fetchedMessages.length}件のメッセージを取得しました`,
        );
        return {
          messages: fetchedMessages.map((m: Message) => ({
            author: m.author.username || m.author.tag || "Unknown",
            content: m.content || "",
            timestamp: m.createdAt.toISOString(),
          })),
        };
      }

      // フォールバック: 現在のメッセージのみ
      this.logger.warn(
        "履歴を取得できませんでした。現在のメッセージのみを使用します",
      );
      return this.createFallbackContext(msg);
    } catch (error) {
      this.logger.error(`スレッド履歴の取得に失敗しました: ${error}`);
      return this.createFallbackContext(msg);
    }
  }

  /**
   * チャンネルからメッセージ履歴を取得する内部メソッド
   * Harmony ライブラリの API 変更に対応するため、複数のパターンを試行します
   * @param channel Discord チャンネルオブジェクト
   * @param currentMsg 現在のメッセージ
   * @param limit 取得する最大メッセージ数
   * @returns 取得できたメッセージ配列
   */
  private async fetchChannelMessages(
    channel: TextChannel,
    currentMsg: Message,
    limit: number,
  ): Promise<Message[]> {
    // Harmonyライブラリには複数のfetchMessages実装パターンが存在するため、
    // 複数の方法を試行してメッセージ履歴を取得する
    // - パターン1: 新しいAPI (options object形式)
    // - パターン2,3: 古いAPIや代替手段 (現在はコメントアウト)
    //
    // 背景: HarmonyライブラリのfetchMessagesには既知のバグがあるらしく
    // ("GET requests may not have a body"エラー)、API変更も頻繁に発生するため
    // 複数パターンでの対応が必要

    // パターン1: fetchMessages with options object
    if (typeof channel.fetchMessages === "function") {
      try {
        this.logger.debug("Trying fetchMessages with options object");
        const result = await channel.fetchMessages({
          limit: Math.min(limit, 100),
          before: currentMsg.id,
        });

        if (result && typeof result.array === "function") {
          const messages = result.array().reverse(); // 時系列順に並び替え
          messages.push(currentMsg); // 現在のメッセージを最後に追加
          return messages;
        }
      } catch (error) {
        this.logger.debug(`fetchMessages with options failed: ${error}`);
      }
    }

    // パターン2: fetchMessages with number parameter
    // 注意: コメントアウト中 - 複雑さ軽減のため
    // Harmonyライブラリの古いAPIや"GET requests may not have a body"エラー対応として残している
    // 必要に応じて復活可能
    /*
    if (typeof channel.fetchMessages === "function") {
      try {
        this.logger.debug("Trying fetchMessages with number parameter");
        const result = await channel.fetchMessages(Math.min(limit, 100));

        if (result && typeof result.array === "function") {
          const messages = result.array().reverse();
          return messages.filter((m: Message) => m.id !== currentMsg.id).concat(
            [currentMsg],
          );
        }
      } catch (error) {
        this.logger.debug(`fetchMessages with number failed: ${error}`);
      }
    }
    */

    // パターン3: messages manager直接アクセス
    // 注意: コメントアウト中 - 複雑さ軽減のため
    // HarmonyライブラリのAPI変更やfetchMessages不具合時の代替手段として残している
    // 必要に応じて復活可能
    /*
    if (channel.messages && typeof channel.messages.fetch === "function") {
      try {
        this.logger.debug("Trying messages.fetch");
        // 現在キャッシュされているメッセージを取得
        const cachedMessages = channel.messages.array?.() || [];
        if (cachedMessages.length > 0) {
          return cachedMessages.reverse().slice(0, limit);
        }
      } catch (error) {
        this.logger.debug(`messages.fetch failed: ${error}`);
      }
    }
    */

    this.logger.warn("すべてのメッセージ取得方法が失敗しました");
    return [];
  }

  private createFallbackContext(msg: Message): ThreadContext {
    return {
      messages: [{
        author: msg.author.username || msg.author.tag || "Unknown",
        content: msg.content || "",
        timestamp: msg.createdAt.toISOString(),
      }],
    };
  }

  /**
   * スレッドの会話履歴から Claude Code 用のプロンプトを構築
   * 単一メッセージと複数メッセージで異なる形式を使用します
   * @param context スレッドの会話履歴
   * @returns Claude Code に送信するプロンプト文字列
   */
  buildPrompt(context: ThreadContext): string {
    const messageCount = context.messages.length;

    if (messageCount === 1) {
      // 単一メッセージの場合はシンプルなプロンプト
      const currentMessage = context.messages[0];
      return `Discordでメンションを受けました。以下のメッセージに適切に応答してください。

ユーザー: ${currentMessage.author}
メッセージ: ${currentMessage.content}
時刻: ${currentMessage.timestamp}

上記のメッセージに対して、適切な返答をしてください。`;
    }

    // 複数メッセージの場合は会話履歴として処理
    const messageHistory = context.messages
      .map((msg, index) => {
        const timeStr = this.formatTimestamp(msg.timestamp);
        const isLatest = index === context.messages.length - 1;
        const prefix = isLatest ? "→" : " ";
        return `${prefix} [${timeStr}] ${msg.author}: ${msg.content}`;
      })
      .join("\n");

    return `以下はDiscordスレッドの会話履歴です（${messageCount}件のメッセージ）。最新のメッセージ（→印）に対して、会話の文脈を踏まえて適切に応答してください。

会話履歴:
${messageHistory}

会話の流れを理解して、最新のメッセージに対する適切な返答をしてください。`;
  }

  private formatTimestamp(isoString: string): string {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString("ja-JP", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString.split("T")[1]?.split(".")[0] || isoString;
    }
  }

  /**
   * Discord に応答メッセージを送信する
   * 2000文字制限を超える場合は自動的に分割投稿を行います
   * @param msg 元のメッセージ（返信先）
   * @param response 送信する応答内容
   */
  async sendResponse(msg: Message, response: string): Promise<void> {
    this.logger.info("Discordに応答を送信中");

    try {
      // テストモード時はBot間の無限ループを防ぐためメンションなしで応答
      // 通常時は発言者にメンションを付けて応答
      const finalResponse = this.isTestMode
        ? response
        : `<@${msg.author.id}> ${response}`;

      if (finalResponse.length <= CONFIG.MAX_MESSAGE_LENGTH) {
        await msg.reply(finalResponse);
      } else {
        await this.sendSplitMessage(msg, response);
      }

      this.logger.info("応答を正常に送信しました");
    } catch (error) {
      this.logger.error(`応答の送信に失敗しました: ${error}`);
      throw error;
    }
  }

  /**
   * 長い応答を複数のメッセージに分割して送信する内部メソッド
   * 最初のメッセージにのみメンションを付け、後続は「(続き)」プレフィックスを使用
   * @param msg 元のメッセージ
   * @param response 分割する応答内容
   */
  private async sendSplitMessage(
    msg: Message,
    response: string,
  ): Promise<void> {
    const chunks = this.splitMessage(response);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // テストモード時はメンションなし、通常時はメンション付き
      const prefix = i === 0
        ? (this.isTestMode ? "" : `<@${msg.author.id}> `)
        : "(続き) ";

      if (i === 0) {
        await msg.reply(prefix + chunk);
      } else {
        await msg.channel.send(prefix + chunk);
      }

      await this.delay(1000 / CONFIG.RATE_LIMIT_MESSAGES_PER_SECOND);
    }
  }

  /**
   * メッセージを Discord の文字制限に合わせて分割する内部メソッド
   * 行単位での分割を優先し、必要に応じて単語単位でも分割します
   * @param message 分割対象のメッセージ
   * @returns 分割されたメッセージ配列
   */
  private splitMessage(message: string): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = message.split("\n");

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > CONFIG.MAX_MESSAGE_LENGTH) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        if (line.length > CONFIG.MAX_MESSAGE_LENGTH) {
          const words = line.split(" ");
          for (const word of words) {
            if (
              currentChunk.length + word.length + 1 > CONFIG.MAX_MESSAGE_LENGTH
            ) {
              chunks.push(currentChunk.trim());
              currentChunk = word;
            } else {
              currentChunk += (currentChunk ? " " : "") + word;
            }
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 指定されたミリ秒数だけ待機する内部メソッド
   * レート制限対応のために使用します
   * @param ms 待機時間（ミリ秒）
   * @returns Promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

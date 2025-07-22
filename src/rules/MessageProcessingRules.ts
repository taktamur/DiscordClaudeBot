import { Message } from "../../deps.ts";
import { Logger } from "../utils/logger.ts";

/**
 * メッセージ処理判定ルールクラス
 * Discord メッセージを処理すべきかどうかを判定するロジックを集約
 */
export class MessageProcessingRules {
  constructor(
    private botId: string,
    private isTestMode: boolean,
    private logger: Logger,
  ) {}

  /**
   * メッセージを処理すべきかを判定する
   * @param msg Discord メッセージオブジェクト
   * @returns 処理すべき場合 true、そうでなければ false
   */
  shouldProcess(msg: Message): boolean {
    // 自分のメッセージは絶対に処理しない（無限ループ防止）
    if (this.isOwnMessage(msg)) {
      this.logger.info("自分のメッセージのため処理をスキップ");
      return false;
    }

    // メンション検知
    const hasMention = this.hasMention(msg);
    this.logMentionDetails(msg, hasMention);

    // 他のボットメッセージの処理判定
    if (!this.shouldProcessBotMessage(msg)) {
      return false;
    }

    return hasMention;
  }

  /**
   * 自分のメッセージかどうかを判定
   * @param msg Discord メッセージオブジェクト
   * @returns 自分のメッセージの場合 true
   */
  private isOwnMessage(msg: Message): boolean {
    return msg.author.id === this.botId;
  }

  /**
   * メンションが含まれているかを判定
   * @param msg Discord メッセージオブジェクト
   * @returns メンションが含まれている場合 true
   */
  private hasMention(msg: Message): boolean {
    // Harmonyの解析結果 + 文字列パターンマッチング
    const hasMentionObj = msg.mentions.users.has(this.botId);
    const hasMentionText = msg.content.includes(`<@${this.botId}>`);
    return hasMentionObj || hasMentionText;
  }

  /**
   * ボットメッセージを処理すべきかを判定
   * @param msg Discord メッセージオブジェクト
   * @returns 処理すべき場合 true
   */
  private shouldProcessBotMessage(msg: Message): boolean {
    const isBot = msg.author.bot;

    // 人間のメッセージは常に処理対象
    if (!isBot) {
      return true;
    }

    // テストモード時の特別処理
    if (this.isTestMode) {
      // E2Eテスト時はCaller Botからのメッセージのみ許可
      const callerBotId = "1396643708224540752"; // ClaudeBot-e2e-caller
      if (msg.author.id !== callerBotId) {
        this.logger.info(
          "テストモード中の他ボットメッセージのため処理をスキップ",
        );
        return false;
      }
      return true;
    } else {
      // 通常モード時は他のボットメッセージを除外
      this.logger.info("他のボットメッセージのため処理をスキップ");
      return false;
    }
  }

  /**
   * メンション詳細をログ出力
   * @param msg Discord メッセージオブジェクト
   * @param hasMention メンション判定結果
   */
  private logMentionDetails(msg: Message, hasMention: boolean): void {
    const hasMentionObj = msg.mentions.users.has(this.botId);
    const hasMentionText = msg.content.includes(`<@${this.botId}>`);
    const mentionedUsers = Array.from(msg.mentions.users.keys());
    const isBot = msg.author.bot;
    const isOwnMessage = this.isOwnMessage(msg);

    this.logger.info(
      `メンション詳細: users=[${
        mentionedUsers.join(",")
      }], mentionObj=${hasMentionObj}, mentionText=${hasMentionText}, content="${msg.content}"`,
    );
    this.logger.info(
      `メッセージ判定: author.bot=${isBot}, isOwnMessage=${isOwnMessage}, hasMention=${hasMention}, testMode=${this.isTestMode}`,
    );
  }

  /**
   * ボットIDを更新
   * @param newBotId 新しいボットID
   */
  updateBotId(newBotId: string): void {
    this.botId = newBotId;
  }

  /**
   * テストモードを設定
   * @param isTestMode テストモードの有効/無効
   */
  setTestMode(isTestMode: boolean): void {
    this.isTestMode = isTestMode;
  }
}

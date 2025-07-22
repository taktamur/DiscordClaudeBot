import { Message } from "../../deps.ts";
import { Logger } from "../utils/Logger.ts";

/**
 * メッセージ処理判定ルールクラス
 * Discord メッセージを処理すべきかどうかを判定するロジックを集約
 */
export class MessageProcessingRules {
  constructor(
    private botId: string,
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
      `メッセージ判定: author.bot=${isBot}, isOwnMessage=${isOwnMessage}, hasMention=${hasMention}`,
    );
  }

  /**
   * ボットIDを更新
   * @param newBotId 新しいボットID
   */
  updateBotId(newBotId: string): void {
    this.botId = newBotId;
  }
}

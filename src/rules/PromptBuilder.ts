import { ThreadContext } from "../types/discord.ts";

/**
 * Claude Code 用のプロンプト構築を担当するクラス
 * スレッドの会話履歴から適切なプロンプトを生成します
 */
export class PromptBuilder {
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
}

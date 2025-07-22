/**
 * Discord メッセージの分割処理を担当するユーティリティクラス
 * 文字数制限に対応した分割機能を提供します
 */
export class MessageSplitter {
  /**
   * メッセージをDiscordの文字制限に合わせて分割する
   * 行単位での分割を優先し、必要に応じて単語単位でも分割します
   * @param message 分割対象のメッセージ
   * @param maxLength 最大文字数（デフォルト: 2000）
   * @returns 分割されたメッセージ配列
   */
  static split(message: string, maxLength: number = 2000): string[] {
    const chunks: string[] = [];
    let currentChunk = "";

    const lines = message.split("\n");

    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        if (line.length > maxLength) {
          // 長い行を処理する
          if (line.includes(" ")) {
            // スペースがある場合は単語単位で分割
            const words = line.split(" ");
            for (const word of words) {
              if (currentChunk.length + word.length + 1 > maxLength) {
                if (currentChunk) {
                  chunks.push(currentChunk.trim());
                  currentChunk = word;
                } else {
                  // 単語自体が制限を超える場合は文字単位で分割
                  if (word.length > maxLength) {
                    for (let i = 0; i < word.length; i += maxLength) {
                      chunks.push(word.slice(i, i + maxLength));
                    }
                  } else {
                    currentChunk = word;
                  }
                }
              } else {
                currentChunk += (currentChunk ? " " : "") + word;
              }
            }
          } else {
            // スペースがない場合は文字単位で分割
            for (let i = 0; i < line.length; i += maxLength) {
              chunks.push(line.slice(i, i + maxLength));
            }
          }
        } else {
          currentChunk = line;
        }
      } else {
        currentChunk += (currentChunk ? "\n" : "") + line;
      }
    }

    if (currentChunk && currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

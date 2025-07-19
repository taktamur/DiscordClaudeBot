/**
 * ログ出力ユーティリティクラス
 * タイムスタンプ付きでレベル別にログメッセージを出力します
 */
export class Logger {
  /**
   * タイムスタンプをISO形式でフォーマットする内部メソッド
   * @returns ISO形式のタイムスタンプ文字列
   */
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 情報レベルのログを出力
   * @param message ログメッセージ
   */
  info(message: string): void {
    console.log(`[${this.formatTimestamp()}] INFO: ${message}`);
  }

  /**
   * エラーレベルのログを出力
   * @param message エラーメッセージ
   */
  error(message: string): void {
    console.error(`[${this.formatTimestamp()}] ERROR: ${message}`);
  }

  /**
   * 警告レベルのログを出力
   * @param message 警告メッセージ
   */
  warn(message: string): void {
    console.warn(`[${this.formatTimestamp()}] WARN: ${message}`);
  }

  /**
   * デバッグレベルのログを出力
   * @param message デバッグメッセージ
   */
  debug(message: string): void {
    console.debug(`[${this.formatTimestamp()}] DEBUG: ${message}`);
  }
}
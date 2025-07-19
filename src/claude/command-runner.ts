/**
 * コマンド実行を抽象化するインターフェース
 * テスタビリティ向上のためDependency Injection パターンを適用
 */
export interface CommandRunner {
  /**
   * コマンドを実行し、結果を返す
   * @param command 実行するコマンド名
   * @param args コマンド引数
   * @param options 実行オプション
   * @returns 実行結果
   */
  execute(
    command: string,
    args: string[],
    options?: CommandOptions,
  ): Promise<CommandResult>;
}

/**
 * コマンド実行オプション
 */
export interface CommandOptions {
  /** 標準出力のキャプチャ設定 */
  stdout?: "inherit" | "piped" | "null";
  /** 標準エラー出力のキャプチャ設定 */
  stderr?: "inherit" | "piped" | "null";
  /** 作業ディレクトリ */
  cwd?: string;
  /** 環境変数 */
  env?: Record<string, string>;
}

/**
 * コマンド実行結果
 */
export interface CommandResult {
  /** 実行が成功したかどうか */
  success: boolean;
  /** 終了コード */
  code: number;
  /** 標準出力（バイト配列） */
  stdout: Uint8Array;
  /** 標準エラー出力（バイト配列） */
  stderr: Uint8Array;
}

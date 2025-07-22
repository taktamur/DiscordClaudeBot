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

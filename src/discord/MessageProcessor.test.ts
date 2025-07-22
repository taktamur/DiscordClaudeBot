/**
 * MessageProcessor のユニットテスト
 * t_wadaさんの教えに従い、純粋関数的な部分を重点的にテスト
 * 副作用のある部分はモックを使用
 */

import { assertEquals } from "../../deps.ts";
import { MessageProcessor } from "./MessageProcessor.ts";
import { Logger } from "../utils/Logger.ts";

// Note: splitMessageメソッドはMessageSplitterクラスに分離されました
// そのテストはsrc/utils/MessageSplitter.test.tsに移動されています

Deno.test("MessageProcessor - 基本的なインスタンス化", () => {
  // テスト用のモックインスタンスを作成
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    formatTimestamp: () => "2025-07-22T12:00:00.000Z",
  } as unknown as Logger;

  const processor = new MessageProcessor(mockLogger);

  // インスタンスが正しく作成されることを確認
  assertEquals(typeof processor, "object");
});

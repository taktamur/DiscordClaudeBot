/**
 * 外部依存関係の管理ファイル
 * Harmony ライブラリからの必要なクラスと型をエクスポートします
 */

export {
  Client,          // Discord クライアント
  Message,         // Discord メッセージオブジェクト
  GatewayIntents,  // Discord Gateway の権限設定
  TextChannel,     // Discord テキストチャンネル
} from "@harmony/harmony";

export type {
  ClientOptions,   // Discord クライアントのオプション型
} from "@harmony/harmony";

// テスト用関数
export {
  assertEquals,
  assertRejects,
  assertExists,
  assertInstanceOf,
} from "jsr:@std/assert";

export {
  spy,
  stub,
  assertSpyCall,
  assertSpyCalls,
  returnsNext,
  returnsArg,
} from "jsr:@std/testing/mock";
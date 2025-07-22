# Denoテスティング・モッキングガイド

## 概要

Denoの標準テスティングライブラリには強力なモッキング機能が含まれています。
このドキュメントでは、`spy()`, `stub()`, `mock()` 関数の使用方法を解説します。

## spy() 関数

### 基本概念

`spy()`関数は、関数の呼び出しを追跡・監視するためのツールです。
元の関数の動作を保持しながら、以下の情報を記録します：

- 関数が何回呼ばれたか
- どのような引数で呼ばれたか
- 戻り値は何だったか
- いつ呼ばれたか

### 基本的な使用方法

```typescript
import { spy, assertSpyCalls } from "https://deno.land/std@0.208.0/testing/mock.ts";

// スパイ関数の作成
const mockSave = spy((data: any) => Promise.resolve({ id: 1, ...data }));

// テスト実行
const result = await mockSave({ name: "test" });

// 呼び出し回数の検証
assertSpyCalls(mockSave, 1);

// 引数の検証
assertEquals(mockSave.calls[0].args[0], { name: "test" });

// 戻り値の検証
assertEquals(result, { id: 1, name: "test" });
```

### オブジェクトメソッドのスパイ

```typescript
const mockDatabase = {
  save: spy((user: User) => Promise.resolve({ id: 1, ...user })),
  find: spy((id: number) => Promise.resolve({ id, name: "Found User" })),
};

// 使用例
await mockDatabase.save({ name: "Test User" });
await mockDatabase.find(1);

// 検証
assertSpyCalls(mockDatabase.save, 1);
assertSpyCalls(mockDatabase.find, 1);
```

## stub() 関数

### 基本概念

`stub()`は既存のオブジェクトのメソッドを一時的に別の実装に置き換えます。

```typescript
import { stub, assertSpyCalls } from "https://deno.land/std@0.208.0/testing/mock.ts";

const user = {
  getName: () => "Original Name",
};

// スタブの作成
const nameStub = stub(user, "getName", () => "Stubbed Name");

// テスト実行
assertEquals(user.getName(), "Stubbed Name");

// 検証
assertSpyCalls(nameStub, 1);

// 後始末（重要！）
nameStub.restore();
```

## 実用的なテスト例

### MessageProcessorテストでの活用例

現在のMessageProcessorテストを改善する場合：

```typescript
import { spy, assertSpyCalls, assertEquals } from "../../deps.ts";

Deno.test("MessageProcessor with spy", async (t) => {
  await t.step("sendResponse呼び出し回数の検証", async () => {
    const mockLogger = {
      info: spy(() => {}),
      warn: spy(() => {}),
      error: spy(() => {}),
      debug: spy(() => {}),
    };

    const processor = new MessageProcessor(mockLogger as unknown as Logger);
    
    const mockMessage = {
      reply: spy(() => Promise.resolve()),
      channel: { send: spy(() => Promise.resolve()) },
      // ... その他のプロパティ
    };

    // テスト実行
    await processor.sendResponse(mockMessage as unknown as Message, ["test"]);

    // 検証
    assertSpyCalls(mockMessage.reply, 1);  // reply()が1回呼ばれた
    assertSpyCalls(mockLogger.info, 2);    // info()が2回呼ばれた
    assertEquals(mockMessage.reply.calls[0].args[0], "test");  // 引数の検証
  });
});
```

## 利点と使い分け

### spy() の利点
- 元の関数の動作を保持
- 呼び出し履歴を詳細に追跡
- シンプルで理解しやすい

### 現在のカスタムモック vs spy()

**現在のアプローチ（カスタムモック）:**
```typescript
// 複雑な手動実装
interface MockLogger {
  calls: MockCall[];
  info: (message: string) => void;
  // ...
}

const mockLogger = {
  info: (message: string) => calls.push({ method: "info", args: [message] }),
  // ...
};
```

**spy() を使用したアプローチ:**
```typescript
// シンプルで標準的
const mockLogger = {
  info: spy(() => {}),
  warn: spy(() => {}),
  error: spy(() => {}),
  debug: spy(() => {}),
};

// 検証もシンプル
assertSpyCalls(mockLogger.info, 1);
assertEquals(mockLogger.info.calls[0].args[0], "期待するメッセージ");
```

## ベストプラクティス

1. **spy() の利点を活用**: 標準機能を使用してテストコードを簡潔に
2. **適切な後始末**: stub() 使用時は必ず `restore()` を呼ぶ
3. **テストの独立性**: 各テストでフレッシュなスパイを作成
4. **検証の明確性**: `assertSpyCalls()` で呼び出し回数を明確に検証

## mock() 関数について

### 結論: Deno標準ライブラリにはmock()関数は存在しません

調査の結果、Deno標準テスティングライブラリ（2024年版）には、`mock()`という名前の関数は**存在しません**。

利用可能な関数は以下の通りです：

### Deno標準ライブラリのモッキング関数一覧

```typescript
import { 
  spy, 
  stub, 
  assertSpyCall, 
  assertSpyCalls, 
  returnsNext,
  mockSession 
} from "@std/testing/mock";
```

#### 1. spy()
関数やメソッドの呼び出しを追跡・監視

#### 2. stub() 
既存のメソッドを一時的に別の実装に置き換え

#### 3. returnsNext()
スタブに連続した戻り値を設定するヘルパー関数

```typescript
const stub = returnsNext([1, 2, 3]);
console.log(stub()); // 1
console.log(stub()); // 2
console.log(stub()); // 3
```

#### 4. mockSession()
複数のモック/スタブを管理し、自動復元する機能

```typescript
using session = mockSession();
const stub1 = session.stub(obj, "method1");
const stub2 = session.stub(obj, "method2");
// テスト終了時に自動的にすべて復元される
```

#### 5. assertSpyCall() / assertSpyCalls()
スパイの呼び出しを検証するアサーション関数

```typescript
assertSpyCalls(spy, 3); // 3回呼ばれたことを検証
assertSpyCall(spy, 0, { 
  args: [1, 2], 
  returned: 3 
}); // 最初の呼び出しの詳細を検証
```

### 2024年の新機能

**using キーワードによる自動復元:**
```typescript
using stub = stub(globalThis, 'fetch', () => Promise.resolve(new Response()));
// ブロックを抜ける時に自動的に元に戻る
```

### 他のライブラリとの比較

他のテスティングフレームワーク（Jest、Sinon.jsなど）では`mock()`関数が存在しますが、Denoでは：
- `spy()` = Jest/Sinonの`spy()`
- `stub()` = Jest/Sinonの`mock()`に相当

つまり、Denoでは「モック」の概念を`stub()`で実現しています。

## 参考リンク

- [Deno Testing Mock Documentation](https://docs.deno.com/examples/mocking_tutorial/)
- [Deno std/testing/mock API](https://deno.land/std/testing/mock.ts)
- [JSR @std/testing Mock Documentation](https://jsr.io/@std/testing)
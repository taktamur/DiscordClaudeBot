# Denoにおけるusingキーワード完全ガイド

## 概要

`using`キーワードは、TypeScript 5.2で導入された新機能で、Deno v2.3以降でサポートされています。
リソースの自動クリーンアップを提供し、従来のtry-finallyパターンを大幅に簡素化します。

## 基本概念

### 従来のリソース管理（try-finally）

```typescript
// 従来の方法：手動でリソース管理
function readFileOldWay() {
  let file;
  try {
    file = openFile("data.txt");
    // ファイル操作...
    return processFile(file);
  } finally {
    if (file) {
      file.close(); // 手動でクリーンアップ
    }
  }
}
```

### usingキーワードを使用した新しい方法

```typescript
// 新しい方法：自動リソース管理
function readFileNewWay() {
  using file = openFile("data.txt");
  // ファイル操作...
  return processFile(file);
  // ここでfile.[Symbol.dispose]()が自動的に呼ばれる
}
```

## Symbol.disposeの実装

### カスタムDisposableオブジェクト

```typescript
class FileHandle {
  private isOpen = true;
  
  constructor(private filename: string) {
    console.log(`📁 Opening file: ${filename}`);
  }
  
  read(): string {
    if (!this.isOpen) throw new Error("File is closed");
    return "file contents...";
  }
  
  // Disposableインターフェースの実装
  [Symbol.dispose](): void {
    if (this.isOpen) {
      console.log(`🗂️ Closing file: ${this.filename}`);
      this.isOpen = false;
    }
  }
}

// 使用例
function processFile() {
  using file = new FileHandle("data.txt");
  console.log(file.read());
  // ここでfile.[Symbol.dispose]()が自動実行される
}

processFile();
// 出力:
// 📁 Opening file: data.txt
// file contents...
// 🗂️ Closing file: data.txt
```

## 非同期リソース管理（await using）

### AsyncDisposableの実装

```typescript
class DatabaseConnection {
  private connected = false;
  
  constructor(private connectionString: string) {}
  
  async connect(): Promise<void> {
    console.log(`🔌 Connecting to: ${this.connectionString}`);
    this.connected = true;
  }
  
  async query(sql: string): Promise<string[]> {
    if (!this.connected) throw new Error("Not connected");
    return [`Result for: ${sql}`];
  }
  
  // AsyncDisposableインターフェースの実装
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.connected) {
      console.log("🔌 Closing database connection");
      await new Promise(resolve => setTimeout(resolve, 100)); // 接続終了の待機
      this.connected = false;
    }
  }
}

// 使用例
async function queryDatabase() {
  const db = new DatabaseConnection("postgresql://...");
  await db.connect();
  
  await using connection = db;
  const results = await connection.query("SELECT * FROM users");
  console.log(results);
  // ここでconnection.[Symbol.asyncDispose]()が自動実行される
}
```

## Denoでの実践例

### 1. HTTPサーバーの自動停止

```typescript
function testServer() {
  using server = Deno.serve({ port: 8000 }, () => {
    return new Response("Hello, world!");
  });
  
  // テスト処理
  console.log("Server is running on http://localhost:8000");
  
  // この関数を抜ける時に自動的にサーバーが停止される
}
```

### 2. ファイル操作の自動クリーンアップ

```typescript
class DenoFileHandle {
  constructor(private file: Deno.FsFile) {}
  
  async write(data: string): Promise<void> {
    const encoder = new TextEncoder();
    await this.file.write(encoder.encode(data));
  }
  
  [Symbol.dispose](): void {
    this.file.close();
    console.log("📁 File closed automatically");
  }
}

async function writeToFile() {
  const file = await Deno.open("output.txt", { write: true, create: true });
  using fileHandle = new DenoFileHandle(file);
  
  await fileHandle.write("Hello, using keyword!");
  // ここでファイルが自動的に閉じられる
}
```

## DisposableStackによる複数リソース管理

```typescript
function manageMultipleResources() {
  using stack = new DisposableStack();
  
  // 複数のリソースをスタックに追加
  const file1 = stack.use(new FileHandle("file1.txt"));
  const file2 = stack.use(new FileHandle("file2.txt"));
  const server = stack.use(Deno.serve({ port: 8001 }, () => new Response("OK")));
  
  // 処理実行
  console.log(file1.read());
  console.log(file2.read());
  
  // この関数を抜ける時に、すべてのリソースが逆順で自動的に解放される
  // (server → file2 → file1 の順番)
}
```

## テストでの活用例

### モックの自動復元

```typescript
import { stub } from "@std/testing/mock";

Deno.test("automatic mock cleanup", () => {
  // usingでスタブを作成すると自動的に復元される
  using fetchStub = stub(globalThis, "fetch", () => 
    Promise.resolve(new Response("mocked"))
  );
  
  // テスト実行
  // ...
  
  // ここでfetchStubが自動的に復元される
});
```

### カスタムテスト環境

```typescript
class TestEnvironment {
  private tempDir: string;
  
  constructor() {
    this.tempDir = Deno.makeTempDirSync();
    console.log(`🧪 Test environment created: ${this.tempDir}`);
  }
  
  getPath(filename: string): string {
    return `${this.tempDir}/${filename}`;
  }
  
  [Symbol.dispose](): void {
    Deno.removeSync(this.tempDir, { recursive: true });
    console.log(`🧹 Test environment cleaned up: ${this.tempDir}`);
  }
}

Deno.test("with automatic cleanup", () => {
  using env = new TestEnvironment();
  
  // テストファイルの作成
  Deno.writeTextFileSync(env.getPath("test.txt"), "test data");
  
  // テスト実行
  // ...
  
  // ここで一時ディレクトリが自動的に削除される
});
```

## 利点と注意点

### 利点

1. **自動クリーンアップ**: 例外が発生してもリソースが確実に解放される
2. **コードの簡潔性**: try-finallyブロックが不要
3. **メモリリーク防止**: リソース解放の忘れを防げる
4. **スタック管理**: DisposableStackで複数リソースを効率的に管理

### 注意点

1. **ブラウザサポート**: Chrome 134+, Firefox 134+で利用可能
2. **Denoバージョン**: v2.3以降でサポート
3. **Symbol.dispose実装**: カスタムオブジェクトでは適切に実装する必要がある
4. **非同期リソース**: `await using`を使用する必要がある

## 従来パターンとの比較

| 方法 | コード量 | 安全性 | 可読性 |
|------|----------|--------|--------|
| try-finally | 多い | 実装依存 | 低い |
| using | 少ない | 高い | 高い |

## まとめ

`using`キーワードは、Denoにおけるリソース管理を大幅に改善します。特にテストやファイル操作、ネットワーク処理において、自動クリーンアップによる安全で簡潔なコードを実現できます。

MessageProcessorテストなどでも、この仕組みを活用すれば、より保守しやすいテストコードを書くことができるでしょう。
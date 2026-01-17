# クロスプラットフォーム対応ルートディレクトリ設定機能

## 概要
レシート画像の保存先として `{HOME}/Documents/Expense` をデフォルトのルートディレクトリとし、年月ベースのフォルダ構造 (`{root}/2026/01/`) を自動作成する機能を実装する。

## 要件
- デフォルト: `{HOME}/Documents/Expense`（OS依存のパス解決）
- アプリ内設定画面からパス変更可能
- 年月フォルダの自動作成

---

## 実装計画

### Phase 1: バックエンド（Rust）

**ファイル: `src-tauri/src/commands.rs`**

新規コマンドを追加:

```rust
/// デフォルトルートディレクトリ取得
#[tauri::command]
pub async fn get_default_root_directory(app: AppHandle) -> Result<String, String>

/// ルートディレクトリ設定取得（保存値 or デフォルト）
#[tauri::command]
pub async fn get_root_directory(app: AppHandle) -> Result<String, String>

/// ルートディレクトリ設定保存
#[tauri::command]
pub async fn save_root_directory(app: AppHandle, path: String) -> Result<(), String>

/// 年月フォルダ作成（YYYYMM形式）
#[tauri::command]
pub async fn ensure_month_directory(app: AppHandle, year_month: String) -> Result<String, String>

/// ディレクトリ検証
#[tauri::command]
pub async fn validate_directory(path: String) -> Result<DirectoryValidation, String>
```

**ファイル: `src-tauri/src/lib.rs`**

`invoke_handler` にコマンド登録を追加。

### Phase 2: フロントエンド基盤

**ファイル: `src-app/services/tauri/commands.ts`**

Tauriコマンドラッパー関数を追加:
- `getDefaultRootDirectory()`
- `getRootDirectory()`
- `saveRootDirectory(path)`
- `ensureMonthDirectory(yearMonth)`
- `validateDirectory(path)`

**ファイル: `src-app/types/receipt.ts`**

型定義を追加:
```typescript
interface DirectoryValidation {
  exists: boolean;
  isDirectory: boolean;
  isWritable: boolean;
}
```

### Phase 3: 設定画面UI

**ファイル: `src-app/components/settings/SettingsModal.tsx`**

- タブに「保存先」を追加
- `StorageSettings` コンポーネントを組み込み

**新規ファイル: `src-app/components/settings/StorageSettings.tsx`**

UI要素:
- パス表示用テキストフィールド
- 「参照...」ボタン（フォルダ選択ダイアログ）
- 「デフォルトに戻す」ボタン
- フォルダ構造の説明テキスト
- 検証結果表示（存在・書込み権限）

### Phase 4: 統合

**ファイル: `src-app/hooks/useReceiptStore.ts`**

`createMonth()` に年月フォルダ作成を統合:
```typescript
const monthDir = await ensureMonthDirectory(yearMonth);
```

---

## クロスプラットフォーム対応

| OS | デフォルトパス |
|----|---------------|
| macOS | `/Users/{user}/Documents/Expense` |
| Linux | `/home/{user}/Documents/Expense` |
| Windows | `C:\Users\{user}\Documents\Expense` |

**実装方法**: Tauri 2 の `app.path().document_dir()` を使用（内部で `dirs-next` クレートを使用、各OS固有のAPIに対応）

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src-tauri/src/commands.rs` | 5つの新規コマンド追加 |
| `src-tauri/src/lib.rs` | コマンドハンドラ登録 |
| `src-app/services/tauri/commands.ts` | ラッパー関数追加 |
| `src-app/types/receipt.ts` | 型定義追加 |
| `src-app/components/settings/SettingsModal.tsx` | タブ追加 |
| `src-app/components/settings/StorageSettings.tsx` | 新規作成 |
| `src-app/hooks/useReceiptStore.ts` | フォルダ作成統合 |

---

## 検証方法

1. **ビルド確認**: `npm run tauri dev` で起動
2. **デフォルト値確認**: 設定画面を開き、OSに応じたパスが表示されることを確認
3. **フォルダ選択**: 「参照...」ボタンでダイアログが開き、選択したパスが反映されることを確認
4. **保存・永続化**: 設定を保存後、アプリを再起動して設定が保持されていることを確認
5. **年月フォルダ作成**: 申請月を新規作成し、`{root}/YYYY/MM/` フォルダが作成されることを確認
6. **クロスプラットフォーム**: 可能であればWindows環境でも動作確認

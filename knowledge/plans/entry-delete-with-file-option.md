# 個別Entry削除時の確認ダイアログ追加

## 概要
個別entry（レシート）削除時に、月単位削除と同様の確認ダイアログを表示し、ユーザーが「物理ファイルも削除（ゴミ箱へ移動）」か「torifuneから外すだけ（ファイルは残す）」を選択できるようにする。

## 現状
- 月単位削除: `DeleteConfirmModal.tsx` で2つのオプションを提示
- 個別entry削除: `ReceiptTableRow.tsx` でシンプルな確認ダイアログ（Tauri ask）のみ

## 設計方針
既存の`DeleteConfirmModal`を汎用化して再利用する。

## 実装タスク

### Task 1: DeleteConfirmModal.tsxの汎用化
- Propsに`itemType?: "month" | "receipt"`を追加
- 説明文をitemTypeに応じてカスタマイズ
  - month: 「フォルダごとゴミ箱に移動します」
  - receipt: 「ファイルとサムネイルをゴミ箱に移動します」

### Task 2: App.tsxに個別削除用の状態管理を追加
- `pendingDeleteReceipt: ReceiptData | null`状態を追加
- `handleRequestDeleteReceipt(receipt)` - モーダルを開く
- `handleConfirmDeleteReceipt(deletePhysically)` - 削除実行

### Task 3: 削除処理の実装（App.tsx）
物理削除時:
1. `moveToTrash(receipt.filePath)`で元ファイル削除
2. サムネイルパスを構築してゴミ箱へ移動
3. メモリから削除

### Task 4: コンポーネントのProps中継を修正
- ReceiptTableRow: `onRequestDelete(receipt)`を追加
- ReceiptTable: Props中継
- ReceiptList: Props中継

## ファイル変更リスト
| ファイル | 変更内容 |
|---------|---------|
| `DeleteConfirmModal.tsx` | Propsの汎用化 |
| `ReceiptTableRow.tsx` | 削除処理変更 |
| `ReceiptTable.tsx` | Props中継 |
| `ReceiptList.tsx` | Props中継 |
| `App.tsx` | 状態管理とハンドラ追加 |

## 処理フロー
```
削除ボタン → onRequestDelete(receipt) → App.tsx → モーダル表示
                                                    ↓
                                             ユーザー選択
                                                    ↓
                                    handleConfirmDeleteReceipt(deletePhysically)
                                                    ↓
                                    物理削除 or メモリのみ削除
```

# ファイル構造とデータモデル仕様

## 概要

申請データのファイル永続化構造とサイドバー表示のためのデータモデルを定義する。

---

## ディレクトリ構造

```
{root}/
├── 2024/
│   ├── 01/
│   │   ├── receipt_001.jpg      # 画像ファイル（複数可）
│   │   ├── receipt_002.pdf      # PDFファイル（複数可）
│   │   ├── 202401-summary.json  # 解析結果（1つ）
│   │   └── 202401-summary.xlsx  # エクスポート用Excel（1つ）
│   ├── 02/
│   │   └── ...
│   └── 12/
│       └── ...
└── 2025/
    ├── 01/
    └── ...
```

### ルール

| 項目 | 仕様 |
|------|------|
| ルートディレクトリ | `{HOME}/Documents/Expense`（設定で変更可能） |
| 年フォルダ | `YYYY` 形式（4桁） |
| 月フォルダ | `MM` 形式（2桁、ゼロパディング） |
| 画像/PDF | 任意のファイル名、複数可 |
| JSON | `YYYYMM-summary.json`（1ファイル） |
| Excel | `YYYYMM-summary.xlsx`（1ファイル） |

---

## データモデル

### ApplicationMonth（既存拡張）

```typescript
export interface ApplicationMonth {
  id: string;              // short UUID (6桁)
  yearMonth: string;       // "202501" 形式
  receipts: ReceiptData[]; // レシート一覧
  directoryPath?: string;  // 実際のディレクトリパス（optional）
}
```

### YearGroup（サイドバー用・新規）

```typescript
export interface YearGroup {
  year: string;            // "2024" 形式
  months: MonthItem[];     // 月一覧（降順ソート）
  isExpanded: boolean;     // UI展開状態
}

export interface MonthItem {
  month: string;           // "01" 形式
  yearMonth: string;       // "202401" 形式（ApplicationMonthへの参照キー）
  receiptCount: number;    // レシート数
  successCount: number;    // 処理成功数
}
```

### サイドバー表示構造

```typescript
// ApplicationMonth[] から YearGroup[] への変換
export function groupByYear(months: ApplicationMonth[]): YearGroup[] {
  // 年でグループ化し、降順ソート
  // 各年内の月も降順ソート
}
```

---

## ファイル命名規則

| ファイル種別 | 命名規則 | 例 |
|-------------|---------|-----|
| JSON | `YYYYMM-summary.json` | `202501-summary.json` |
| Excel | `YYYYMM-summary.xlsx` | `202501-summary.xlsx` |
| 画像/PDF | 任意（ドロップ時のファイル名を維持） | `receipt.jpg`, `scan.pdf` |

---

## サイドバーUI仕様

### ネスト表示

```
▼ 2025
    01 (5/5)
    ← 現在選択中
▶ 2024
    （折りたたみ状態）
```

### インタラクション

- 年ラベルをクリック → 展開/折りたたみ切り替え
- 月ラベルをクリック → その月を選択
- 月ラベル右側にバッジ表示（成功数/総数）
- ホバー時に削除ボタン表示（月単位で削除）

---

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src-app/types/receipt.ts` | `YearGroup`, `MonthItem` 型追加 |
| `src-app/components/layout/Sidebar.tsx` | ネスト表示対応 |
| `src-app/hooks/useReceiptStore.ts` | `groupByYear` ヘルパー追加 |
| `src-app/services/persistence.ts` | ファイル保存/読込ロジック（新規） |

---

## JSON出力フォーマット

`YYYYMM-summary.json` の構造:

```json
{
  "yearMonth": "202501",
  "generatedAt": "2025-01-17T10:30:00Z",
  "receipts": [
    {
      "file": "receipt_001.jpg",
      "merchant": "コンビニA",
      "date": "2025-01-15",
      "total": 1234,
      "issues": []
    }
  ],
  "summary": {
    "totalAmount": 12345,
    "receiptCount": 10,
    "successCount": 9,
    "errorCount": 1
  }
}
```

---

## 実装優先順位

1. 型定義の追加（`YearGroup`, `MonthItem`）
2. `groupByYear` ヘルパー関数
3. サイドバーのネスト表示対応
4. ファイル永続化サービス

/**
 * Excelカラム定義
 * カラムのラベル、メタデータ、順序を一元管理
 */

/** Excelカラムのラベル（識別子） */
export enum ExcelColumnLabel {
  FileName = "fileName",
  ImagePreview = "imagePreview",
  OriginalFileLink = "originalFileLink",
  Date = "date",
  Merchant = "merchant",
  Amount = "amount",
  Currency = "currency",
  ValidationIssues = "validationIssues",
}

/** カラムのメタデータ */
export interface ExcelColumnMeta {
  header: string;
  width: number;
}

/** 各カラムのメタデータ定義 */
export const ExcelColumns: Record<ExcelColumnLabel, ExcelColumnMeta> = {
  [ExcelColumnLabel.FileName]: { header: "ファイル名", width: 24 },
  [ExcelColumnLabel.ImagePreview]: { header: "画像プレビュー", width: 32 },
  [ExcelColumnLabel.OriginalFileLink]: { header: "元ファイルへのリンク", width: 40 },
  [ExcelColumnLabel.Date]: { header: "日付", width: 18 },
  [ExcelColumnLabel.Merchant]: { header: "店舗", width: 28 },
  [ExcelColumnLabel.Amount]: { header: "金額", width: 14 },
  [ExcelColumnLabel.Currency]: { header: "通貨", width: 8 },
  [ExcelColumnLabel.ValidationIssues]: { header: "検証結果", width: 40 },
};

/** カラムの順序（この配列の順序がExcelの列順序を決定する） */
export const ExcelColumnOrder: ExcelColumnLabel[] = [
  ExcelColumnLabel.FileName,
  ExcelColumnLabel.ImagePreview,
  ExcelColumnLabel.OriginalFileLink,
  ExcelColumnLabel.Date,
  ExcelColumnLabel.Merchant,
  ExcelColumnLabel.Amount,
  ExcelColumnLabel.Currency,
  ExcelColumnLabel.ValidationIssues,
];

/**
 * カラムラベルから1-indexedのカラム番号を取得
 * ExcelJSのgetCell()用
 */
export function getColumnIndex(label: ExcelColumnLabel): number {
  const index = ExcelColumnOrder.indexOf(label);
  if (index === -1) {
    throw new Error(`Unknown column label: ${label}`);
  }
  return index + 1; // ExcelJS は 1-indexed
}

/**
 * ExcelJSのsheet.columns用にカラム定義を生成
 */
export function generateSheetColumns(): { header: string; key: string; width: number }[] {
  return ExcelColumnOrder.map((label) => ({
    header: ExcelColumns[label].header,
    key: label,
    width: ExcelColumns[label].width,
  }));
}

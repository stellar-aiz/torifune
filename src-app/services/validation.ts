/**
 * バリデーションサービス
 * expense-summarizer の validation.ts ロジックを移植
 */

import type { ReceiptData, ValidationIssue } from "../types/receipt";

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface ValidationContext {
  targetSegment: string; // YYYYMM 形式
  allResults: ReceiptData[];
}

/** 日付フォーマットのバリデーション */
function validateDateFormat(date: string | undefined): ValidationIssue | null {
  if (!date) return null;

  if (!DATE_FORMAT_REGEX.test(date)) {
    return {
      field: "date",
      type: "format",
      severity: "error",
      message: `日付フォーマットが不正です: "${date}" (期待: YYYY-MM-DD)`,
    };
  }

  return null;
}

/** 日付範囲のバリデーション */
function validateDateRange(
  date: string | undefined,
  targetSegment: string
): ValidationIssue | null {
  if (!date || !DATE_FORMAT_REGEX.test(date)) return null;

  const targetYear = parseInt(targetSegment.slice(0, 4), 10);
  const targetMonth = parseInt(targetSegment.slice(4, 6), 10);

  const [yearStr, monthStr] = date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // 年が1年以上ずれている場合はエラー
  if (Math.abs(year - targetYear) >= 1) {
    return {
      field: "date",
      type: "range",
      severity: "error",
      message: `日付の年が対象期間と大きく異なります: ${date} (対象: ${targetYear}年${targetMonth}月)`,
    };
  }

  // 月が2ヶ月以上ずれている場合は警告
  const monthDiff = Math.abs(year * 12 + month - (targetYear * 12 + targetMonth));
  if (monthDiff > 1) {
    return {
      field: "date",
      type: "range",
      severity: "warning",
      message: `日付が対象期間と異なります: ${date} (対象: ${targetYear}年${targetMonth}月)`,
    };
  }

  return null;
}

/** 金額の小数点バリデーション */
function validateAmountDecimal(amount: number | undefined): ValidationIssue | null {
  if (amount === undefined) return null;

  // 小数点を含む場合は警告（円建てでは通常整数）
  if (!Number.isInteger(amount)) {
    return {
      field: "amount",
      type: "format",
      severity: "warning",
      message: `金額に小数点が含まれています: ${amount} (外貨の可能性)`,
    };
  }

  return null;
}

/** 外れ値閾値を計算 */
function calculateOutlierThresholds(totals: number[]): {
  lowerBound: number;
  upperBound: number;
} {
  if (totals.length < 4) {
    return { lowerBound: 0, upperBound: Infinity };
  }

  const sorted = [...totals].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  // IQR法: 1.5倍を超えると外れ値
  const lowerBound = q1 - iqr * 1.5;
  const upperBound = q3 + iqr * 3; // 上側は3倍（高額レシートは比較的許容）

  return { lowerBound, upperBound };
}

/** 金額外れ値のバリデーション */
function validateAmountOutlier(
  amount: number | undefined,
  thresholds: { lowerBound: number; upperBound: number }
): ValidationIssue | null {
  if (amount === undefined) return null;

  if (amount < thresholds.lowerBound) {
    return {
      field: "amount",
      type: "outlier",
      severity: "warning",
      message: `金額が極端に低いです: \u00A5${amount.toLocaleString()}`,
    };
  }

  if (amount > thresholds.upperBound) {
    return {
      field: "amount",
      type: "outlier",
      severity: "warning",
      message: `金額が極端に高いです: \u00A5${amount.toLocaleString()}`,
    };
  }

  return null;
}

/** 単一レシートのバリデーション */
export function validateReceipt(
  receipt: ReceiptData,
  context: ValidationContext
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 日付バリデーション
  const dateFormatIssue = validateDateFormat(receipt.date);
  if (dateFormatIssue) {
    issues.push(dateFormatIssue);
  } else {
    const dateRangeIssue = validateDateRange(receipt.date, context.targetSegment);
    if (dateRangeIssue) issues.push(dateRangeIssue);
  }

  // 金額バリデーション
  const decimalIssue = validateAmountDecimal(receipt.amount);
  if (decimalIssue) issues.push(decimalIssue);

  // 外れ値検出
  const amounts = context.allResults
    .map((r) => r.amount)
    .filter((t): t is number => t !== undefined);
  const thresholds = calculateOutlierThresholds(amounts);
  const outlierIssue = validateAmountOutlier(receipt.amount, thresholds);
  if (outlierIssue) issues.push(outlierIssue);

  return issues;
}

/** 全レシートのバリデーション */
export function validateAllReceipts(
  results: ReceiptData[],
  targetSegment: string
): ReceiptData[] {
  const context: ValidationContext = {
    targetSegment,
    allResults: results,
  };

  return results.map((receipt) => {
    const issues = validateReceipt(receipt, context);
    return issues.length > 0 ? { ...receipt, issues } : receipt;
  });
}

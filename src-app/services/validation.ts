/**
 * バリデーションサービス
 * expense-summarizer の validation.ts ロジックを移植
 */

import type { ReceiptData, ValidationIssue } from "../types/receipt";
import type { ValidationRule } from "../types/validationRule";
import { DEFAULT_VALIDATION_RULES } from "../types/validationRule";
import { isMerchantSimilar } from "../utils/stringSimilarity";

const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

interface ValidationContext {
  targetSegment: string; // YYYYMM 形式
  allResults: ReceiptData[];
  rules: ValidationRule[];
}

/** ルールを型で検索するヘルパー */
function findRule(
  rules: ValidationRule[],
  type: ValidationRule["type"]
): ValidationRule | undefined {
  return rules.find((r) => r.type === type);
}

/** 日付フォーマットのバリデーション */
function validateDateFormat(
  date: string | undefined,
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;
  if (!date) return null;

  if (!DATE_FORMAT_REGEX.test(date)) {
    return {
      field: "date",
      type: "format",
      severity: rule.severity,
      message: `日付フォーマットが不正です: "${date}" (期待: YYYY-MM-DD)`,
    };
  }

  return null;
}

/** 日付範囲のバリデーション */
function validateDateRange(
  date: string | undefined,
  targetSegment: string,
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;
  if (!date || !DATE_FORMAT_REGEX.test(date)) return null;

  const maxYearDiff = (rule.params.maxYearDiff as number) ?? 1;
  const maxMonthDiff = (rule.params.maxMonthDiff as number) ?? 2;

  const targetYear = parseInt(targetSegment.slice(0, 4), 10);
  const targetMonth = parseInt(targetSegment.slice(4, 6), 10);

  const [yearStr, monthStr] = date.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // 年がmaxYearDiff以上ずれている場合はエラー
  if (Math.abs(year - targetYear) >= maxYearDiff) {
    return {
      field: "date",
      type: "range",
      severity: rule.severity,
      message: `日付の年が対象期間と大きく異なります: ${date} (対象: ${targetYear}年${targetMonth}月)`,
    };
  }

  // 月がmaxMonthDiff以上ずれている場合は警告
  const monthDiff = Math.abs(year * 12 + month - (targetYear * 12 + targetMonth));
  if (monthDiff >= maxMonthDiff) {
    return {
      field: "date",
      type: "range",
      severity: rule.severity,
      message: `日付が対象期間と異なります: ${date} (対象: ${targetYear}年${targetMonth}月)`,
    };
  }

  return null;
}

/** 金額の小数点バリデーション */
function validateAmountDecimal(
  amount: number | undefined,
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;
  if (amount === undefined) return null;

  // 小数点を含む場合は警告（円建てでは通常整数）
  if (!Number.isInteger(amount)) {
    return {
      field: "amount",
      type: "format",
      severity: rule.severity,
      message: `金額に小数点が含まれています: ${amount} (外貨の可能性)`,
    };
  }

  return null;
}

/** 外れ値閾値を計算 */
function calculateOutlierThresholds(
  totals: number[],
  rule: ValidationRule | undefined
): {
  lowerBound: number;
  upperBound: number;
} {
  const lowerMultiplier = (rule?.params.lowerMultiplier as number) ?? 1.5;
  const upperMultiplier = (rule?.params.upperMultiplier as number) ?? 3.0;
  const minSampleSize = (rule?.params.minSampleSize as number) ?? 4;

  if (totals.length < minSampleSize) {
    return { lowerBound: 0, upperBound: Infinity };
  }

  const sorted = [...totals].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.25);
  const q3Index = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  // IQR法: multiplierを使用して閾値を計算
  const lowerBound = q1 - iqr * lowerMultiplier;
  const upperBound = q3 + iqr * upperMultiplier;

  return { lowerBound, upperBound };
}

/** 金額外れ値のバリデーション */
function validateAmountOutlier(
  amount: number | undefined,
  thresholds: { lowerBound: number; upperBound: number },
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;
  if (amount === undefined) return null;

  if (amount < thresholds.lowerBound) {
    return {
      field: "amount",
      type: "outlier",
      severity: rule.severity,
      message: `金額が極端に低いです: \u00A5${amount.toLocaleString()}`,
    };
  }

  if (amount > thresholds.upperBound) {
    return {
      field: "amount",
      type: "outlier",
      severity: rule.severity,
      message: `金額が極端に高いです: \u00A5${amount.toLocaleString()}`,
    };
  }

  return null;
}

/** ファイル重複検出 */
function detectFileDuplicates(
  receipt: ReceiptData,
  allResults: ReceiptData[],
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;

  const duplicates = allResults.filter(
    (r) => r.id !== receipt.id && r.file === receipt.file
  );

  if (duplicates.length > 0) {
    return {
      field: "file",
      type: "duplicate-file",
      severity: rule.severity,
      message: `同じファイル名のレシートが存在します: ${receipt.file}`,
    };
  }
  return null;
}

/** データ重複検出（類似度評価使用） */
function detectDataDuplicates(
  receipt: ReceiptData,
  allResults: ReceiptData[],
  rule: ValidationRule | undefined
): ValidationIssue | null {
  if (!rule?.enabled) return null;
  if (!receipt.date || !receipt.merchant || receipt.amount === undefined) {
    return null;
  }

  const duplicates = allResults.filter((r) => {
    if (r.id === receipt.id) return false;
    if (!r.merchant) return false;
    return (
      r.date === receipt.date &&
      isMerchantSimilar(r.merchant, receipt.merchant!) &&
      r.amount === receipt.amount
    );
  });

  if (duplicates.length > 0) {
    return {
      field: "duplicate",
      type: "duplicate-data",
      severity: rule.severity,
      message: `類似のレシートが存在します: ${receipt.date} / ${receipt.merchant} / ¥${receipt.amount?.toLocaleString()}`,
    };
  }
  return null;
}

/** 単一レシートのバリデーション */
export function validateReceipt(
  receipt: ReceiptData,
  context: ValidationContext,
  rules?: ValidationRule[]
): ValidationIssue[] {
  const effectiveRules = rules ?? context.rules;
  const issues: ValidationIssue[] = [];

  // 日付バリデーション
  const dateFormatRule = findRule(effectiveRules, "date-format");
  const dateFormatIssue = validateDateFormat(receipt.date, dateFormatRule);
  if (dateFormatIssue) {
    issues.push(dateFormatIssue);
  } else {
    const dateRangeRule = findRule(effectiveRules, "date-range");
    const dateRangeIssue = validateDateRange(
      receipt.date,
      context.targetSegment,
      dateRangeRule
    );
    if (dateRangeIssue) issues.push(dateRangeIssue);
  }

  // 金額バリデーション
  const amountDecimalRule = findRule(effectiveRules, "amount-decimal");
  const decimalIssue = validateAmountDecimal(receipt.amount, amountDecimalRule);
  if (decimalIssue) issues.push(decimalIssue);

  // 外れ値検出
  const amountOutlierRule = findRule(effectiveRules, "amount-outlier");
  const amounts = context.allResults
    .map((r) => r.amount)
    .filter((t): t is number => t !== undefined);
  const thresholds = calculateOutlierThresholds(amounts, amountOutlierRule);
  const outlierIssue = validateAmountOutlier(
    receipt.amount,
    thresholds,
    amountOutlierRule
  );
  if (outlierIssue) issues.push(outlierIssue);

  // 重複検出
  const duplicateFileRule = findRule(effectiveRules, "duplicate-file");
  const fileDuplicateIssue = detectFileDuplicates(
    receipt,
    context.allResults,
    duplicateFileRule
  );
  if (fileDuplicateIssue) issues.push(fileDuplicateIssue);

  const duplicateDataRule = findRule(effectiveRules, "duplicate-data");
  const dataDuplicateIssue = detectDataDuplicates(
    receipt,
    context.allResults,
    duplicateDataRule
  );
  if (dataDuplicateIssue) issues.push(dataDuplicateIssue);

  return issues;
}

/** デフォルトルールをValidationRule[]形式に変換 */
function getDefaultRules(): ValidationRule[] {
  return DEFAULT_VALIDATION_RULES.map((rule, index) => ({
    ...rule,
    id: `default-${index}`,
    createdAt: new Date().toISOString(),
  }));
}

/** 全レシートのバリデーション */
export function validateAllReceipts(
  results: ReceiptData[],
  targetSegment: string,
  rules?: ValidationRule[]
): ReceiptData[] {
  const effectiveRules = rules ?? getDefaultRules();
  const context: ValidationContext = {
    targetSegment,
    allResults: results,
    rules: effectiveRules,
  };

  return results.map((receipt) => {
    const issues = validateReceipt(receipt, context);
    // 常にissuesを明示的に設定（問題なしの場合はundefined）
    return { ...receipt, issues: issues.length > 0 ? issues : undefined };
  });
}

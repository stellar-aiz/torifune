/**
 * バリデーションルールの型定義
 */

/** バリデーションルールの種類 */
export type ValidationRuleType =
  | "date-format"
  | "date-range"
  | "amount-decimal"
  | "amount-outlier"
  | "duplicate-file"
  | "duplicate-data"
  | "custom";

/** バリデーションルール */
export interface ValidationRule {
  id: string; // nanoid(6)
  type: ValidationRuleType;
  name: string;
  description: string;
  enabled: boolean;
  severity: "warning" | "error";
  params: Record<string, number | string | boolean>;
  isBuiltIn: boolean; // 組み込みルールかどうか
  createdAt: string; // ISO8601
}

/** バリデーションルール設定 */
export interface ValidationRulesSettings {
  rules: ValidationRule[];
  version: number;
}

/** デフォルトのバリデーションルール定義 */
export const DEFAULT_VALIDATION_RULES: Omit<ValidationRule, "id" | "createdAt">[] = [
  {
    type: "date-format",
    name: "日付フォーマット",
    description: "日付がYYYY-MM-DD形式であることを確認します",
    enabled: true,
    severity: "error",
    params: {},
    isBuiltIn: true,
  },
  {
    type: "date-range",
    name: "日付範囲",
    description: "日付が対象期間の範囲内であることを確認します",
    enabled: true,
    severity: "error",
    params: {
      maxYearDiff: 1, // 年の差がこれ以上でエラー
      maxMonthDiff: 2, // 月の差がこれ以上で警告
    },
    isBuiltIn: true,
  },
  {
    type: "amount-decimal",
    name: "金額小数点",
    description: "金額に小数点が含まれている場合に警告します（外貨の可能性）",
    enabled: true,
    severity: "warning",
    params: {},
    isBuiltIn: true,
  },
  {
    type: "amount-outlier",
    name: "金額外れ値",
    description: "IQR法による外れ値検出で極端に高い/低い金額を警告します",
    enabled: true,
    severity: "warning",
    params: {
      lowerMultiplier: 1.5, // Q1 - IQR * lowerMultiplier が下限
      upperMultiplier: 3.0, // Q3 + IQR * upperMultiplier が上限（高額は許容度高め）
      minSampleSize: 4, // 外れ値検出に必要な最小サンプル数
    },
    isBuiltIn: true,
  },
  {
    type: "duplicate-file",
    name: "ファイル重複",
    description: "同じファイル名のレシートが存在する場合に警告します",
    enabled: true,
    severity: "warning",
    params: {},
    isBuiltIn: true,
  },
  {
    type: "duplicate-data",
    name: "データ重複",
    description: "同じ日付・店舗・金額の組み合わせを持つレシートが存在する場合に警告します",
    enabled: true,
    severity: "warning",
    params: {},
    isBuiltIn: true,
  },
];

/** 新規ルールを作成するためのヘルパー */
export function createValidationRule(
  data: Omit<ValidationRule, "id" | "createdAt">
): ValidationRule {
  return {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
}

/** デフォルトルールから初期設定を生成 */
export function getDefaultValidationRulesSettings(): ValidationRulesSettings {
  return {
    rules: DEFAULT_VALIDATION_RULES.map((rule) => createValidationRule(rule)),
    version: 1,
  };
}

/** 6桁のIDを生成（nanoid相当の簡易実装） */
function generateId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

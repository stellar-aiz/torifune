/**
 * 勘定科目マッチングサービス
 * 店舗名から勘定科目を正規表現でマッチングする
 */

import type { AccountCategoryRule } from "../types/accountCategoryRule";

/**
 * 店舗名から勘定科目をマッチングする
 * リスト上位のルールを優先（最初にマッチしたルールを適用）
 */
export function matchAccountCategory(
  merchant: string | undefined,
  rules: AccountCategoryRule[]
): string | undefined {
  if (!merchant) {
    return undefined;
  }

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    try {
      const regex = new RegExp(rule.pattern, rule.flags);
      if (regex.test(merchant)) {
        return rule.accountCategory;
      }
    } catch {
      // 無効な正規表現はスキップ
      continue;
    }
  }

  return undefined;
}

/**
 * 正規表現パターンを検証する
 */
export function validatePattern(
  pattern: string,
  flags: string
): { valid: boolean; error?: string } {
  if (!pattern.trim()) {
    return { valid: false, error: "パターンを入力してください" };
  }

  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : "無効な正規表現です",
    };
  }
}

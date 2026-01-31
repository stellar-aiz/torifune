/**
 * 勘定科目ルールの型定義
 */

/** 勘定科目マッチングルール */
export interface AccountCategoryRule {
  id: string; // nanoid(6)
  pattern: string; // 正規表現パターン
  flags: string; // 正規表現フラグ ("i" など)
  accountCategory: string; // マッチ時に設定する勘定科目
  enabled: boolean; // 有効/無効
  createdAt: string; // ISO8601
}

/** 勘定科目ルール設定 */
export interface AccountCategoryRulesSettings {
  rules: AccountCategoryRule[];
  version: number;
}

/** デフォルトの勘定科目ルール */
export const DEFAULT_ACCOUNT_CATEGORY_RULES: Omit<
  AccountCategoryRule,
  "id" | "createdAt"
>[] = [
  {
    pattern: "GO株式会社",
    flags: "i",
    accountCategory: "旅費交通費",
    enabled: true,
  },
  {
    pattern: "タクシー",
    flags: "i",
    accountCategory: "旅費交通費",
    enabled: true,
  },
  {
    pattern: "グリーンキャブ",
    flags: "i",
    accountCategory: "旅費交通費",
    enabled: true,
  },
  {
    pattern: "自動車",
    flags: "i",
    accountCategory: "旅費交通費",
    enabled: true,
  },
  { pattern: "交通", flags: "i", accountCategory: "旅費交通費", enabled: true },
];

/** 新規ルールを作成するためのヘルパー */
export function createAccountCategoryRule(
  data: Omit<AccountCategoryRule, "id" | "createdAt">,
): AccountCategoryRule {
  return {
    ...data,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
}

/** デフォルトルールから初期設定を生成 */
export function createDefaultRulesSettings(): AccountCategoryRulesSettings {
  return {
    rules: DEFAULT_ACCOUNT_CATEGORY_RULES.map((rule) =>
      createAccountCategoryRule(rule),
    ),
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

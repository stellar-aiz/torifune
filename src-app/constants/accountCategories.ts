export const ACCOUNT_CATEGORIES = [
  "旅費交通費",
  "交際費",
  "会議費",
  "通信費",
  "消耗品費",
  "新聞図書費",
  "福利厚生費",
  "支払手数料",
  "地代家賃",
  "租税公課",
  "その他",
] as const;

export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

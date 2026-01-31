/**
 * 文字列類似度評価ユーティリティ
 */

/** 文字列の正規化（全角→半角、スペース削除等） */
function normalizeString(str: string): string {
  return str
    .replace(/　+/g, " ") // 全角スペース→半角
    .replace(/\s+/g, "") // スペース削除
    .toLowerCase()
    .replace(/[ー—−‐]/g, "-"); // 長音符統一
}

/** Levenshtein距離の計算 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/** 類似度スコア（0-1、1.0が完全一致） */
export function calculateSimilarity(s1: string, s2: string): number {
  const n1 = normalizeString(s1);
  const n2 = normalizeString(s2);
  if (n1 === n2) return 1.0;

  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  if (maxLength === 0) return 1.0;
  return 1 - distance / maxLength;
}

/** 店舗名が類似しているか判定（閾値0.85） */
export function isMerchantSimilar(
  name1: string,
  name2: string,
  threshold = 0.85,
): boolean {
  return calculateSimilarity(name1, name2) >= threshold;
}

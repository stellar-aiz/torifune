/**
 * 使用量API
 * 月間使用量の取得に関するAPI呼び出しを担当
 */

import { get } from "./client";

/** 現在の使用量レスポンス */
export interface CurrentUsageResponse {
  /** 現在の処理数 */
  processedCount: number;
  /** 月間上限数 */
  limit: number;
  /** 請求期間の開始日 (ISO8601) */
  periodStart: string;
  /** 請求期間の終了日 (ISO8601) */
  periodEnd: string;
}

/** 使用量履歴アイテム */
export interface UsageHistoryItem {
  /** 年月 (YYYY-MM形式) */
  yearMonth: string;
  /** 処理数 */
  processedCount: number;
  /** その月の上限数 */
  limit: number;
}

/** 使用量履歴レスポンス */
export interface UsageHistoryResponse {
  /** 履歴データ */
  history: UsageHistoryItem[];
}

/**
 * 現在月の使用量を取得
 */
export async function getCurrentUsage(): Promise<CurrentUsageResponse> {
  return get<CurrentUsageResponse>("/api/v1/usage/current");
}

/**
 * 使用量履歴を取得
 * @param months - 取得する月数（デフォルト: 12ヶ月）
 */
export async function getUsageHistory(
  months?: number,
): Promise<UsageHistoryResponse> {
  return get<UsageHistoryResponse>("/api/v1/usage/history", {
    params: months ? { months } : undefined,
  });
}

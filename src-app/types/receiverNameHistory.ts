/**
 * 宛名履歴の型定義
 */

export interface ReceiverNameHistory {
  /** 宛名リスト（最近使用順） */
  names: string[];
  /** バージョン番号 */
  version: number;
}

/**
 * 空の履歴を作成
 */
export function createEmptyHistory(): ReceiverNameHistory {
  return {
    names: [],
    version: 1,
  };
}

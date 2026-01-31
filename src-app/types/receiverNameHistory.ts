/**
 * 宛名設定の型定義
 */

export interface ReceiverNameSettings {
  /** 登録済み宛名（意図的に登録したもの） */
  registeredNames: string[];
  /** 入力履歴（自動的に追加されたもの） */
  historyNames: string[];
  /** バージョン番号 */
  version: number;
}

/**
 * 空の設定を作成
 */
export function createEmptySettings(): ReceiverNameSettings {
  return {
    registeredNames: [],
    historyNames: [],
    version: 2,
  };
}

/**
 * 旧形式からの移行（後方互換性）
 */
export function migrateFromV1(oldData: {
  names?: string[];
  version?: number;
}): ReceiverNameSettings {
  return {
    registeredNames: [],
    historyNames: oldData.names ?? [],
    version: 2,
  };
}

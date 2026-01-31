/**
 * 宛名設定ストアフック
 * 宛名の永続化とCRUD操作を提供
 * シングルトンパターンで全コンポーネント間で状態を共有
 */

import { useEffect, useCallback, useSyncExternalStore } from "react";
import type { ReceiverNameSettings } from "../types/receiverNameHistory";
import {
  createEmptySettings,
  migrateFromV1,
} from "../types/receiverNameHistory";
import {
  getReceiverNameHistory,
  saveReceiverNameHistory,
} from "../services/tauri/commands";

// =============================================================================
// グローバルシングルトン状態
// =============================================================================

interface GlobalState {
  registeredNames: string[];
  historyNames: string[];
  isLoading: boolean;
  error: string | null;
}

let globalState: GlobalState = {
  registeredNames: [],
  historyNames: [],
  isLoading: true,
  error: null,
};

let isInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GlobalState {
  return globalState;
}

function setGlobalState(updates: Partial<GlobalState>) {
  globalState = { ...globalState, ...updates };
  notifyListeners();
}

// =============================================================================
// グローバル操作関数
// =============================================================================

async function loadSettingsGlobal(): Promise<void> {
  setGlobalState({ isLoading: true, error: null });

  try {
    const data = await getReceiverNameHistory();

    if (data) {
      // バージョンチェックとマイグレーション
      if (data.version === 2 && data.registeredNames && data.historyNames) {
        // v2形式
        setGlobalState({
          registeredNames: data.registeredNames,
          historyNames: data.historyNames,
          isLoading: false,
        });
      } else if (data.names) {
        // v1形式からマイグレーション
        const migrated = migrateFromV1(data);
        await saveSettingsGlobal(
          migrated.registeredNames,
          migrated.historyNames,
        );
        setGlobalState({
          registeredNames: migrated.registeredNames,
          historyNames: migrated.historyNames,
          isLoading: false,
        });
      } else {
        // 空または不明な形式
        const empty = createEmptySettings();
        await saveSettingsGlobal(empty.registeredNames, empty.historyNames);
        setGlobalState({
          registeredNames: empty.registeredNames,
          historyNames: empty.historyNames,
          isLoading: false,
        });
      }
    } else {
      // 初回起動時は空の設定で初期化
      const empty = createEmptySettings();
      await saveSettingsGlobal(empty.registeredNames, empty.historyNames);
      setGlobalState({
        registeredNames: empty.registeredNames,
        historyNames: empty.historyNames,
        isLoading: false,
      });
    }
  } catch (e) {
    setGlobalState({
      error: e instanceof Error ? e.message : "設定の読み込みに失敗しました",
      isLoading: false,
    });
  }
}

async function saveSettingsGlobal(
  registeredNames: string[],
  historyNames: string[],
): Promise<void> {
  const settings: ReceiverNameSettings = {
    registeredNames,
    historyNames,
    version: 2,
  };
  await saveReceiverNameHistory(settings);
  setGlobalState({ registeredNames, historyNames });
}

/** 登録済み宛名を追加 */
async function addRegisteredNameGlobal(name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  try {
    // 登録済みから重複を除外して先頭に追加
    const filteredRegistered = globalState.registeredNames.filter(
      (n) => n !== trimmedName,
    );
    const newRegistered = [trimmedName, ...filteredRegistered];
    // 履歴からも削除（登録済みに昇格したので）
    const newHistory = globalState.historyNames.filter(
      (n) => n !== trimmedName,
    );
    await saveSettingsGlobal(newRegistered, newHistory);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "宛名の追加に失敗しました",
    );
  }
}

/** 履歴に宛名を追加（入力時に自動で呼ばれる） */
async function addToHistoryGlobal(name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  // 登録済みに既にある場合は履歴に追加しない
  if (globalState.registeredNames.includes(trimmedName)) {
    return;
  }

  try {
    // 履歴から重複を除外して先頭に追加
    const filteredHistory = globalState.historyNames.filter(
      (n) => n !== trimmedName,
    );
    const newHistory = [trimmedName, ...filteredHistory];
    await saveSettingsGlobal(globalState.registeredNames, newHistory);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "履歴の追加に失敗しました",
    );
  }
}

/** 履歴から登録済みに昇格 */
async function promoteToRegisteredGlobal(name: string): Promise<void> {
  try {
    // 履歴から削除
    const newHistory = globalState.historyNames.filter((n) => n !== name);
    // 登録済みに追加（重複除外して先頭に）
    const filteredRegistered = globalState.registeredNames.filter(
      (n) => n !== name,
    );
    const newRegistered = [name, ...filteredRegistered];
    await saveSettingsGlobal(newRegistered, newHistory);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "宛名の登録に失敗しました",
    );
  }
}

/** 登録済み宛名を削除 */
async function removeRegisteredNameGlobal(name: string): Promise<void> {
  try {
    const newRegistered = globalState.registeredNames.filter((n) => n !== name);
    await saveSettingsGlobal(newRegistered, globalState.historyNames);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "宛名の削除に失敗しました",
    );
  }
}

/** 履歴から宛名を削除 */
async function removeFromHistoryGlobal(name: string): Promise<void> {
  try {
    const newHistory = globalState.historyNames.filter((n) => n !== name);
    await saveSettingsGlobal(globalState.registeredNames, newHistory);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "履歴の削除に失敗しました",
    );
  }
}

/** 全履歴をクリア */
async function clearHistoryGlobal(): Promise<void> {
  try {
    await saveSettingsGlobal(globalState.registeredNames, []);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "履歴のクリアに失敗しました",
    );
  }
}

/** 全登録済みをクリア */
async function clearRegisteredGlobal(): Promise<void> {
  try {
    await saveSettingsGlobal([], globalState.historyNames);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "登録済み宛名のクリアに失敗しました",
    );
  }
}

// =============================================================================
// React Hook
// =============================================================================

export interface ReceiverNameHistoryStoreState {
  /** 登録済み宛名 */
  registeredNames: string[];
  /** 入力履歴 */
  historyNames: string[];
  /** 全ての宛名（登録済み + 履歴、ドロップダウン用） */
  allNames: string[];
  isLoading: boolean;
  error: string | null;
}

export interface ReceiverNameHistoryStoreActions {
  /** 登録済み宛名を追加 */
  addRegisteredName: (name: string) => Promise<void>;
  /** 履歴に追加（入力時に自動で呼ばれる） */
  addToHistory: (name: string) => Promise<void>;
  /** 履歴から登録済みに昇格 */
  promoteToRegistered: (name: string) => Promise<void>;
  /** 登録済み宛名を削除 */
  removeRegisteredName: (name: string) => Promise<void>;
  /** 履歴から削除 */
  removeFromHistory: (name: string) => Promise<void>;
  /** 全履歴をクリア */
  clearHistory: () => Promise<void>;
  /** 全登録済みをクリア */
  clearRegistered: () => Promise<void>;
  /** 再読み込み */
  reload: () => Promise<void>;
}

export type UseReceiverNameHistoryStoreReturn = ReceiverNameHistoryStoreState &
  ReceiverNameHistoryStoreActions;

export function useReceiverNameHistoryStore(): UseReceiverNameHistoryStoreReturn {
  // useSyncExternalStoreでグローバル状態をサブスクライブ
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 初期化（一度だけ実行）
  useEffect(() => {
    if (!isInitialized) {
      isInitialized = true;
      loadSettingsGlobal();
    }
  }, []);

  // アクションをメモ化
  const addRegisteredName = useCallback(addRegisteredNameGlobal, []);
  const addToHistory = useCallback(addToHistoryGlobal, []);
  const promoteToRegistered = useCallback(promoteToRegisteredGlobal, []);
  const removeRegisteredName = useCallback(removeRegisteredNameGlobal, []);
  const removeFromHistory = useCallback(removeFromHistoryGlobal, []);
  const clearHistory = useCallback(clearHistoryGlobal, []);
  const clearRegistered = useCallback(clearRegisteredGlobal, []);
  const reload = useCallback(loadSettingsGlobal, []);

  // 登録済み + 履歴を結合（登録済みが先）
  const allNames = [...state.registeredNames, ...state.historyNames];

  return {
    registeredNames: state.registeredNames,
    historyNames: state.historyNames,
    allNames,
    isLoading: state.isLoading,
    error: state.error,
    addRegisteredName,
    addToHistory,
    promoteToRegistered,
    removeRegisteredName,
    removeFromHistory,
    clearHistory,
    clearRegistered,
    reload,
  };
}

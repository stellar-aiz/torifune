/**
 * 宛名履歴ストアフック
 * 宛名履歴の永続化とCRUD操作を提供
 * シングルトンパターンで全コンポーネント間で状態を共有
 */

import { useEffect, useCallback, useSyncExternalStore } from "react";
import type { ReceiverNameHistory } from "../types/receiverNameHistory";
import { createEmptyHistory } from "../types/receiverNameHistory";
import {
  getReceiverNameHistory,
  saveReceiverNameHistory,
} from "../services/tauri/commands";

// =============================================================================
// グローバルシングルトン状態
// =============================================================================

interface GlobalState {
  names: string[];
  isLoading: boolean;
  error: string | null;
}

let globalState: GlobalState = {
  names: [],
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

async function loadHistoryGlobal(): Promise<void> {
  setGlobalState({ isLoading: true, error: null });

  try {
    const history = await getReceiverNameHistory();
    if (history && history.names && history.names.length > 0) {
      setGlobalState({ names: history.names, isLoading: false });
    } else {
      // 初回起動時は空の履歴で初期化
      const emptyHistory = createEmptyHistory();
      await saveReceiverNameHistory(emptyHistory);
      setGlobalState({ names: emptyHistory.names, isLoading: false });
    }
  } catch (e) {
    setGlobalState({
      error: e instanceof Error ? e.message : "履歴の読み込みに失敗しました",
      isLoading: false,
    });
  }
}

async function saveNamesGlobal(newNames: string[]): Promise<void> {
  const history: ReceiverNameHistory = {
    names: newNames,
    version: 1,
  };
  await saveReceiverNameHistory(history);
  setGlobalState({ names: newNames });
}

async function addNameGlobal(name: string): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  try {
    // 既存の宛名を除外して先頭に追加
    const filteredNames = globalState.names.filter((n) => n !== trimmedName);
    const newNames = [trimmedName, ...filteredNames];
    await saveNamesGlobal(newNames);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "宛名の追加に失敗しました"
    );
  }
}

async function removeNameGlobal(name: string): Promise<void> {
  try {
    const newNames = globalState.names.filter((n) => n !== name);
    await saveNamesGlobal(newNames);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "宛名の削除に失敗しました"
    );
  }
}

async function clearAllGlobal(): Promise<void> {
  try {
    await saveNamesGlobal([]);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "履歴のクリアに失敗しました"
    );
  }
}

// =============================================================================
// React Hook
// =============================================================================

export interface ReceiverNameHistoryStoreState {
  names: string[];
  isLoading: boolean;
  error: string | null;
}

export interface ReceiverNameHistoryStoreActions {
  /** 履歴に宛名を追加（既存なら先頭に移動） */
  addName: (name: string) => Promise<void>;
  /** 履歴から宛名を削除 */
  removeName: (name: string) => Promise<void>;
  /** 全履歴をクリア */
  clearAll: () => Promise<void>;
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
      loadHistoryGlobal();
    }
  }, []);

  // アクションをメモ化
  const addName = useCallback(addNameGlobal, []);
  const removeName = useCallback(removeNameGlobal, []);
  const clearAll = useCallback(clearAllGlobal, []);
  const reload = useCallback(loadHistoryGlobal, []);

  return {
    names: state.names,
    isLoading: state.isLoading,
    error: state.error,
    addName,
    removeName,
    clearAll,
    reload,
  };
}

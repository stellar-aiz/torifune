/**
 * 勘定科目ルールストアフック
 * ルールの永続化とCRUD操作を提供
 */

import { useState, useEffect, useCallback } from "react";
import type {
  AccountCategoryRule,
  AccountCategoryRulesSettings,
} from "../types/accountCategoryRule";
import {
  createAccountCategoryRule,
  createDefaultRulesSettings,
} from "../types/accountCategoryRule";
import {
  getAccountCategoryRules,
  saveAccountCategoryRules,
} from "../services/tauri/commands";

export interface AccountCategoryRulesStoreState {
  rules: AccountCategoryRule[];
  isLoading: boolean;
  error: string | null;
}

export interface AccountCategoryRulesStoreActions {
  addRule: (
    rule: Omit<AccountCategoryRule, "id" | "createdAt">,
  ) => Promise<void>;
  updateRule: (
    id: string,
    updates: Partial<AccountCategoryRule>,
  ) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (rules: AccountCategoryRule[]) => Promise<void>;
  resetToDefault: () => Promise<void>;
  reload: () => Promise<void>;
}

export type UseAccountCategoryRulesStoreReturn =
  AccountCategoryRulesStoreState & AccountCategoryRulesStoreActions;

export function useAccountCategoryRulesStore(): UseAccountCategoryRulesStoreReturn {
  const [rules, setRules] = useState<AccountCategoryRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 設定を保存するヘルパー */
  const saveRules = useCallback(async (newRules: AccountCategoryRule[]) => {
    const settings: AccountCategoryRulesSettings = {
      rules: newRules,
      version: 1,
    };
    await saveAccountCategoryRules(settings);
    setRules(newRules);
  }, []);

  /** 設定を読み込む */
  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await getAccountCategoryRules();
      if (settings && settings.rules && settings.rules.length > 0) {
        setRules(settings.rules);
      } else {
        // 初回起動時はデフォルトルールで初期化
        const defaultSettings = createDefaultRulesSettings();
        await saveAccountCategoryRules(defaultSettings);
        setRules(defaultSettings.rules);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "ルールの読み込みに失敗しました",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** ルールを追加 */
  const addRule = useCallback(
    async (rule: Omit<AccountCategoryRule, "id" | "createdAt">) => {
      try {
        const newRule = createAccountCategoryRule(rule);
        await saveRules([...rules, newRule]);
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "ルールの追加に失敗しました",
        );
      }
    },
    [rules, saveRules],
  );

  /** ルールを更新 */
  const updateRule = useCallback(
    async (id: string, updates: Partial<AccountCategoryRule>) => {
      try {
        const newRules = rules.map((rule) =>
          rule.id === id ? { ...rule, ...updates } : rule,
        );
        await saveRules(newRules);
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "ルールの更新に失敗しました",
        );
      }
    },
    [rules, saveRules],
  );

  /** ルールを削除 */
  const deleteRule = useCallback(
    async (id: string) => {
      try {
        const newRules = rules.filter((rule) => rule.id !== id);
        await saveRules(newRules);
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "ルールの削除に失敗しました",
        );
      }
    },
    [rules, saveRules],
  );

  /** ルールの順序を変更 */
  const reorderRules = useCallback(
    async (newRules: AccountCategoryRule[]) => {
      try {
        await saveRules(newRules);
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "ルールの並び替えに失敗しました",
        );
      }
    },
    [saveRules],
  );

  /** デフォルトにリセット */
  const resetToDefault = useCallback(async () => {
    try {
      const defaultSettings = createDefaultRulesSettings();
      await saveAccountCategoryRules(defaultSettings);
      setRules(defaultSettings.rules);
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "リセットに失敗しました",
      );
    }
  }, []);

  /** 初期ロード */
  useEffect(() => {
    loadRules();
  }, [loadRules]);

  return {
    rules,
    isLoading,
    error,
    addRule,
    updateRule,
    deleteRule,
    reorderRules,
    resetToDefault,
    reload: loadRules,
  };
}

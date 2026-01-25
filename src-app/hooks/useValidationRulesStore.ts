/**
 * バリデーションルールストアフック
 * ルールの永続化と操作を提供
 */

import { useState, useEffect, useCallback } from "react";
import type {
  ValidationRule,
  ValidationRulesSettings,
} from "../types/validationRule";
import {
  getDefaultValidationRulesSettings,
  mergeWithDefaultRules,
} from "../types/validationRule";
import {
  getValidationRules,
  saveValidationRules,
} from "../services/tauri/commands";

export interface ValidationRulesStoreState {
  rules: ValidationRule[];
  isLoading: boolean;
  error: string | null;
}

export interface ValidationRulesStoreActions {
  updateRule: (id: string, updates: Partial<ValidationRule>) => Promise<void>;
  resetToDefault: () => Promise<void>;
  reload: () => Promise<void>;
}

export type UseValidationRulesStoreReturn = ValidationRulesStoreState &
  ValidationRulesStoreActions;

export function useValidationRulesStore(): UseValidationRulesStoreReturn {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 設定を保存するヘルパー */
  const saveRules = useCallback(async (newRules: ValidationRule[]) => {
    const settings: ValidationRulesSettings = {
      rules: newRules,
      version: 1,
    };
    await saveValidationRules(settings);
    setRules(newRules);
  }, []);

  /** 設定を読み込む */
  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await getValidationRules();
      if (settings && settings.rules && settings.rules.length > 0) {
        // 新しい組み込みルールがあればマージ
        const { rules: mergedRules, hasNewRules } = mergeWithDefaultRules(
          settings.rules
        );
        if (hasNewRules) {
          const updatedSettings: ValidationRulesSettings = {
            rules: mergedRules,
            version: settings.version,
          };
          await saveValidationRules(updatedSettings);
        }
        setRules(mergedRules);
      } else {
        // 初回起動時はデフォルトルールで初期化
        const defaultSettings = getDefaultValidationRulesSettings();
        await saveValidationRules(defaultSettings);
        setRules(defaultSettings.rules);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "バリデーションルールの読み込みに失敗しました"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** ルールを更新 */
  const updateRule = useCallback(
    async (id: string, updates: Partial<ValidationRule>) => {
      try {
        const newRules = rules.map((rule) =>
          rule.id === id ? { ...rule, ...updates } : rule
        );
        await saveRules(newRules);
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : "ルールの更新に失敗しました"
        );
      }
    },
    [rules, saveRules]
  );

  /** デフォルトにリセット */
  const resetToDefault = useCallback(async () => {
    try {
      const defaultSettings = getDefaultValidationRulesSettings();
      await saveValidationRules(defaultSettings);
      setRules(defaultSettings.rules);
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "リセットに失敗しました"
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
    updateRule,
    resetToDefault,
    reload: loadRules,
  };
}

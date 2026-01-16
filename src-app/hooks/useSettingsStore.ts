/**
 * 設定ストアフック
 * tauri-plugin-store を使用した設定の永続化
 */

import { useState, useEffect, useCallback } from "react";
import type { OcrSettings } from "../types/receipt";
import { getOcrSettings, saveOcrSettings } from "../services/tauri/commands";

export interface SettingsStoreState {
  settings: OcrSettings;
  isLoading: boolean;
  error: string | null;
}

export interface SettingsStoreActions {
  saveSettings: (settings: OcrSettings) => Promise<void>;
  reload: () => Promise<void>;
}

export type UseSettingsStoreReturn = SettingsStoreState & SettingsStoreActions;

export function useSettingsStore(): UseSettingsStoreReturn {
  const [settings, setSettings] = useState<OcrSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 設定を読み込む */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedSettings = await getOcrSettings();
      setSettings(loadedSettings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "設定の読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** 設定を保存する */
  const saveSettingsAction = useCallback(async (newSettings: OcrSettings) => {
    try {
      await saveOcrSettings(newSettings);
      setSettings(newSettings);
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "設定の保存に失敗しました"
      );
    }
  }, []);

  /** 初期ロード */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    saveSettings: saveSettingsAction,
    reload: loadSettings,
  };
}

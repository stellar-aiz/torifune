/**
 * 設定ストアフック
 * tauri-plugin-store を使用した設定の永続化
 */

import { useState, useEffect, useCallback } from "react";
import type { OcrSettings, OcrProvider } from "../types/receipt";
import { getOcrSettings, saveOcrSettings } from "../services/tauri/commands";

/**
 * 環境変数からデフォルト設定を取得
 * ビルド時に .env の値が埋め込まれる
 */
function getDefaultSettings(): OcrSettings {
  const provider = import.meta.env.VITE_OCR_PROVIDER;
  return {
    provider: (provider === "veryfi" ? "veryfi" : "googledocumentai") as OcrProvider,
    // Google Document AI
    projectId: import.meta.env.VITE_GOOGLE_PROJECT_ID || undefined,
    location: import.meta.env.VITE_GOOGLE_LOCATION || undefined,
    processorId: import.meta.env.VITE_GOOGLE_PROCESSOR_ID || undefined,
    serviceAccountJson: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON || undefined,
    // Veryfi
    veryfiClientId: import.meta.env.VITE_VERYFI_CLIENT_ID || undefined,
    veryfiClientSecret: import.meta.env.VITE_VERYFI_CLIENT_SECRET || undefined,
    veryfiUsername: import.meta.env.VITE_VERYFI_USERNAME || undefined,
    veryfiApiKey: import.meta.env.VITE_VERYFI_API_KEY || undefined,
  };
}

/**
 * 保存された設定とデフォルト設定をマージ
 * 保存された値が優先され、未設定の項目はデフォルト値を使用
 */
function mergeWithDefaults(saved: OcrSettings): OcrSettings {
  const defaults = getDefaultSettings();
  return {
    provider: saved.provider ?? defaults.provider,
    projectId: saved.projectId ?? defaults.projectId,
    location: saved.location ?? defaults.location,
    processorId: saved.processorId ?? defaults.processorId,
    serviceAccountJson: saved.serviceAccountJson ?? defaults.serviceAccountJson,
    veryfiClientId: saved.veryfiClientId ?? defaults.veryfiClientId,
    veryfiClientSecret: saved.veryfiClientSecret ?? defaults.veryfiClientSecret,
    veryfiUsername: saved.veryfiUsername ?? defaults.veryfiUsername,
    veryfiApiKey: saved.veryfiApiKey ?? defaults.veryfiApiKey,
  };
}

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
  const [settings, setSettings] = useState<OcrSettings>(getDefaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** 設定を読み込む */
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedSettings = await getOcrSettings();
      setSettings(mergeWithDefaults(loadedSettings));
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

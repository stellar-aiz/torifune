//! Tauriコマンド
//!
//! フロントエンドから呼び出されるTauriコマンドを定義する。

use crate::providers::{OcrProgressEvent, OcrProviderRegistry, OcrResult, OcrSettings};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

/// OCR設定を取得
#[tauri::command]
pub async fn get_ocr_settings(app: AppHandle) -> Result<OcrSettings, String> {
    let store = app
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    let settings = store
        .get("ocr_settings")
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default();

    Ok(settings)
}

/// OCR設定を保存
#[tauri::command]
pub async fn save_ocr_settings(app: AppHandle, settings: OcrSettings) -> Result<(), String> {
    let store = app
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    store
        .set(
            "ocr_settings",
            serde_json::to_value(&settings).map_err(|e| e.to_string())?,
        );

    store
        .save()
        .map_err(|e| format!("設定の保存に失敗しました: {}", e))?;

    Ok(())
}

/// プロバイダー接続テスト
#[tauri::command]
pub async fn test_provider_connection(
    app: AppHandle,
    registry: State<'_, Arc<Mutex<OcrProviderRegistry>>>,
) -> Result<(), String> {
    let settings = get_ocr_settings(app).await?;
    let registry = registry.lock().await;

    let provider = registry
        .get_default_provider()
        .ok_or("OCRプロバイダーが見つかりません")?;

    provider.test_connection(&settings).await
}

/// 単一ファイルのOCR処理
#[tauri::command]
pub async fn ocr_receipt(
    app: AppHandle,
    registry: State<'_, Arc<Mutex<OcrProviderRegistry>>>,
    file_path: String,
    file_content: String,
    mime_type: String,
) -> Result<OcrResult, String> {
    let settings = get_ocr_settings(app).await?;
    let registry = registry.lock().await;

    let provider = registry
        .get_default_provider()
        .ok_or("OCRプロバイダーが見つかりません")?;

    match provider
        .extract_receipt(&file_path, &file_content, &mime_type, &settings)
        .await
    {
        Ok(data) => Ok(OcrResult::success(data)),
        Err(e) => Ok(OcrResult::failure(e)),
    }
}

/// OCR処理リクエスト
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrRequest {
    pub file_path: String,
    pub file_content: String,
    pub mime_type: String,
}

/// バッチOCR処理
#[tauri::command]
pub async fn batch_ocr_receipts(
    app: AppHandle,
    registry: State<'_, Arc<Mutex<OcrProviderRegistry>>>,
    requests: Vec<OcrRequest>,
) -> Result<Vec<OcrResult>, String> {
    let settings = get_ocr_settings(app.clone()).await?;
    let registry_guard = registry.lock().await;

    let provider = registry_guard
        .get_default_provider()
        .ok_or("OCRプロバイダーが見つかりません")?
        .clone();

    drop(registry_guard);

    let total = requests.len();
    let mut results = Vec::with_capacity(total);

    for (index, request) in requests.into_iter().enumerate() {
        let file_name = std::path::Path::new(&request.file_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(&request.file_path)
            .to_string();

        // 進捗イベントを発火（処理開始）
        let _ = app.emit(
            "ocr-progress",
            OcrProgressEvent {
                current: index,
                total,
                file_name: file_name.clone(),
                result: None,
            },
        );

        let result = match provider
            .extract_receipt(
                &request.file_path,
                &request.file_content,
                &request.mime_type,
                &settings,
            )
            .await
        {
            Ok(data) => OcrResult::success(data),
            Err(e) => OcrResult::failure(e),
        };

        // 進捗イベントを発火（処理完了）
        let _ = app.emit(
            "ocr-progress",
            OcrProgressEvent {
                current: index,
                total,
                file_name,
                result: Some(result.clone()),
            },
        );

        results.push(result);
    }

    Ok(results)
}

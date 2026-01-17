//! Tauriコマンド
//!
//! フロントエンドから呼び出されるTauriコマンドを定義する。

use crate::providers::{OcrProgressEvent, OcrProviderRegistry, OcrResult, OcrSettings};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

/// ディレクトリ検証結果
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryValidation {
    pub exists: bool,
    pub is_directory: bool,
    pub is_writable: bool,
}

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

/// デフォルトのルートディレクトリを取得
#[tauri::command]
pub async fn get_default_root_directory(app: AppHandle) -> Result<String, String> {
    let document_dir = app
        .path()
        .document_dir()
        .map_err(|e| format!("ドキュメントディレクトリの取得に失敗しました: {}", e))?;

    let default_path = document_dir.join("Expense");
    default_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "パスの変換に失敗しました".to_string())
}

/// ルートディレクトリを取得（保存済みの値またはデフォルト）
#[tauri::command]
pub async fn get_root_directory(app: AppHandle) -> Result<String, String> {
    let store = app
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    if let Some(value) = store.get("root_directory") {
        if let Some(path) = value.as_str() {
            return Ok(path.to_string());
        }
    }

    // 保存されていない場合はデフォルト値を返す
    get_default_root_directory(app).await
}

/// ルートディレクトリを保存
#[tauri::command]
pub async fn save_root_directory(app: AppHandle, path: String) -> Result<(), String> {
    let store = app
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    store.set("root_directory", serde_json::Value::String(path));

    store
        .save()
        .map_err(|e| format!("設定の保存に失敗しました: {}", e))?;

    Ok(())
}

/// 月別ディレクトリを作成（{root}/YYYY/MM/）
#[tauri::command]
pub async fn ensure_month_directory(app: AppHandle, year_month: String) -> Result<String, String> {
    // YYYYMM形式のバリデーション
    if year_month.len() != 6 {
        return Err("年月は YYYYMM 形式で指定してください".to_string());
    }

    let year = &year_month[0..4];
    let month = &year_month[4..6];

    // 数値として有効かチェック
    year.parse::<u32>()
        .map_err(|_| "年が無効です".to_string())?;
    let month_num = month
        .parse::<u32>()
        .map_err(|_| "月が無効です".to_string())?;

    if !(1..=12).contains(&month_num) {
        return Err("月は01から12の範囲で指定してください".to_string());
    }

    let root_directory = get_root_directory(app).await?;
    let month_path = PathBuf::from(&root_directory).join(year).join(month);

    fs::create_dir_all(&month_path)
        .map_err(|e| format!("ディレクトリの作成に失敗しました: {}", e))?;

    month_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "パスの変換に失敗しました".to_string())
}

/// ディレクトリを検証
#[tauri::command]
pub async fn validate_directory(path: String) -> Result<DirectoryValidation, String> {
    let path_buf = PathBuf::from(&path);

    let exists = path_buf.exists();
    let is_directory = path_buf.is_dir();

    // 書き込み可能かどうかをチェック
    let is_writable = if is_directory {
        // ディレクトリに一時ファイルを作成してテスト
        let test_file = path_buf.join(".torifune_write_test");
        match fs::write(&test_file, b"test") {
            Ok(_) => {
                let _ = fs::remove_file(&test_file);
                true
            }
            Err(_) => false,
        }
    } else {
        false
    };

    Ok(DirectoryValidation {
        exists,
        is_directory,
        is_writable,
    })
}

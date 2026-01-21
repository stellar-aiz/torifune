//! Tauriコマンド
//!
//! フロントエンドから呼び出されるTauriコマンドを定義する。

use crate::providers::{OcrProgressEvent, OcrProviderRegistry, OcrResult, OcrSettings};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_store::StoreExt;
use tokio::sync::{Mutex, Semaphore};

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

/// 並列処理の最大同時実行数
const MAX_CONCURRENT_OCR: usize = 3;

/// バッチOCR処理（並列実行）
#[tauri::command]
pub async fn batch_ocr_receipts(
    app: AppHandle,
    registry: State<'_, Arc<Mutex<OcrProviderRegistry>>>,
    requests: Vec<OcrRequest>,
) -> Result<Vec<OcrResult>, String> {
    let settings = Arc::new(get_ocr_settings(app.clone()).await?);
    let registry_guard = registry.lock().await;

    let provider = Arc::new(
        registry_guard
            .get_default_provider()
            .ok_or("OCRプロバイダーが見つかりません")?
            .clone(),
    );

    drop(registry_guard);

    let total = requests.len();
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_OCR));
    let completed_count = Arc::new(AtomicUsize::new(0));

    // 各リクエストを並列タスクとして生成
    let tasks: Vec<_> = requests
        .into_iter()
        .enumerate()
        .map(|(index, request)| {
            let app = app.clone();
            let provider = Arc::clone(&provider);
            let settings = Arc::clone(&settings);
            let semaphore = Arc::clone(&semaphore);
            let completed_count = Arc::clone(&completed_count);

            async move {
                let file_name = std::path::Path::new(&request.file_path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(&request.file_path)
                    .to_string();

                // セマフォでガード（3並列に制限）
                let _permit = semaphore.acquire().await.unwrap();

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

                // 完了数をインクリメント
                let completed = completed_count.fetch_add(1, Ordering::SeqCst) + 1;

                // 進捗イベントを発火（処理完了）
                let _ = app.emit(
                    "ocr-progress",
                    OcrProgressEvent {
                        current: completed,
                        total,
                        file_name,
                        result: Some(result.clone()),
                    },
                );

                (index, result)
            }
        })
        .collect();

    // 全タスクを並列実行
    let mut indexed_results = join_all(tasks).await;

    // 元のインデックス順にソート
    indexed_results.sort_by_key(|(index, _)| *index);

    // 結果のみを抽出
    let results = indexed_results.into_iter().map(|(_, result)| result).collect();

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

/// ディレクトリを作成
#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    fs::create_dir_all(&path_buf)
        .map_err(|e| format!("ディレクトリの作成に失敗しました: {}", e))?;

    Ok(())
}

/// 月ディレクトリ情報
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthDirectoryInfo {
    pub year: String,
    pub month: String,
    pub year_month: String,
    pub path: String,
    pub has_excel: bool,
}

/// ルートディレクトリ以下の年月ディレクトリ一覧を取得
#[tauri::command]
pub async fn list_month_directories(app: AppHandle) -> Result<Vec<MonthDirectoryInfo>, String> {
    let root_directory = get_root_directory(app).await?;
    let root_path = PathBuf::from(&root_directory);

    if !root_path.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    // 年ディレクトリを走査
    let year_entries = fs::read_dir(&root_path)
        .map_err(|e| format!("ディレクトリの読み込みに失敗しました: {}", e))?;

    for year_entry in year_entries.flatten() {
        let year_path = year_entry.path();
        if !year_path.is_dir() {
            continue;
        }

        let year_name = year_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        // 4桁の数字（年）かチェック
        if year_name.len() != 4 || year_name.parse::<u32>().is_err() {
            continue;
        }

        // 月ディレクトリを走査
        let month_entries = match fs::read_dir(&year_path) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for month_entry in month_entries.flatten() {
            let month_path = month_entry.path();
            if !month_path.is_dir() {
                continue;
            }

            let month_name = month_path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("");

            // 2桁の数字（月）かチェック
            if month_name.len() != 2 {
                continue;
            }
            let month_num = match month_name.parse::<u32>() {
                Ok(n) if (1..=12).contains(&n) => n,
                _ => continue,
            };

            let year_month = format!("{}{:02}", year_name, month_num);
            let excel_path = month_path.join(format!("{}-summary.xlsx", year_month));

            results.push(MonthDirectoryInfo {
                year: year_name.to_string(),
                month: month_name.to_string(),
                year_month,
                path: month_path.to_str().unwrap_or("").to_string(),
                has_excel: excel_path.exists(),
            });
        }
    }

    // 降順ソート（新しい年月が先）
    results.sort_by(|a, b| b.year_month.cmp(&a.year_month));

    Ok(results)
}

/// ディレクトリ内のファイル一覧を取得
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_image: bool,
    pub is_pdf: bool,
    pub size: u64,
}

#[tauri::command]
pub async fn list_files_in_directory(directory_path: String) -> Result<Vec<FileInfo>, String> {
    let path = PathBuf::from(&directory_path);

    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&path)
        .map_err(|e| format!("ディレクトリの読み込みに失敗しました: {}", e))?;

    let mut files = Vec::new();

    for entry in entries.flatten() {
        let file_path = entry.path();
        if !file_path.is_file() {
            continue;
        }

        let file_name = file_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();

        // サマリーファイルはスキップ
        if file_name.ends_with("-summary.json") || file_name.ends_with("-summary.xlsx") {
            continue;
        }

        let extension = file_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        let is_image = matches!(
            extension.as_str(),
            "jpg" | "jpeg" | "png" | "gif" | "webp" | "heic" | "heif"
        );
        let is_pdf = extension == "pdf";

        // 画像・PDF以外はスキップ
        if !is_image && !is_pdf {
            continue;
        }

        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        files.push(FileInfo {
            name: file_name,
            path: file_path.to_str().unwrap_or("").to_string(),
            is_image,
            is_pdf,
            size,
        });
    }

    // ファイル名でソート
    files.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(files)
}

/// ファイルコピー結果
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyFileResult {
    pub original_path: String,
    pub destination_path: String,
    pub file_name: String,
}

/// サムネイルを保存
/// DataURL形式のサムネイル画像を月別ディレクトリの thumbnails/ に保存
#[tauri::command]
pub async fn save_thumbnail(
    app: AppHandle,
    year_month: String,
    file_name: String,
    data_url: String,
) -> Result<String, String> {
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
    let thumbnails_path = PathBuf::from(&root_directory)
        .join(year)
        .join(month)
        .join("thumbnails");

    // thumbnailsディレクトリを作成
    fs::create_dir_all(&thumbnails_path)
        .map_err(|e| format!("thumbnailsディレクトリの作成に失敗しました: {}", e))?;

    // DataURLからBase64部分を抽出
    // 形式: data:image/png;base64,XXXXXX
    let base64_data = data_url
        .strip_prefix("data:image/png;base64,")
        .or_else(|| data_url.strip_prefix("data:image/jpeg;base64,"))
        .or_else(|| data_url.strip_prefix("data:image/webp;base64,"))
        .ok_or("無効なDataURL形式です")?;

    // Base64デコード
    use base64::{engine::general_purpose::STANDARD, Engine};
    let image_data = STANDARD
        .decode(base64_data)
        .map_err(|e| format!("Base64デコードに失敗しました: {}", e))?;

    // ファイルに保存
    let thumbnail_file_name = format!("{}.thumbnail.png", file_name);
    let file_path = thumbnails_path.join(&thumbnail_file_name);

    fs::write(&file_path, &image_data)
        .map_err(|e| format!("サムネイルの保存に失敗しました: {}", e))?;

    file_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "パスの変換に失敗しました".to_string())
}

/// サムネイルを読み込み
/// 指定されたファイルのサムネイルをDataURL形式で返す
#[tauri::command]
pub async fn read_thumbnail(
    app: AppHandle,
    year_month: String,
    file_name: String,
) -> Result<Option<String>, String> {
    // YYYYMM形式のバリデーション
    if year_month.len() != 6 {
        return Err("年月は YYYYMM 形式で指定してください".to_string());
    }

    let year = &year_month[0..4];
    let month = &year_month[4..6];

    let root_directory = get_root_directory(app).await?;
    let thumbnail_file_name = format!("{}.thumbnail.png", file_name);
    let file_path = PathBuf::from(&root_directory)
        .join(year)
        .join(month)
        .join("thumbnails")
        .join(&thumbnail_file_name);

    // ファイルが存在しなければNoneを返す
    if !file_path.exists() {
        return Ok(None);
    }

    // ファイルを読み込み
    let image_data = fs::read(&file_path)
        .map_err(|e| format!("サムネイルの読み込みに失敗しました: {}", e))?;

    // Base64エンコードしてDataURL形式で返す
    use base64::{engine::general_purpose::STANDARD, Engine};
    let base64_data = STANDARD.encode(&image_data);
    let data_url = format!("data:image/png;base64,{}", base64_data);

    Ok(Some(data_url))
}

/// ファイルを月別ディレクトリにコピー
#[tauri::command]
pub async fn copy_file_to_month(
    app: AppHandle,
    source_path: String,
    year_month: String,
) -> Result<CopyFileResult, String> {
    // 月別ディレクトリを確保
    let month_dir = ensure_month_directory(app, year_month).await?;

    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err("ソースファイルが見つかりません".to_string());
    }

    let file_name = source
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or("ファイル名の取得に失敗しました")?
        .to_string();

    let destination = PathBuf::from(&month_dir).join(&file_name);

    // 同名ファイルが存在する場合はユニーク名を生成
    let final_destination = if destination.exists() {
        let stem = source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        let extension = source
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        let mut counter = 1;
        loop {
            let new_name = if extension.is_empty() {
                format!("{}_{}", stem, counter)
            } else {
                format!("{}_{}.{}", stem, counter, extension)
            };
            let new_path = PathBuf::from(&month_dir).join(&new_name);
            if !new_path.exists() {
                break new_path;
            }
            counter += 1;
        }
    } else {
        destination
    };

    fs::copy(&source, &final_destination)
        .map_err(|e| format!("ファイルのコピーに失敗しました: {}", e))?;

    let final_file_name = final_destination
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or(&file_name)
        .to_string();

    Ok(CopyFileResult {
        original_path: source_path,
        destination_path: final_destination.to_str().unwrap_or("").to_string(),
        file_name: final_file_name,
    })
}

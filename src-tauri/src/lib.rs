mod commands;
mod providers;

use providers::OcrProviderRegistry;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // OCRプロバイダーレジストリを初期化
    let registry = Arc::new(Mutex::new(OcrProviderRegistry::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(registry)
        .invoke_handler(tauri::generate_handler![
            commands::ocr_receipt,
            commands::batch_ocr_receipts,
            commands::get_ocr_settings,
            commands::save_ocr_settings,
            commands::test_provider_connection,
            commands::get_default_root_directory,
            commands::get_root_directory,
            commands::save_root_directory,
            commands::ensure_month_directory,
            commands::validate_directory,
            commands::create_directory,
            commands::list_month_directories,
            commands::list_files_in_directory,
            commands::copy_file_to_month,
            commands::save_thumbnail,
            commands::read_thumbnail,
            commands::move_to_trash,
            commands::get_account_category_rules,
            commands::save_account_category_rules,
            commands::get_validation_rules,
            commands::save_validation_rules,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

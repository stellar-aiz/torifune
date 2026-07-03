mod auth;
mod commands;
mod errorlog;
mod providers;

use providers::OcrProviderRegistry;
use std::sync::Arc;
use tauri::Emitter;
use tauri_plugin_deep_link::DeepLinkExt;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // OCRプロバイダーレジストリを初期化
    let registry = Arc::new(Mutex::new(OcrProviderRegistry::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(registry)
        .setup(|app| {
            // パニックフックを設置し、パニック発生時にエラーログへ記録する
            let app_handle_for_panic = app.handle().clone();
            std::panic::set_hook(Box::new(move |info| {
                let location = info
                    .location()
                    .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                    .unwrap_or_else(|| "unknown".into());
                let message = info
                    .payload()
                    .downcast_ref::<&str>()
                    .map(|s| s.to_string())
                    .or_else(|| info.payload().downcast_ref::<String>().cloned())
                    .unwrap_or_else(|| "unknown panic".into());
                let backtrace = std::backtrace::Backtrace::force_capture();
                let full = format!("{} at {}\n{}", message, location, backtrace);
                eprintln!("{}", full);
                let _ = crate::errorlog::write_log_entry(
                    &app_handle_for_panic,
                    "rust-panic",
                    &full,
                    None,
                    None,
                    None,
                );
            }));

            // Deep link: Check if app was started via deep link
            if let Some(urls) = app.deep_link().get_current()? {
                println!("App started via deep link: {:?}", urls);
            }

            // Deep link: Listen for URLs while app is running
            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let urls = event.urls();
                println!("Deep link received: {:?}", urls);
                // Emit auth-callback event for each URL
                for url in urls {
                    let payload = serde_json::json!({ "url": url.to_string() });
                    if let Err(e) = app_handle.emit("auth-callback", payload) {
                        eprintln!("Failed to emit auth-callback event: {}", e);
                    }
                }
            });

            // Register deep link scheme for development on Linux/Windows
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                let _ = app.deep_link().register_all();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // OCR commands
            commands::ocr_receipt,
            commands::batch_ocr_receipts,
            commands::get_ocr_settings,
            commands::save_ocr_settings,
            commands::test_provider_connection,
            // Directory commands
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
            // Settings commands
            commands::get_account_category_rules,
            commands::save_account_category_rules,
            commands::get_validation_rules,
            commands::save_validation_rules,
            commands::get_receiver_name_history,
            commands::save_receiver_name_history,
            // Auth commands
            auth::get_auth_tokens,
            auth::save_auth_tokens,
            auth::clear_auth_tokens,
            auth::open_oauth_url,
            // Logging commands
            commands::write_error_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

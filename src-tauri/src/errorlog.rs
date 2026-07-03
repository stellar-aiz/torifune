//! ローカルエラーログ基盤
//!
//! アプリのログディレクトリ配下に `error.log`（JSON Lines形式）を追記する。
//! 外部送信は行わず、領収書内容・認証情報などはログに含めない。

use tauri::Manager;

/// フロントエンドから送られてくるエラーログエントリ
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLogEntry {
    pub message: String,
    pub stack: Option<String>,
    pub component_stack: Option<String>,
    pub context: Option<String>,
}

/// エラーログを1行（JSON Lines）として `error.log` に追記する
///
/// 同期的な `std::fs` I/O のみで完結させる（パニックフックからも呼ばれるため、
/// asyncやtokioには依存しない）。
pub fn write_log_entry(
    app: &tauri::AppHandle,
    source: &str,
    message: &str,
    stack: Option<&str>,
    component_stack: Option<&str>,
    context: Option<&str>,
) -> std::io::Result<std::path::PathBuf> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| std::io::Error::other(e.to_string()))?;

    std::fs::create_dir_all(&log_dir)?;

    let entry = serde_json::json!({
        "timestamp": chrono::Local::now().to_rfc3339(),
        "source": source,
        "message": message,
        "stack": stack,
        "component_stack": component_stack,
        "context": context,
        "app_version": app.package_info().version.to_string(),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    });

    let log_path = log_dir.join("error.log");

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)?;
    writeln!(file, "{}", entry)?;

    Ok(log_path)
}

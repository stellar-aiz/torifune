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

/// `error.log` から読み出した1エントリ（フロントエンドへ返す形）
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorLogRecord {
    pub timestamp: String,
    pub source: String,
    pub message: String,
    pub stack: Option<String>,
    pub component_stack: Option<String>,
    pub context: Option<String>,
    pub app_version: String,
    pub os: String,
    pub arch: String,
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

/// JSON Lines形式の `content` を解析し、`cutoff` 以降のタイムスタンプを持つ
/// エントリのみを元の順序で返す。
///
/// パースできない行や、タイムスタンプが不正な行は黙ってスキップする
/// （ログファイルの一部破損でコマンド全体が失敗しないようにするため）。
pub fn parse_recent_entries(
    content: &str,
    cutoff: chrono::DateTime<chrono::Local>,
) -> Vec<ErrorLogRecord> {
    content
        .lines()
        .filter(|line| !line.is_empty())
        .filter_map(|line| serde_json::from_str::<ErrorLogRecord>(line).ok())
        .filter(|record| {
            chrono::DateTime::parse_from_rfc3339(&record.timestamp)
                .map(|dt| dt.with_timezone(&chrono::Local) >= cutoff)
                .unwrap_or(false)
        })
        .collect()
}

/// `error.log` から直近 `days` 日分のエントリを読み取る
pub fn read_recent_log_entries(
    app: &tauri::AppHandle,
    days: i64,
) -> std::io::Result<Vec<ErrorLogRecord>> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| std::io::Error::other(e.to_string()))?;

    let log_path = log_dir.join("error.log");

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let content = std::fs::read_to_string(&log_path)?;
    let cutoff = chrono::Local::now() - chrono::Duration::days(days);

    Ok(parse_recent_entries(&content, cutoff))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 指定した日数前のタイムスタンプを持つエントリを1行分のJSON Linesとして生成する
    fn make_log_line(days_ago: i64, message: &str) -> String {
        let timestamp = (chrono::Local::now() - chrono::Duration::days(days_ago)).to_rfc3339();
        serde_json::json!({
            "timestamp": timestamp,
            "source": "frontend",
            "message": message,
            "stack": null,
            "componentStack": null,
            "context": null,
            "appVersion": "0.2.13",
            "os": "macos",
            "arch": "aarch64",
        })
        .to_string()
    }

    #[test]
    fn parse_recent_entries_filters_by_cutoff_and_skips_invalid_lines() {
        let recent_line = make_log_line(29, "recent error");
        let old_line = make_log_line(31, "old error");
        let content = format!("{}\n{}\nnot-json-at-all\n", recent_line, old_line);

        let cutoff = chrono::Local::now() - chrono::Duration::days(30);
        let result = parse_recent_entries(&content, cutoff);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].message, "recent error");
    }
}

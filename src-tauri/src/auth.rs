//! 認証関連Tauriコマンド
//!
//! OAuth認証のためのトークン管理とブラウザ連携を提供する。

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// 認証トークン構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub user: Option<UserInfo>,
}

/// ユーザー情報構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    pub provider: String,
    pub tier: String,
}

/// 認証トークンを取得
#[tauri::command]
pub async fn get_auth_tokens(app_handle: AppHandle) -> Result<Option<AuthTokens>, String> {
    let store = app_handle
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    let tokens = store
        .get("auth_tokens")
        .and_then(|v| serde_json::from_value(v).ok());

    Ok(tokens)
}

/// 認証トークンを保存
#[tauri::command]
pub async fn save_auth_tokens(app_handle: AppHandle, tokens: AuthTokens) -> Result<(), String> {
    let store = app_handle
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    store.set(
        "auth_tokens",
        serde_json::to_value(&tokens).map_err(|e| e.to_string())?,
    );

    store
        .save()
        .map_err(|e| format!("トークンの保存に失敗しました: {}", e))?;

    Ok(())
}

/// 認証トークンをクリア
#[tauri::command]
pub async fn clear_auth_tokens(app_handle: AppHandle) -> Result<(), String> {
    let store = app_handle
        .store("torifune.store.json")
        .map_err(|e| format!("ストアの読み込みに失敗しました: {}", e))?;

    store.delete("auth_tokens");

    store
        .save()
        .map_err(|e| format!("トークンの削除に失敗しました: {}", e))?;

    Ok(())
}

/// OAuth URLをシステムブラウザで開く
#[tauri::command]
pub async fn open_oauth_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("ブラウザを開けませんでした: {}", e))
}

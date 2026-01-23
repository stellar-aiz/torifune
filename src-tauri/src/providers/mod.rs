//! OCRプロバイダーモジュール
//!
//! レシート画像からテキストを抽出するOCRプロバイダーを抽象化し、
//! プラグイン的に追加可能なアーキテクチャを提供する。

pub mod googledocumentai;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// OCR設定
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OcrSettings {
    /// Google Document AI プロジェクトID
    pub project_id: Option<String>,
    /// Google Document AI ロケーション
    pub location: Option<String>,
    /// Google Document AI プロセッサID
    pub processor_id: Option<String>,
    /// サービスアカウントJSON（文字列として保存）
    pub service_account_json: Option<String>,
}

/// レシートデータ
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReceiptData {
    /// ファイル名
    pub file: String,
    /// 店舗名
    pub merchant: Option<String>,
    /// 日付（YYYY-MM-DD形式）
    pub date: Option<String>,
    /// 合計金額
    pub amount: Option<f64>,
    /// 通貨コード（JPY, USD など）
    pub currency: Option<String>,
    /// 宛名
    pub receiver_name: Option<String>,
}

impl ReceiptData {
    pub fn new(file: String) -> Self {
        Self {
            file,
            merchant: None,
            date: None,
            amount: None,
            currency: None,
            receiver_name: None,
        }
    }
}

/// OCR処理結果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    /// 成功したかどうか
    pub success: bool,
    /// レシートデータ
    pub data: Option<ReceiptData>,
    /// エラーメッセージ
    pub error: Option<String>,
}

impl OcrResult {
    pub fn success(data: ReceiptData) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

/// バッチOCR進捗イベント
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrProgressEvent {
    /// 完了数
    pub current: usize,
    /// 総数
    pub total: usize,
    /// 現在処理中のファイル名
    pub file_name: String,
    /// 処理結果（処理完了時のみ）
    pub result: Option<OcrResult>,
}

/// OCRプロバイダー trait
///
/// 各OCRプロバイダーはこのtraitを実装することで、Torifuneに統合される。
#[async_trait]
pub trait OcrProvider: Send + Sync {
    /// プロバイダー名
    #[allow(dead_code)]
    fn name(&self) -> &str;

    /// 設定が有効かどうか
    fn is_configured(&self, settings: &OcrSettings) -> bool;

    /// 接続テスト
    async fn test_connection(&self, settings: &OcrSettings) -> Result<(), String>;

    /// レシートからデータを抽出
    ///
    /// # Arguments
    /// * `file_path` - ファイルパス
    /// * `file_content` - ファイルの内容（Base64エンコード済み）
    /// * `mime_type` - MIMEタイプ
    /// * `settings` - OCR設定
    async fn extract_receipt(
        &self,
        file_path: &str,
        file_content: &str,
        mime_type: &str,
        settings: &OcrSettings,
    ) -> Result<ReceiptData, String>;
}

/// OCRプロバイダーレジストリ
///
/// 登録されたOCRプロバイダーを管理する。
pub struct OcrProviderRegistry {
    providers: Vec<Arc<dyn OcrProvider>>,
}

impl Default for OcrProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl OcrProviderRegistry {
    /// 新しいレジストリを作成（デフォルトプロバイダーを登録）
    pub fn new() -> Self {
        let mut registry = Self { providers: vec![] };
        registry.register(Arc::new(googledocumentai::GoogleDocumentAiProvider::new()));
        registry
    }

    /// プロバイダーを登録
    pub fn register(&mut self, provider: Arc<dyn OcrProvider>) {
        self.providers.push(provider);
    }

    /// デフォルトプロバイダーを取得
    pub fn get_default_provider(&self) -> Option<Arc<dyn OcrProvider>> {
        self.providers.first().cloned()
    }

    /// 名前でプロバイダーを取得
    #[allow(dead_code)]
    pub fn get_provider(&self, name: &str) -> Option<Arc<dyn OcrProvider>> {
        self.providers.iter().find(|p| p.name() == name).cloned()
    }

    /// 利用可能なプロバイダー名一覧を取得
    #[allow(dead_code)]
    pub fn list_providers(&self) -> Vec<String> {
        self.providers.iter().map(|p| p.name().to_string()).collect()
    }
}

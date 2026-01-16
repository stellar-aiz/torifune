//! Google Document AI OCRプロバイダー
//!
//! Google Cloud Document AI を使用してレシート画像からデータを抽出する。

use super::{OcrProvider, OcrSettings, ReceiptData};
use async_trait::async_trait;
use chrono::Utc;
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// サービスアカウントキー
#[derive(Debug, Clone, Deserialize)]
struct ServiceAccountKey {
    client_email: String,
    private_key: String,
    #[serde(default)]
    token_uri: Option<String>,
}

/// JWTクレーム
#[derive(Debug, Serialize)]
struct Claims {
    iss: String,
    sub: String,
    scope: String,
    aud: String,
    exp: i64,
    iat: i64,
}

/// トークンレスポンス
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
}

/// Document AI レスポンス
#[derive(Debug, Deserialize)]
struct DocumentAiResponse {
    document: Option<DocumentAiDocument>,
}

#[derive(Debug, Deserialize)]
struct DocumentAiDocument {
    entities: Option<Vec<DocumentAiEntity>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentAiEntity {
    #[serde(rename = "type")]
    entity_type: Option<String>,
    mention_text: Option<String>,
    normalized_value: Option<DocumentAiNormalizedValue>,
    properties: Option<Vec<DocumentAiEntity>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DocumentAiNormalizedValue {
    text: Option<String>,
    money_value: Option<DocumentAiMoneyValue>,
    date_value: Option<DocumentAiDateValue>,
}

#[derive(Debug, Deserialize)]
struct DocumentAiMoneyValue {
    units: Option<String>,
    nanos: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct DocumentAiDateValue {
    year: Option<i32>,
    month: Option<i32>,
    day: Option<i32>,
}

/// Google Document AI プロバイダー
pub struct GoogleDocumentAiProvider {
    client: Client,
}

impl GoogleDocumentAiProvider {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    /// サービスアカウントJSONをパース
    fn parse_service_account(json: &str) -> Result<ServiceAccountKey, String> {
        serde_json::from_str(json)
            .map_err(|e| format!("サービスアカウントJSONのパースに失敗しました: {}", e))
    }

    /// アクセストークンを取得
    async fn fetch_access_token(&self, service_account: &ServiceAccountKey) -> Result<String, String> {
        let token_uri = service_account
            .token_uri
            .as_deref()
            .unwrap_or("https://oauth2.googleapis.com/token");

        let now = Utc::now().timestamp();
        let claims = Claims {
            iss: service_account.client_email.clone(),
            sub: service_account.client_email.clone(),
            scope: "https://www.googleapis.com/auth/cloud-platform".to_string(),
            aud: token_uri.to_string(),
            exp: now + 3600,
            iat: now,
        };

        let header = Header::new(Algorithm::RS256);
        let key = EncodingKey::from_rsa_pem(service_account.private_key.as_bytes())
            .map_err(|e| format!("秘密鍵のパースに失敗しました: {}", e))?;

        let assertion = encode(&header, &claims, &key)
            .map_err(|e| format!("JWTの生成に失敗しました: {}", e))?;

        let params = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &assertion),
        ];

        let response = self
            .client
            .post(token_uri)
            .form(&params)
            .send()
            .await
            .map_err(|e| format!("トークンリクエストに失敗しました: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!(
                "トークン取得に失敗しました: HTTP {} - {}",
                status, text
            ));
        }

        let token_response: TokenResponse = response
            .json()
            .await
            .map_err(|e| format!("トークンレスポンスのパースに失敗しました: {}", e))?;

        Ok(token_response.access_token)
    }

    /// エンティティを検索
    fn find_entity<'a>(
        entities: &'a [DocumentAiEntity],
        types: &[&str],
    ) -> Option<&'a DocumentAiEntity> {
        for entity_type in types {
            if let Some(entity) = entities
                .iter()
                .find(|e| e.entity_type.as_deref() == Some(*entity_type))
            {
                return Some(entity);
            }
        }
        None
    }

    /// エンティティからテキストを解決
    fn resolve_text(entity: &DocumentAiEntity) -> Option<String> {
        if let Some(ref normalized) = entity.normalized_value {
            if let Some(ref text) = normalized.text {
                return Some(text.clone());
            }
            if let Some(ref date_value) = normalized.date_value {
                if let (Some(year), Some(month), Some(day)) =
                    (date_value.year, date_value.month, date_value.day)
                {
                    return Some(format!("{:04}-{:02}-{:02}", year, month, day));
                }
            }
        }
        entity.mention_text.clone()
    }

    /// エンティティから金額を解決
    fn resolve_total(entity: &DocumentAiEntity) -> Option<f64> {
        if let Some(ref normalized) = entity.normalized_value {
            if let Some(ref money) = normalized.money_value {
                let units: f64 = money
                    .units
                    .as_ref()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0.0);
                let nanos: f64 = money.nanos.unwrap_or(0) as f64 / 1_000_000_000.0;
                return Some(units + nanos);
            }
            if let Some(ref text) = normalized.text {
                if let Ok(value) = text.parse::<f64>() {
                    return Some(value);
                }
            }
        }

        if let Some(ref mention) = entity.mention_text {
            let digits: String = mention.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
            if let Ok(value) = digits.parse::<f64>() {
                return Some(value);
            }
        }

        // プロパティ内を再帰的に検索
        if let Some(ref properties) = entity.properties {
            for prop in properties {
                if let Some(value) = Self::resolve_total(prop) {
                    return Some(value);
                }
            }
        }

        None
    }
}

impl Default for GoogleDocumentAiProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl OcrProvider for GoogleDocumentAiProvider {
    fn name(&self) -> &str {
        "googledocumentai"
    }

    fn is_configured(&self, settings: &OcrSettings) -> bool {
        settings.project_id.is_some()
            && settings.processor_id.is_some()
            && settings.service_account_json.is_some()
    }

    async fn test_connection(&self, settings: &OcrSettings) -> Result<(), String> {
        if !self.is_configured(settings) {
            return Err("設定が不完全です".to_string());
        }

        let service_account = Self::parse_service_account(
            settings.service_account_json.as_ref().unwrap(),
        )?;

        // アクセストークンを取得してテスト
        let _token = self.fetch_access_token(&service_account).await?;

        Ok(())
    }

    async fn extract_receipt(
        &self,
        file_path: &str,
        file_content: &str,
        mime_type: &str,
        settings: &OcrSettings,
    ) -> Result<ReceiptData, String> {
        if !self.is_configured(settings) {
            return Err("OCR設定が不完全です".to_string());
        }

        let project_id = settings.project_id.as_ref().unwrap();
        let location = settings.location.as_deref().unwrap_or("us");
        let processor_id = settings.processor_id.as_ref().unwrap();

        let service_account = Self::parse_service_account(
            settings.service_account_json.as_ref().unwrap(),
        )?;

        let access_token = self.fetch_access_token(&service_account).await?;

        let endpoint = format!("{}-documentai.googleapis.com", location);
        let url = format!(
            "https://{}/v1/projects/{}/locations/{}/processors/{}:process",
            endpoint, project_id, location, processor_id
        );

        let request_body = serde_json::json!({
            "rawDocument": {
                "content": file_content,
                "mimeType": mime_type,
            },
            "fieldMask": "entities",
        });

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .map_err(|e| format!("Document AI APIリクエストに失敗しました: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!(
                "Document AI処理に失敗しました: HTTP {} - {}",
                status, text
            ));
        }

        let api_response: DocumentAiResponse = response
            .json()
            .await
            .map_err(|e| format!("Document AIレスポンスのパースに失敗しました: {}", e))?;

        let file_name = std::path::Path::new(file_path)
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(file_path)
            .to_string();

        let mut receipt_data = ReceiptData::new(file_name);

        if let Some(document) = api_response.document {
            if let Some(entities) = document.entities {
                // 店舗名を検索
                if let Some(merchant_entity) = Self::find_entity(
                    &entities,
                    &["merchant_name", "supplier_name", "vendor_name", "receipt_merchant_name"],
                ) {
                    receipt_data.merchant = Self::resolve_text(merchant_entity);
                }

                // 日付を検索
                if let Some(date_entity) = Self::find_entity(
                    &entities,
                    &["receipt_date", "purchase_date", "transaction_date", "invoice_date", "date"],
                ) {
                    receipt_data.date = Self::resolve_text(date_entity);
                }

                // 合計金額を検索
                if let Some(total_entity) = Self::find_entity(
                    &entities,
                    &["total_amount", "invoice_total", "receipt_total"],
                ) {
                    receipt_data.total = Self::resolve_total(total_entity);
                }
            }
        }

        Ok(receipt_data)
    }
}

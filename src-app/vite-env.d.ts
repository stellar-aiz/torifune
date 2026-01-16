/// <reference types="vite/client" />

interface ImportMetaEnv {
  // OCR Provider
  readonly VITE_OCR_PROVIDER?: string;

  // Google Document AI
  readonly VITE_GOOGLE_PROJECT_ID?: string;
  readonly VITE_GOOGLE_LOCATION?: string;
  readonly VITE_GOOGLE_PROCESSOR_ID?: string;
  readonly VITE_GOOGLE_SERVICE_ACCOUNT_FILE?: string; // vite.config.ts で読み込み
  readonly VITE_GOOGLE_SERVICE_ACCOUNT_JSON?: string;

  // Veryfi
  readonly VITE_VERYFI_CLIENT_ID?: string;
  readonly VITE_VERYFI_CLIENT_SECRET?: string;
  readonly VITE_VERYFI_USERNAME?: string;
  readonly VITE_VERYFI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

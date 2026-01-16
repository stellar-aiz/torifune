import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // @ts-expect-error process is a nodejs global
  const host = process.env.TAURI_DEV_HOST;

  // サービスアカウントJSONをファイルから読み込む
  let serviceAccountJson = env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON || "";
  if (env.VITE_GOOGLE_SERVICE_ACCOUNT_FILE) {
    const filePath = path.resolve(process.cwd(), env.VITE_GOOGLE_SERVICE_ACCOUNT_FILE);
    if (fs.existsSync(filePath)) {
      serviceAccountJson = fs.readFileSync(filePath, "utf-8");
    }
  }

  return {
    plugins: [react()],

    // 環境変数をビルドに埋め込む
    define: {
      "import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON": JSON.stringify(serviceAccountJson),
    },

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});

#!/usr/bin/env node
/**
 * sync-version.mjs
 *
 * pnpm version 実行時に呼び出され、package.json のバージョンを
 * src-tauri/tauri.conf.json と src-tauri/Cargo.toml に同期する。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

/**
 * package.json からバージョンを取得
 */
function getPackageVersion() {
  const packageJsonPath = resolve(rootDir, "package.json");
  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    if (!pkg.version) {
      throw new Error("version field not found in package.json");
    }
    return pkg.version;
  } catch (error) {
    console.error(`Error reading package.json: ${error.message}`);
    process.exit(1);
  }
}

/**
 * tauri.conf.json のバージョンを更新
 */
function updateTauriConfig(version) {
  const tauriConfigPath = resolve(rootDir, "src-tauri", "tauri.conf.json");
  try {
    const content = readFileSync(tauriConfigPath, "utf-8");
    const config = JSON.parse(content);
    config.version = version;
    writeFileSync(tauriConfigPath, JSON.stringify(config, null, 2) + "\n");
    console.log(`Updated tauri.conf.json to version ${version}`);
  } catch (error) {
    console.error(`Error updating tauri.conf.json: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Cargo.toml のバージョンを更新
 */
function updateCargoToml(version) {
  const cargoTomlPath = resolve(rootDir, "src-tauri", "Cargo.toml");
  try {
    let content = readFileSync(cargoTomlPath, "utf-8");
    // [package] セクション内の version = "x.x.x" を置換
    // パターン: version = "任意のバージョン文字列"
    const versionRegex = /^(version\s*=\s*")([^"]+)(")/m;
    if (!versionRegex.test(content)) {
      throw new Error("version field not found in Cargo.toml");
    }
    content = content.replace(versionRegex, `$1${version}$3`);
    writeFileSync(cargoTomlPath, content);
    console.log(`Updated Cargo.toml to version ${version}`);
  } catch (error) {
    console.error(`Error updating Cargo.toml: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 更新したファイルを git add
 */
function gitAddFiles() {
  const files = [
    resolve(rootDir, "src-tauri", "tauri.conf.json"),
    resolve(rootDir, "src-tauri", "Cargo.toml"),
  ];
  try {
    execSync(`git add ${files.join(" ")}`, { cwd: rootDir, stdio: "inherit" });
    console.log("Added updated files to git staging");
  } catch (error) {
    console.error(`Error adding files to git: ${error.message}`);
    process.exit(1);
  }
}

// メイン処理
function main() {
  console.log("Syncing version across project files...");

  const version = getPackageVersion();
  console.log(`Package version: ${version}`);

  updateTauriConfig(version);
  updateCargoToml(version);
  gitAddFiles();

  console.log("Version sync completed successfully!");
}

main();

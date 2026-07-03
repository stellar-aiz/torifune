# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Our Important Values

- Prioritize readability, testability, maintainability, extendability, and elegance for our source code.
- You are the manager and the agent orchestrator. You should never implement anything yourself, but delegate it to subagents and task agents. Break down tasks into smaller parts and build a PDCA cycle.
- Use `AskUserQuestion` tool as much as possible whenever there are any unclear points before starting actual tasks.
- Use `code-simplifier` plugin to keep our source code always simple and clean.
- Use `frontend-design` skill when we need implement graphical user interface.

# Our knowledge base

Following knowledge should be stored under `./knowledge` folder:

- `./knowledge/specs/` = Specifications and requirements
- `./knowledge/styles/` = Coding conventions and style guides
- `./knowledge/plans/` = Execution plans
- `./knowledge/decisions/` = History of decision making (just for log)

# Project Specific Guide

## What this is

torifune (トリフネ) is a Tauri desktop app that OCRs receipt images/PDFs and organizes them into monthly expense reports exportable to Excel. The repo has three parts that version and build independently:

- `src-app/` — React 19 + TypeScript frontend, rendered inside the Tauri webview
- `src-tauri/` — Rust Tauri backend (native commands: filesystem, OCR calls, OS store)
- `backend/` — standalone Go HTTP API (chi router) for a hosted/multi-tenant SaaS variant (OAuth, JWT, usage tracking), deployed to App Engine standard (`backend/app.yaml`, `runtime: go121`)

## Commands

Frontend/Tauri (run from repo root with pnpm):

- `pnpm install` — installs deps; `postinstall` also runs `cargo fetch` in `src-tauri` if `cargo` is on PATH
- `pnpm tauri dev` / `pnpm start` — run the full desktop app
- `pnpm dev` — Vite dev server only (frontend, no Tauri shell)
- `pnpm build` — `tsc` + `vite build`, frontend bundle into `dist/`
- `pnpm tauri:build` / `pnpm tauri:build:debug` — build the native app bundle
- `pnpm test` — vitest watch mode; `pnpm test:run` — single run
  - single file: `pnpm vitest run src-app/App.test.tsx`
  - single test name: `pnpm vitest run -t "should pass placeholder test"`
- `pnpm lint` — runs `lint:ts` + `lint:rust` + `backend:lint` together
  - `pnpm lint:ts` = `tsc --noEmit`
  - `pnpm lint:rust` = `cd src-tauri && cargo clippy -- -D warnings`
- `pnpm fmt` / `pnpm fmt:check` — prettier (`fmt:ts`) + `cargo fmt` (`fmt:rust`), each with a `:check` variant

Go backend (from repo root via pnpm wrappers, or `cd backend`):

- `pnpm backend:dev` = `go run cmd/server/main.go`
- `pnpm backend:test` = `go test ./...` (single test: `cd backend && go test ./internal/... -run TestName`)
- `pnpm backend:lint` = `go vet ./...` + `go build ./...`
- `pnpm backend:fmt` = `go fmt ./...`

Rust: `cd src-tauri && cargo test` (no test files exist yet, but this is the entry point CI uses).

## Architecture

### Two OCR/auth backends — do not conflate them

- **What actually runs today:** `src-tauri/src/providers/googledocumentai.rs` calls Google Document AI *directly from the desktop app*, authenticating with a service-account JSON baked in at build time (`VITE_GOOGLE_SERVICE_ACCOUNT_FILE` / `VITE_GOOGLE_SERVICE_ACCOUNT_JSON`, injected in `vite.config.ts` as `import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_JSON`). Flow: `useReceiptStore.startOcr()` → `services/tauri/commands.ts:batchOcrReceipts()` → Tauri command `batch_ocr_receipts` (`src-tauri/src/commands.rs`), which fans out up to 4 concurrent requests via a `tokio::Semaphore` and streams progress back as `ocr-progress` events.
- **In-progress scaffolding, not wired up:** `backend/` is a separate Go service implementing OAuth (Google/Microsoft/Slack), JWT sessions, and Firestore-backed usage tracking/rate limiting, meant for a hosted multi-tenant version. `services/api/*.ts` and `contexts/AuthContext.tsx` are its frontend client, but it's disconnected from the real OCR flow above: `OCRHandler.Process`/`BatchProcess` (`backend/internal/handler/ocr.go`) are still placeholders with no real Document AI call, and `AuthContext.login()` invokes a Tauri command (`open_external_url`) that doesn't exist anywhere in `src-tauri` (no shell plugin/capability is registered). Don't assume login or the hosted OCR path works end-to-end without checking current state first.

### Frontend (`src-app/`)

- No global state library — `App.tsx` composes plain hooks. `hooks/useReceiptStore.ts` is the central one: owns `ApplicationMonth[]` / `currentMonthId`, handles add/remove/update of receipts, drives OCR, and debounce-autosaves (500ms) the current month.
- Persistence is file-based, not a database. `services/persistence.ts` + Rust `commands.rs` read/write under a user-chosen root directory (default `~/Documents/Expense`), one folder per `{root}/YYYY/MM/`. Each month folder holds the original receipt files, a `thumbnails/` subfolder, and a single `{yearMonth}-summary.xlsx` written/read through `services/excel/exporter.ts` (exceljs) — the Excel file is the actual source of truth on reload. `knowledge/specs/file-structure.md` describes an earlier JSON-based design; the implementation has since moved to Excel, so verify against `exporter.ts`/`persistence.ts` rather than trusting that spec as current.
- `services/validation.ts` and `services/accountCategoryMatcher.ts` run client-side after OCR completes: they flag data-quality issues (`ValidationIssue`) and auto-guess 勘定科目 (account category) from the merchant name using user-defined rules (`useAccountCategoryRulesStore`).
- All settings (OCR provider config, account-category rules, validation rules, receiver-name history, root directory, auth tokens) persist through `tauri-plugin-store` into one `torifune.store.json`, each group read/written via its own pair of Tauri commands (see the bottom half of `commands.rs` and all of `auth.rs`).

### Rust (`src-tauri/`)

- `lib.rs` is the single registration point for every `#[tauri::command]` (`invoke_handler(tauri::generate_handler![...])`). Commands are split across `commands.rs` (OCR + filesystem + settings), `auth.rs` (token storage + OAuth URL opening), and `providers/` (OCR provider trait + implementations).
- `OcrProvider` (`providers/mod.rs`) is a small trait meant to support multiple OCR backends via `OcrProviderRegistry`, but only `googledocumentai` is registered — even though the frontend's `OcrProvider` type (`types/receipt.ts`) also lists `"veryfi"`. Adding a provider means implementing the trait and registering it in `OcrProviderRegistry::new()`.
- Filesystem capabilities are intentionally broad (`fs:allow-*` with `path: "**"` in `src-tauri/capabilities/default.json`) since the app must read/write wherever the user points the root directory.

## CI/release

- `.github/workflows/ci.yml` runs on every push/PR to `main`: a `frontend` job (`tsc --noEmit` + `vitest run`), a `backend` job that despite the name is entirely about `src-tauri` (Rust clippy, `cargo fmt --check`, `cargo test`) — the Go `backend/` has no CI job today — and a `build-check` matrix (`pnpm tauri build --debug` on macOS 14/15 + Windows).
- `.github/workflows/release.yml` builds signed/notarized macOS and Windows installers on `v*.*.*` tags and drafts a GitHub Release. Version is kept in sync across `package.json` / `src-tauri/Cargo.toml` / `tauri.conf.json` via `pnpm version` (`scripts/sync-version.mjs`).

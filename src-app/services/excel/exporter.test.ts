// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

// pdfjs-dist の import チェーンを迂回（テスト環境では不要）
// pdfExtractor.ts が pdfjsLib.GlobalWorkerOptions に代入するためダミーで埋める
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  exists: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
}));
vi.mock("../tauri/commands", () => ({
  getRootDirectory: vi.fn(),
}));

import ExcelJS from "exceljs";
import { calculateJpyTotal } from "./exporter";
import type { ReceiptData } from "../../types/receipt";
import {
  ExcelColumnLabel,
  generateSheetColumns,
  getColumnIndex,
} from "../../types/excel";

function makeReceipt(overrides: Partial<ReceiptData>): ReceiptData {
  return {
    id: "test-id",
    file: "test.pdf",
    filePath: "/tmp/test.pdf",
    status: "success",
    ...overrides,
  };
}

describe("calculateJpyTotal", () => {
  it("sums JPY-only receipts", () => {
    const total = calculateJpyTotal([
      makeReceipt({ amount: 100, currency: "JPY" }),
      makeReceipt({ amount: 250, currency: "JPY" }),
    ]);
    expect(total).toBe(350);
  });

  it("treats undefined currency as JPY", () => {
    const total = calculateJpyTotal([
      makeReceipt({ amount: 100 }),
      makeReceipt({ amount: 200, currency: "JPY" }),
    ]);
    expect(total).toBe(300);
  });

  it("excludes non-JPY currencies", () => {
    const total = calculateJpyTotal([
      makeReceipt({ amount: 100, currency: "JPY" }),
      makeReceipt({ amount: 1000, currency: "USD" }),
      makeReceipt({ amount: 500, currency: "EUR" }),
    ]);
    expect(total).toBe(100);
  });

  it("returns 0 for empty input", () => {
    expect(calculateJpyTotal([])).toBe(0);
  });

  it("ignores receipts with missing amount", () => {
    const total = calculateJpyTotal([
      makeReceipt({ amount: 100, currency: "JPY" }),
      makeReceipt({ currency: "JPY", status: "pending" }),
    ]);
    expect(total).toBe(100);
  });
});

describe("Excel summary structure (in-memory round trip)", () => {
  /**
   * generateSummaryExcel と同じ構造を in-memory で組み立てる軽量版。
   * 画像処理と Tauri I/O を除外し、行構造とフォーマット検出のみを検証する。
   */
  async function buildInMemorySummary(
    receipts: ReceiptData[],
  ): Promise<ExcelJS.Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Summary");
    sheet.columns = generateSheetColumns();
    const jpyTotal = calculateJpyTotal(receipts);
    sheet.spliceRows(1, 0, ["合計金額", jpyTotal]);
    sheet.views = [{ state: "frozen", ySplit: 2 }];

    for (const r of receipts) {
      sheet.addRow({
        [ExcelColumnLabel.FileName]: r.file,
        [ExcelColumnLabel.OriginalFileLink]: r.filePath,
        [ExcelColumnLabel.Date]: r.date ?? "",
        [ExcelColumnLabel.Merchant]: r.merchant ?? "",
        [ExcelColumnLabel.Amount]: r.amount ?? null,
        [ExcelColumnLabel.Currency]: r.currency ?? "",
        [ExcelColumnLabel.ReceiverName]: r.receiverName ?? "",
        [ExcelColumnLabel.AccountCategory]: r.accountCategory ?? "",
        [ExcelColumnLabel.Note]: r.note ?? "",
        [ExcelColumnLabel.ValidationIssues]: "",
      });
    }

    return workbook.xlsx.writeBuffer();
  }

  it("places total row at row 1 with JPY-formatted total", async () => {
    const receipts = [
      makeReceipt({
        date: "2026-04-01",
        merchant: "A",
        amount: 1000,
        currency: "JPY",
      }),
      makeReceipt({
        date: "2026-04-02",
        merchant: "B",
        amount: 500,
        currency: "JPY",
      }),
    ];
    const buffer = await buildInMemorySummary(receipts);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    const sheet = wb.getWorksheet("Summary")!;

    expect(String(sheet.getRow(1).getCell(1).value)).toBe("合計金額");
    expect(Number(sheet.getRow(1).getCell(2).value)).toBe(1500);
  });

  it("places header at row 2 and data starting from row 3", async () => {
    const receipts = [
      makeReceipt({
        date: "2026-04-01",
        merchant: "Cafe",
        amount: 800,
        currency: "JPY",
      }),
    ];
    const buffer = await buildInMemorySummary(receipts);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    const sheet = wb.getWorksheet("Summary")!;

    expect(String(sheet.getRow(2).getCell(1).value)).toBe("ファイル名");
    const merchantCol = getColumnIndex(ExcelColumnLabel.Merchant);
    expect(String(sheet.getRow(3).getCell(merchantCol).value)).toBe("Cafe");
  });

  it("freezes the first 2 rows (total + header)", async () => {
    const buffer = await buildInMemorySummary([]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as ArrayBuffer);
    const sheet = wb.getWorksheet("Summary")!;

    const view = sheet.views[0] as { state: string; ySplit: number };
    expect(view.state).toBe("frozen");
    expect(view.ySplit).toBe(2);
  });
});

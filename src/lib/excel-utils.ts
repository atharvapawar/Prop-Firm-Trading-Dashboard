import * as XLSX from "xlsx";
import type { Trade, Settings } from "../types";
import { CANONICAL_TRADE_COLUMNS, EXCEL_SHEET_NAMES } from "./trading-data";
import { getStartingBalance } from "./utils";

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Map one app trade to the canonical 18-column row used in Excel exports. */
function tradeToRow(trade: Trade, settings: Settings): unknown[] {
  return [
    trade.date || "",
    trade.session || "London",
    trade.entry || "XAUUSD",
    "", // Setup Type
    "", // Direction
    "", // Entry Price
    "", // Stop Loss Price
    "", // Take Profit Price
    settings.stopLossPips || 0,
    settings.takeProfitPips || 0,
    parseFloat(trade.lotSize) || 0,
    parseFloat(trade.riskDollars) || 0,
    parseFloat(trade.rewardDollars) || 0,
    parseFloat(trade.resultDollars) || 0,
    trade.outcome || "",
    "", // Rule Followed
    parseFloat(trade.equityAfter) || 0,
    trade.notes || "",
  ];
}

/** Column widths for the Trade_Journal sheet (matches CANONICAL_TRADE_COLUMNS order). */
const JOURNAL_COL_WIDTHS = [
  12, 15, 10, 15, 12, 12, 15, 15, 15, 15, 10, 12, 12, 12, 10, 15, 18, 40,
].map((wch) => ({ wch }));

/** Compute peak-equity, max-drawdown, and win-rate stats in a single pass. */
function computeStats(trades: Trade[], settings: Settings) {
  const wins = trades.filter((t) => t?.outcome === "Win").length;
  const losses = trades.length - wins;
  const winRatePct = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  const start = getStartingBalance(settings);
  let currentEquity = start;
  let peakEquity = start;
  let maxDrawdown = 0;

  if (trades.length > 0) {
    const last = trades[trades.length - 1];
    if (last?.equityAfter) currentEquity = Number(last.equityAfter) || start;

    let running = start;
    for (const t of trades) {
      if (!t?.resultDollars) continue;
      running += Number(t.resultDollars) || 0;
      if (running > peakEquity) peakEquity = running;
      const dd = peakEquity - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRatePct,
    totalPL: currentEquity - start,
    currentEquity,
    peakEquity,
    maxDrawdown,
    maxDrawdownPct: peakEquity > 0 ? maxDrawdown / peakEquity : 0,
  };
}

/** Open a native file-picker filtered to Excel files, read the selection as
 *  an ArrayBuffer, parse it with XLSX, and pass the workbook to `onWorkbook`.
 *  All error paths are handled internally — `onWorkbook` only fires on success. */
function pickExcelFile(onWorkbook: (wb: XLSX.WorkBook) => void): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert("Failed to read the file. Please try again.");
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(new Uint8Array(ev.target!.result as ArrayBuffer), {
          type: "array",
        });
        onWorkbook(wb);
      } catch {
        alert(
          "Could not parse the Excel file. Ensure it is a valid .xlsx or .xls file.",
        );
      }
    };
    reader.readAsArrayBuffer(file);
  };
  input.click();
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Validate that a workbook matches the expected sheet names and column
 *  headers before attempting to import from it. */
export function validateExcelStructure(
  workbook: XLSX.WorkBook,
  sheetNames: string[] = EXCEL_SHEET_NAMES,
): { valid: true } | { valid: false; error: string } {
  if (workbook.SheetNames.length !== sheetNames.length) {
    return {
      valid: false,
      error: `Expected ${sheetNames.length} sheets, found ${workbook.SheetNames.length}`,
    };
  }
  for (let i = 0; i < sheetNames.length; i++) {
    if (workbook.SheetNames[i] !== sheetNames[i]) {
      return {
        valid: false,
        error: `Sheet ${i + 1} must be "${sheetNames[i]}", found "${workbook.SheetNames[i]}"`,
      };
    }
  }
  const sheet = workbook.Sheets["Trade_Journal"];
  if (!sheet) return { valid: false, error: "Trade_Journal sheet not found" };
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];
  if (!rows.length)
    return { valid: false, error: "Trade_Journal sheet is empty" };
  const headers = (rows[0] ?? []).map((h) => String(h).trim());
  if (headers.length !== CANONICAL_TRADE_COLUMNS.length) {
    return {
      valid: false,
      error: `Trade_Journal must have ${CANONICAL_TRADE_COLUMNS.length} columns, found ${headers.length}`,
    };
  }
  for (let i = 0; i < CANONICAL_TRADE_COLUMNS.length; i++) {
    if (headers[i] !== CANONICAL_TRADE_COLUMNS[i]) {
      return {
        valid: false,
        error: `Column ${i + 1} must be "${CANONICAL_TRADE_COLUMNS[i]}", found "${headers[i]}"`,
      };
    }
  }
  return { valid: true };
}

/** Download the trade list as a plain CSV file. */
export function exportToCSV(trades: Trade[]): void {
  const headers = [
    "Date",
    "Session",
    "Pair",
    "Lot Size",
    "Outcome",
    "Risk $",
    "Reward $",
    "Result $",
    "Equity After",
    "Notes",
  ];
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = trades.map((t) =>
    [
      t.date,
      t.session,
      t.entry,
      t.lotSize,
      t.outcome,
      t.riskDollars,
      t.rewardDollars,
      t.resultDollars,
      t.equityAfter,
      t.notes,
    ]
      .map(escape)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `prop-firm-trades-${new Date().toISOString().split("T")[0]}.csv`,
    style: "visibility:hidden",
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Build and download a fully structured 6-sheet Excel workbook. */
export function exportToExcel(trades: Trade[], settings: Settings): void {
  try {
    const wb = XLSX.utils.book_new();
    const stats = computeStats(trades, settings);

    // Sheet 1 — Dashboard
    const dashWs = XLSX.utils.aoa_to_sheet([
      ["ACCOUNT DASHBOARD", ""],
      ["", ""],
      ["Starting Balance ($)", settings.accountBalance],
      ["Fixed SL (pips)", settings.stopLossPips],
      ["Default Risk %", settings.riskPercent / 100],
      ["", ""],
      [
        "Phase 1 Target ($)",
        settings.accountBalance * (1 + settings.phase1Target / 100),
      ],
      [
        "Phase 2 Target ($)",
        settings.accountBalance *
          (1 + settings.phase1Target / 100) *
          (1 + settings.phase2Target / 100),
      ],
      ["", ""],
      [
        "Daily Drawdown Limit ($)",
        settings.accountBalance * (settings.dailyDrawdownLimit / 100),
      ],
      ["Max Drawdown Limit (10%) ($)", settings.accountBalance * 0.1],
    ]);
    dashWs["!cols"] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, dashWs, "Dashboard");

    // Sheet 2 — Trade_Journal
    const journalWs = XLSX.utils.aoa_to_sheet([
      CANONICAL_TRADE_COLUMNS,
      ...trades.map((t) => tradeToRow(t, settings)),
    ]);
    journalWs["!cols"] = JOURNAL_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, journalWs, "Trade_Journal");

    // Sheet 3 — Stats
    const statsWs = XLSX.utils.aoa_to_sheet([
      ["Total Trades", stats.totalTrades],
      ["Winning Trades", stats.wins],
      ["Losing Trades", stats.losses],
      ["Win Rate %", stats.winRatePct],
      ["", ""],
      ["Total P/L ($)", stats.totalPL],
      ["Current Equity ($)", stats.currentEquity],
      ["Peak Equity ($)", stats.peakEquity],
      ["Max Drawdown ($)", stats.maxDrawdown],
      ["Max Drawdown %", stats.maxDrawdownPct * 100],
    ]);
    statsWs["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, statsWs, "Stats");

    // Sheet 4 — Progress
    const p1 = settings.accountBalance * (settings.phase1Target / 100);
    const p2 = settings.accountBalance * (settings.phase2Target / 100);
    const progressWs = XLSX.utils.aoa_to_sheet([
      ["Phase 1 Target ($)", p1],
      ["Phase 2 Target ($)", p2],
      ["", ""],
      ["Current P/L ($)", stats.totalPL],
      [
        "Progress to Phase 1 (%)",
        p1 > 0 ? Math.min(100, (stats.totalPL / p1) * 100) : 0,
      ],
      [
        "Progress to Phase 2 (%)",
        p2 > 0 ? Math.min(100, (stats.totalPL / p2) * 100) : 0,
      ],
    ]);
    progressWs["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, progressWs, "Progress");

    // Sheet 5 — READ ME
    const readMeWs = XLSX.utils.aoa_to_sheet([
      ["READ ME FIRST — HOW TO USE THIS TRADING JOURNAL"],
      [""],
      ["EDIT ONLY THESE COLUMNS IN Trade_Journal:"],
      [
        "Date, Session, Pair, Setup Type, Direction, Entry, SL, TP, SL pips, TP pips, Lot, Outcome, Rule Followed, Notes",
      ],
      [""],
      ["DO NOT EDIT:"],
      [
        "Risk $, Reward $, Result $, Equity After Trade, Stats sheet, Progress sheet",
      ],
      [""],
      ["HOW IT WORKS:"],
      ["Risk $ = Balance × Risk % / 100"],
      ["Reward $ = Lot × TP pips × 100"],
      ["Result $ auto-calculates based on Win/Loss outcome"],
    ]);
    readMeWs["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, readMeWs, "READ ME");

    // Sheet 6 — 1-PAGE GUIDE
    const guideWs = XLSX.utils.aoa_to_sheet([
      ["PROP FIRM TRADING JOURNAL — QUICK GUIDE"],
      [""],
      [
        `ACCOUNT: $${settings.accountBalance} | TARGET: ${settings.phase1Target}% then ${settings.phase2Target}%`,
      ],
      [""],
      ["ENTER DATA ONLY IN Trade_Journal"],
      ["ONE ROW = ONE TRADE"],
      [""],
      ["GREEN = WIN  |  RED = LOSS"],
      [""],
      ["CHECK Stats & Progress DAILY"],
    ]);
    guideWs["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, guideWs, "1-PAGE GUIDE");

    XLSX.writeFile(wb, "PROP_FIRM_TRADING_JOURNAL.xlsx");
    alert(
      `Excel exported — ${trades.length} trade(s) written across all 6 sheets.`,
    );
  } catch {
    alert("Export failed. Please try again.");
  }
}

/** Open a file picker, validate the structure, and import trade rows from the
 *  Trade_Journal sheet of the selected workbook. */
export function importFromExcel(
  onImport: (trades: Partial<Trade>[]) => void,
): void {
  pickExcelFile((wb) => {
    const validation = validateExcelStructure(wb);
    if (!validation.valid) {
      alert(
        `Import blocked:\n${"error" in validation ? validation.error : "Invalid file structure"}`,
      );
      return;
    }

    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Trade_Journal"], {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];

    if (rows.length < 2) {
      alert("No data rows found in Trade_Journal.");
      return;
    }

    const colIdx: Record<string, number> = {};
    CANONICAL_TRADE_COLUMNS.forEach((col, i) => {
      colIdx[col] = i;
    });

    const imported: Partial<Trade>[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const dateVal = String(row[colIdx["Date"]] ?? "").trim();
      if (!dateVal || dateVal.includes("DO NOT EDIT")) continue;
      const pair = String(row[colIdx["Pair"]] ?? "").trim();
      if (!pair) continue;

      imported.push({
        id: Date.now() + i + Math.random(),
        date: dateVal,
        session: String(row[colIdx["Session (IST)"]] ?? "London").trim(),
        entry: pair,
        lotSize: String(parseFloat(row[colIdx["Lot Size"]]) || 0),
        outcome: String(row[colIdx["Outcome"]] ?? "Win").trim() as
          | "Win"
          | "Loss",
        notes: String(row[colIdx["Notes"]] ?? "").trim(),
        riskDollars: String(parseFloat(row[colIdx["Risk $"]]) || 0),
        rewardDollars: String(parseFloat(row[colIdx["Reward $"]]) || 0),
        resultDollars: String(parseFloat(row[colIdx["Result $"]]) || 0),
        equityAfter: String(parseFloat(row[colIdx["Equity After Trade"]]) || 0),
      });
    }

    if (imported.length === 0) {
      alert("No valid trade rows found.");
      return;
    }
    onImport(imported);
    alert(`Imported ${imported.length} trade(s) successfully.`);
  });
}

/** Open a file picker, load an existing Excel workbook, and append any trades
 *  not already present (deduped by date+pair+lot key). */
export function uploadToExistingExcel(
  trades: Trade[],
  settings: Settings,
): void {
  if (trades.length === 0) {
    alert("No trades to upload.");
    return;
  }

  pickExcelFile((wb) => {
    // Find the journal sheet by name (flexible matching).
    const sheetName =
      wb.SheetNames.find(
        (n) =>
          n.toLowerCase().includes("trade") &&
          n.toLowerCase().includes("journal"),
      ) ??
      wb.SheetNames.find(
        (n) =>
          n.toLowerCase().includes("trade") ||
          n.toLowerCase().includes("journal"),
      );
    if (!sheetName) {
      alert("Could not locate a Trade_Journal sheet.");
      return;
    }

    const existingData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];
    if (!existingData?.length) {
      alert("The selected sheet appears to be empty.");
      return;
    }

    const rawHeaders = existingData[0] ?? [];
    const headers = rawHeaders.map((h) => String(h).trim().toLowerCase());
    const dateIdx = headers.findIndex(
      (h) => h.includes("date") && !h.includes("trade"),
    );
    const pairIdx = headers.findIndex((h) => h.includes("pair"));
    // Prefer "entry price" column; fall back to "pair".
    const entryIdx =
      headers.findIndex((h) => h.includes("entry") && h.includes("price")) !==
      -1
        ? headers.findIndex((h) => h.includes("entry") && h.includes("price"))
        : pairIdx;
    const lotIdx = headers.findIndex(
      (h) => h.includes("lot") && !h.includes("loss"),
    );

    if (dateIdx === -1 || entryIdx === -1) {
      alert("The file must contain Date and Pair/Entry Price columns.");
      return;
    }

    // Build dedup map from existing rows.
    const seen = new Map<string, true>();
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      if (!row) continue;
      const d = String(row[dateIdx] ?? "").trim();
      const p = String(row[entryIdx] ?? "").trim();
      const l = String(row[lotIdx] ?? "").trim();
      if (d && p) seen.set(`${d}|${p}|${l}`, true);
    }

    const toAdd = trades.filter((t) => {
      if (!t?.date || !t?.entry) return false;
      const key = `${t.date}|${t.entry}|${t.lotSize ?? ""}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });

    if (toAdd.length === 0) {
      alert("All trades already exist in the file — nothing to add.");
      return;
    }

    // Recover the last known running equity from the existing sheet.
    const eqIdx = headers.findIndex(
      (h) => h.includes("equity") && h.includes("trade"),
    );
    let runningEquity = settings.accountBalance;
    if (eqIdx !== -1) {
      for (let i = existingData.length - 1; i >= 1; i--) {
        const eq = Number(existingData[i]?.[eqIdx]);
        if (isFinite(eq) && eq > 0) {
          runningEquity = eq;
          break;
        }
      }
    }

    // Append new rows to the existing data in-place (preserves original sheet order).
    for (const t of toAdd) {
      runningEquity += Number(t.resultDollars) || 0;
      existingData.push(
        tradeToRow(
          { ...t, equityAfter: String(runningEquity) },
          settings,
        ) as string[],
      );
    }

    // Rebuild the workbook with the updated journal in its original position.
    const newWb = XLSX.utils.book_new();
    for (const sn of wb.SheetNames) {
      const ws =
        sn === sheetName
          ? (() => {
              const s = XLSX.utils.aoa_to_sheet(existingData);
              s["!cols"] = JOURNAL_COL_WIDTHS;
              return s;
            })()
          : wb.Sheets[sn];
      if (ws) XLSX.utils.book_append_sheet(newWb, ws, sn);
    }

    XLSX.writeFile(newWb, "PROP_FIRM_TRADING_JOURNAL.xlsx");
    alert(`Added ${toAdd.length} new trade(s). Duplicates were skipped.`);
  });
}

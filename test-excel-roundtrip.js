/**
 * Roundtrip Test: Export → Import → Compare JSON
 * 
 * This test verifies that the Excel export/import cycle maintains data integrity
 * with zero drift between the original and imported data.
 */

import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the canonical model constants and functions from App.jsx
// For testing, we'll duplicate the essential logic here

const CANONICAL_TRADE_COLUMNS = [
  "Date",
  "Session (IST)",
  "Pair",
  "Setup Type",
  "Direction",
  "Entry Price",
  "Stop Loss Price",
  "Take Profit Price",
  "Stop Loss (pips)",
  "Take Profit (pips)",
  "Lot Size",
  "Risk $",
  "Reward $",
  "Result $",
  "Outcome",
  "Rule Followed?",
  "Equity After Trade",
  "Notes",
];

const EXCEL_SHEET_NAMES = [
  "Dashboard",
  "Trade_Journal",
  "Stats",
  "Progress",
  "READ ME",
  "1-PAGE GUIDE",
];

// Test settings
const TEST_SETTINGS = {
  accountBalance: 5000,
  stopLossPips: 12,
  takeProfitPips: 5,
  riskPercent: 0.5,
  phase1Target: 10,
  phase2Target: 5,
  dailyDrawdownLimit: 5,
};

// Create sample trade data in canonical format
const createTestTrade = (index, settings) => {
  const lotSize = 0.02 + (index * 0.01);
  const riskAmount = lotSize * 100 * settings.stopLossPips;
  const rewardAmount = lotSize * 100 * settings.takeProfitPips;
  const outcome = index % 2 === 0 ? "Win" : "Loss";
  const resultAmount = outcome === "Win" ? rewardAmount : -riskAmount;
  const equityAfter = settings.accountBalance + (index + 1) * 10;

  return {
    id: 1000 + index,
    date: `2025-01-${String(index + 1).padStart(2, "0")}`,
    session: ["London", "New York", "Asian"][index % 3],
    pair: "XAUUSD",
    setupType: ["Breakout retest", "Liquidity sweep", "Rejection wick"][index % 3],
    direction: index % 2 === 0 ? "Buy" : "Sell",
    entryPrice: 4383 + index,
    stopLossPrice: 4371 + index,
    takeProfitPrice: 4388 + index,
    stopLossPips: settings.stopLossPips,
    takeProfitPips: settings.takeProfitPips,
    lotSize: lotSize,
    riskAmount: riskAmount,
    rewardAmount: rewardAmount,
    resultAmount: resultAmount,
    outcome: outcome,
    ruleFollowed: index % 3 === 0 ? "Yes" : "No",
    equityAfter: equityAfter,
    notes: `Test trade ${index + 1}`,
  };
};

// Convert canonical trade to Excel row
const tradeToExcelRow = (trade) => {
  return [
    trade.date,
    trade.session,
    trade.pair,
    trade.setupType,
    trade.direction,
    trade.entryPrice === "" ? "" : trade.entryPrice,
    trade.stopLossPrice === "" ? "" : trade.stopLossPrice,
    trade.takeProfitPrice === "" ? "" : trade.takeProfitPrice,
    trade.stopLossPips,
    trade.takeProfitPips,
    trade.lotSize,
    trade.riskAmount,
    trade.rewardAmount,
    trade.resultAmount,
    trade.outcome,
    trade.ruleFollowed,
    trade.equityAfter,
    trade.notes,
  ];
};

// Convert Excel row to canonical trade
const excelRowToTrade = (row, columnIndices, rowIndex) => {
  const dateValue = String(row[columnIndices["Date"]] || "").trim();
  if (dateValue.includes("⚠️") || dateValue.includes("DO NOT EDIT") || dateValue === "") {
    return null;
  }

  try {
    const trade = {
      id: 2000 + rowIndex, // Generate test ID
      date: dateValue,
      session: String(row[columnIndices["Session (IST)"]] || "").trim(),
      pair: String(row[columnIndices["Pair"]] || "").trim(),
      setupType: String(row[columnIndices["Setup Type"]] || "").trim(),
      direction: String(row[columnIndices["Direction"]] || "").trim(),
      entryPrice: parseFloat(row[columnIndices["Entry Price"]]) || "",
      stopLossPrice: parseFloat(row[columnIndices["Stop Loss Price"]]) || "",
      takeProfitPrice: parseFloat(row[columnIndices["Take Profit Price"]]) || "",
      stopLossPips: parseFloat(row[columnIndices["Stop Loss (pips)"]]) || 0,
      takeProfitPips: parseFloat(row[columnIndices["Take Profit (pips)"]]) || 0,
      lotSize: parseFloat(row[columnIndices["Lot Size"]]) || 0,
      riskAmount: parseFloat(row[columnIndices["Risk $"]]) || 0,
      rewardAmount: parseFloat(row[columnIndices["Reward $"]]) || 0,
      resultAmount: parseFloat(row[columnIndices["Result $"]]) || 0,
      outcome: String(row[columnIndices["Outcome"]] || "").trim(),
      ruleFollowed: String(row[columnIndices["Rule Followed?"]] || "").trim(),
      equityAfter: parseFloat(row[columnIndices["Equity After Trade"]]) || 0,
      notes: String(row[columnIndices["Notes"]] || "").trim(),
    };

    if (!trade.date || !trade.pair) {
      return null;
    }

    return trade;
  } catch (error) {
    console.error(`Error parsing row ${rowIndex}:`, error);
    return null;
  }
};

// Normalize trade for comparison (ignore ID and float precision)
const normalizeTrade = (trade) => {
  return {
    date: trade.date,
    session: trade.session,
    pair: trade.pair,
    setupType: trade.setupType,
    direction: trade.direction,
    entryPrice: trade.entryPrice === "" ? "" : parseFloat(trade.entryPrice),
    stopLossPrice: trade.stopLossPrice === "" ? "" : parseFloat(trade.stopLossPrice),
    takeProfitPrice: trade.takeProfitPrice === "" ? "" : parseFloat(trade.takeProfitPrice),
    stopLossPips: parseFloat(trade.stopLossPips),
    takeProfitPips: parseFloat(trade.takeProfitPips),
    lotSize: parseFloat(trade.lotSize),
    riskAmount: Math.round(parseFloat(trade.riskAmount) * 100) / 100,
    rewardAmount: Math.round(parseFloat(trade.rewardAmount) * 100) / 100,
    resultAmount: Math.round(parseFloat(trade.resultAmount) * 100) / 100,
    outcome: trade.outcome,
    ruleFollowed: trade.ruleFollowed,
    equityAfter: parseFloat(trade.equityAfter),
    notes: trade.notes,
  };
};

// Export trades to Excel (simplified version for testing)
const exportTradesToExcel = (trades, settings, filename) => {
  const wb = XLSX.utils.book_new();

  // Dashboard Sheet
  const dashboardData = [
    ["ACCOUNT DASHBOARD", ""],
    ["", ""],
    ["Starting Balance ($)", settings.accountBalance],
    ["Fixed SL (pips)", settings.stopLossPips],
    ["Default Risk % (editable)", settings.riskPercent / 100],
    ["", ""],
    ["Phase1 Target (10%)", settings.accountBalance * (settings.phase1Target / 100)],
    ["Phase2 Target (5%)", settings.accountBalance * (settings.phase2Target / 100)],
    ["", ""],
    ["Daily Drawdown Limit (5%)", settings.accountBalance * (settings.dailyDrawdownLimit / 100)],
    ["Overall Drawdown Limit (10%)", settings.accountBalance * 0.1],
  ];
  const dashboardWs = XLSX.utils.aoa_to_sheet(dashboardData);
  XLSX.utils.book_append_sheet(wb, dashboardWs, "Dashboard");

  // Trade_Journal Sheet
  const tradeJournalHeaders = [...CANONICAL_TRADE_COLUMNS];
  const tradeJournalData = [tradeJournalHeaders];

  trades.forEach((trade) => {
    const excelRow = tradeToExcelRow(trade);
    tradeJournalData.push(excelRow);
  });

  const tradeJournalWs = XLSX.utils.aoa_to_sheet(tradeJournalData);
  XLSX.utils.book_append_sheet(wb, tradeJournalWs, "Trade_Journal");

  // Stats Sheet (simplified)
  const statsData = [
    ["Total Trades", trades.length],
    ["Winning Trades", trades.filter((t) => t.outcome === "Win").length],
    ["Losing Trades", trades.filter((t) => t.outcome === "Loss").length],
    ["Win Rate %", trades.length > 0 ? trades.filter((t) => t.outcome === "Win").length / trades.length : 0],
  ];
  const statsWs = XLSX.utils.aoa_to_sheet(statsData);
  XLSX.utils.book_append_sheet(wb, statsWs, "Stats");

  // Progress Sheet (simplified)
  const progressData = [
    ["Phase 1 Target (10%)", settings.accountBalance * (settings.phase1Target / 100)],
    ["Phase 2 Target (5%)", settings.accountBalance * (settings.phase2Target / 100)],
  ];
  const progressWs = XLSX.utils.aoa_to_sheet(progressData);
  XLSX.utils.book_append_sheet(wb, progressWs, "Progress");

  // READ ME Sheet
  const readMeData = [
    ["⚠️ READ ME FIRST – HOW TO USE THIS TRADING JOURNAL"],
    [""],
    ["EDIT ONLY THESE COLUMNS IN Trade_Journal:"],
    ["Date, Session, Pair, Setup Type, Direction, Entry, SL, TP, SL pips, TP pips, Lot, Outcome, Rule Followed, Notes"],
  ];
  const readMeWs = XLSX.utils.aoa_to_sheet(readMeData);
  XLSX.utils.book_append_sheet(wb, readMeWs, "READ ME");

  // 1-PAGE GUIDE Sheet
  const guideData = [
    ["XAUUSD TRADING JOURNAL – QUICK GUIDE"],
    [""],
    ["PAIR: XAUUSD | SL: 12 pips | TP: 5 pips"],
  ];
  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  XLSX.utils.book_append_sheet(wb, guideWs, "1-PAGE GUIDE");

  // Write file
  XLSX.writeFile(wb, filename);
};

// Import trades from Excel
const importTradesFromExcel = (filename) => {
  const fileBuffer = readFileSync(filename);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });

  // Validate sheet names
  if (workbook.SheetNames.length !== EXCEL_SHEET_NAMES.length) {
    throw new Error(
      `Expected ${EXCEL_SHEET_NAMES.length} sheets, found ${workbook.SheetNames.length}`
    );
  }

  for (let i = 0; i < EXCEL_SHEET_NAMES.length; i++) {
    if (workbook.SheetNames[i] !== EXCEL_SHEET_NAMES[i]) {
      throw new Error(
        `Sheet ${i + 1} must be "${EXCEL_SHEET_NAMES[i]}", found "${workbook.SheetNames[i]}"`
      );
    }
  }

  // Get Trade_Journal sheet
  const tradeJournalSheet = workbook.Sheets["Trade_Journal"];
  if (!tradeJournalSheet) {
    throw new Error("Trade_Journal sheet not found");
  }

  const excelData = XLSX.utils.sheet_to_json(tradeJournalSheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!excelData || excelData.length < 2) {
    throw new Error("Trade_Journal sheet has no data rows");
  }

  // Build column index map
  const columnIndices = {};
  CANONICAL_TRADE_COLUMNS.forEach((colName, index) => {
    columnIndices[colName] = index;
  });

  // Parse trades
  const importedTrades = [];
  for (let i = 1; i < excelData.length; i++) {
    const row = excelData[i];
    if (!row || !Array.isArray(row)) {
      continue;
    }

    const trade = excelRowToTrade(row, columnIndices, i);
    if (trade) {
      importedTrades.push(trade);
    }
  }

  return importedTrades;
};

// Compare two trades (ignoring ID)
const compareTrades = (trade1, trade2) => {
  const norm1 = normalizeTrade(trade1);
  const norm2 = normalizeTrade(trade2);

  const keys = Object.keys(norm1);
  const differences = [];

  for (const key of keys) {
    const val1 = norm1[key];
    const val2 = norm2[key];

    if (typeof val1 === "number" && typeof val2 === "number") {
      if (Math.abs(val1 - val2) > 0.01) {
        differences.push({
          key,
          original: val1,
          imported: val2,
          diff: Math.abs(val1 - val2),
        });
      }
    } else if (String(val1) !== String(val2)) {
      differences.push({
        key,
        original: val1,
        imported: val2,
      });
    }
  }

  return differences;
};

// Main test function
const runRoundtripTest = () => {
  console.log("🧪 Starting Excel Export → Import Roundtrip Test\n");

  // Create test data
  const numTrades = 5;
  const originalTrades = [];
  for (let i = 0; i < numTrades; i++) {
    originalTrades.push(createTestTrade(i, TEST_SETTINGS));
  }

  console.log(`✓ Created ${numTrades} test trades`);
  console.log(`  Original trades:`, JSON.stringify(originalTrades, null, 2));

  // Export to Excel
  const testFileName = join(__dirname, "test-export.xlsx");
  try {
    exportTradesToExcel(originalTrades, TEST_SETTINGS, testFileName);
    console.log(`✓ Exported to ${testFileName}`);
  } catch (error) {
    console.error("❌ Export failed:", error);
    process.exit(1);
  }

  // Import from Excel
  let importedTrades;
  try {
    importedTrades = importTradesFromExcel(testFileName);
    console.log(`✓ Imported ${importedTrades.length} trades from Excel`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  } finally {
    // Clean up test file
    try {
      unlinkSync(testFileName);
      console.log(`✓ Cleaned up test file`);
    } catch (error) {
      console.warn(`⚠ Could not delete test file: ${error.message}`);
    }
  }

  // Compare results
  console.log(`\n📊 Comparison Results:`);
  console.log(`  Original trades: ${originalTrades.length}`);
  console.log(`  Imported trades: ${importedTrades.length}`);

  if (originalTrades.length !== importedTrades.length) {
    console.error(`❌ Trade count mismatch!`);
    process.exit(1);
  }

  let allMatch = true;
  for (let i = 0; i < originalTrades.length; i++) {
    const differences = compareTrades(originalTrades[i], importedTrades[i]);
    if (differences.length > 0) {
      allMatch = false;
      console.error(`\n❌ Trade ${i + 1} has differences:`);
      differences.forEach((diff) => {
        console.error(`  - ${diff.key}:`);
        console.error(`    Original: ${diff.original}`);
        console.error(`    Imported: ${diff.imported}`);
        if (diff.diff) {
          console.error(`    Difference: ${diff.diff}`);
        }
      });
    }
  }

  if (allMatch) {
    console.log(`\n✅ SUCCESS: All trades match perfectly! Zero drift detected.`);
    console.log(`\n📝 Imported trades:`, JSON.stringify(importedTrades, null, 2));
    return true;
  } else {
    console.error(`\n❌ FAILURE: Data drift detected!`);
    process.exit(1);
  }
};

// Run the test
runRoundtripTest();


import type { Settings } from "../types";

export const STORAGE_KEYS = {
  SETTINGS: "propFirmSettings",
  TRADES: "propFirmTrades",
};

export const RISK_PRESETS = {
  safe: 0.25,
  balanced: 0.5,
  aggressive: 1.0,
};

export const CHALLENGE_ACCOUNTS = [5000, 10000, 25000, 50000, 100000];

export const TRADING_PAIRS = [
  "XAUUSD", "XAGUSD", "XAUEUR",
  "EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD", "NZD/USD",
  "EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD", "GBP/AUD", "EUR/CAD",
  "GBP/CAD", "AUD/CAD", "EUR/CHF", "GBP/CHF", "AUD/CHF", "EUR/NZD", "GBP/NZD",
  "USD/TRY", "USD/ZAR", "USD/MXN", "USD/SGD", "USD/HKD", "USD/SEK", "USD/NOK",
  "BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD", "ADA/USD", "XRP/USD", "DOT/USD",
  "DOGE/USD", "MATIC/USD", "LTC/USD", "AVAX/USD", "LINK/USD", "UNI/USD",
  "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT",
];

export const TRADING_NOTES = [
  "Very Good", "Good", "Excellent", "Perfect", "Bad", "Poor", "Terrible",
  "Followed Plan", "Did Not Follow Plan", "Emotional Trade", "Revenge Trade",
  "FOMO Trade", "Overtrading", "Good Entry", "Bad Entry", "Good Exit", "Bad Exit",
  "Trend Following", "Counter Trend", "Range Trading", "Breakout", "Reversal",
  "High Volatility", "Low Volatility", "News Event", "Economic Data",
  "Technical Analysis", "Fundamental Analysis", "Price Action", "Support/Resistance",
  "Moving Average", "RSI Signal", "MACD Signal", "Fibonacci",
  "Cut Losses Early", "Let Winners Run", "Risk Management", "Position Sizing",
  "Timing Issue", "Patience Needed", "Discipline", "Greed", "Fear",
  "London Session", "New York Session", "Asian Session", "Overlap Session",
  "Scalping", "Day Trading", "Swing Trading", "Position Trading",
  "Requires Review", "Needs Improvement", "Well Executed", "Rushed Decision",
];

export const DEFAULT_SETTINGS: Settings = {
  accountBalance: 10000,
  riskPercent: 0.5,
  riskPreset: "balanced",
  stopLossPips: 20,
  takeProfitPips: 40,
  phase1Target: 8,
  phase2Target: 5,
  dailyDrawdownLimit: 5,
  challengeType: "two-step",
  masterAccountBalance: 10000,
  monthlyTarget: 0,
};

export const CANONICAL_TRADE_COLUMNS = [
  "Date", "Session (IST)", "Pair", "Setup Type", "Direction",
  "Entry Price", "Stop Loss Price", "Take Profit Price",
  "Stop Loss (pips)", "Take Profit (pips)", "Lot Size",
  "Risk $", "Reward $", "Result $", "Outcome", "Rule Followed?",
  "Equity After Trade", "Notes",
];

export const EXCEL_SHEET_NAMES = [
  "Dashboard", "Trade_Journal", "Stats", "Progress", "READ ME", "1-PAGE GUIDE",
];

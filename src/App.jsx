import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

const STORAGE_KEYS = {
  SETTINGS: "propFirmSettings",
  TRADES: "propFirmTrades",
};

const RISK_PRESETS = {
  safe: 0.25,
  balanced: 0.5,
  aggressive: 1.0,
};

const CHALLENGE_ACCOUNTS = [5000, 10000, 25000, 50000, 100000];

// Trading Pairs - XAUUSD first, then major forex, then crypto
const TRADING_PAIRS = [
  // Metals (First)
  "XAUUSD",
  "XAGUSD",
  "XAUEUR",
  // Major Forex Pairs
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "USD/CHF",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  // Minor Forex Pairs
  "EUR/GBP",
  "EUR/JPY",
  "GBP/JPY",
  "AUD/JPY",
  "EUR/AUD",
  "GBP/AUD",
  "EUR/CAD",
  "GBP/CAD",
  "AUD/CAD",
  "EUR/CHF",
  "GBP/CHF",
  "AUD/CHF",
  "EUR/NZD",
  "GBP/NZD",
  // Exotic Pairs
  "USD/TRY",
  "USD/ZAR",
  "USD/MXN",
  "USD/SGD",
  "USD/HKD",
  "USD/SEK",
  "USD/NOK",
  // Crypto Pairs
  "BTC/USD",
  "ETH/USD",
  "BNB/USD",
  "SOL/USD",
  "ADA/USD",
  "XRP/USD",
  "DOT/USD",
  "DOGE/USD",
  "MATIC/USD",
  "LTC/USD",
  "AVAX/USD",
  "LINK/USD",
  "UNI/USD",
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
];

// Common Trading Notes
const TRADING_NOTES = [
  // Performance Notes
  "Very Good",
  "Good",
  "Excellent",
  "Perfect",
  "Bad",
  "Poor",
  "Terrible",
  // Strategy Notes
  "Followed Plan",
  "Did Not Follow Plan",
  "Emotional Trade",
  "Revenge Trade",
  "FOMO Trade",
  "Overtrading",
  "Good Entry",
  "Bad Entry",
  "Good Exit",
  "Bad Exit",
  // Market Conditions
  "Trend Following",
  "Counter Trend",
  "Range Trading",
  "Breakout",
  "Reversal",
  "High Volatility",
  "Low Volatility",
  "News Event",
  "Economic Data",
  // Analysis
  "Technical Analysis",
  "Fundamental Analysis",
  "Price Action",
  "Support/Resistance",
  "Moving Average",
  "RSI Signal",
  "MACD Signal",
  "Fibonacci",
  // Mistakes & Lessons
  "Cut Losses Early",
  "Let Winners Run",
  "Risk Management",
  "Position Sizing",
  "Timing Issue",
  "Patience Needed",
  "Discipline",
  "Greed",
  "Fear",
  // Session Notes
  "London Session",
  "New York Session",
  "Asian Session",
  "Overlap Session",
  // Other
  "Scalping",
  "Day Trading",
  "Swing Trading",
  "Position Trading",
  "Requires Review",
  "Needs Improvement",
  "Well Executed",
  "Rushed Decision",
];

const DEFAULT_SETTINGS = {
  accountBalance: 10000,
  riskPercent: 0.5,
  riskPreset: "balanced", // safe, balanced, aggressive
  stopLossPips: 20,
  takeProfitPips: 40,
  phase1Target: 8,
  phase2Target: 5,
  dailyDrawdownLimit: 5,
  challengeType: "two-step", // two-step, one-step, zero-step
  masterAccountBalance: 10000,
  monthlyTarget: 0, // Monthly target for master account (0 = not set)
};

// Advanced Date Picker Component
const DatePicker = ({ value, onChange }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  const selectedDate = value ? new Date(value) : today;

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDateSelect = (day) => {
    if (day === null) return;
    const newDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    onChange(newDate.toISOString().split("T")[0]);
    setShowCalendar(false);
  };

  const isToday = (day) => {
    if (day === null) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (day) => {
    if (day === null || !value) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    return date.toDateString() === selectedDate.toDateString();
  };

  const navigateMonth = (direction) => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const setToday = () => {
    onChange(today.toISOString().split("T")[0]);
    setCurrentMonth(today);
    setShowCalendar(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        className="input w-full cursor-pointer"
        value={value || ""}
        onClick={() => setShowCalendar(!showCalendar)}
        readOnly
        placeholder="Select date"
      />
      {showCalendar && (
        <div className="absolute z-50 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 w-80">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-700 rounded"
            >
              ←
            </button>
            <div className="font-semibold">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-700 rounded"
            >
              →
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div key={day} className="text-center text-xs text-gray-400 p-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((day, idx) => (
              <button
                key={idx}
                onClick={() => handleDateSelect(day)}
                className={`
                  p-2 rounded text-sm hover:bg-gray-700 transition-colors
                  ${day === null ? "invisible" : ""}
                  ${isToday(day) ? "bg-blue-600 text-white font-bold" : ""}
                  ${
                    isSelected(day)
                      ? "bg-sky-500 text-white font-bold"
                      : "text-gray-300"
                  }
                  ${
                    !isToday(day) && !isSelected(day) ? "hover:bg-gray-700" : ""
                  }
                `}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="mt-4 flex justify-between">
            <button
              onClick={setToday}
              className="px-3 py-1 text-sm bg-sky-600 hover:bg-sky-700 rounded text-white"
            >
              Today
            </button>
            <button
              onClick={() => setShowCalendar(false)}
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [trades, setTrades] = useState([]);
  const [editingTradeId, setEditingTradeId] = useState(null);
  const [showAddTradeForm, setShowAddTradeForm] = useState(false);
  // Track input values during editing (to allow empty state)
  const [inputValues, setInputValues] = useState({});
  const [newTrade, setNewTrade] = useState({
    date: new Date().toISOString().split("T")[0],
    session: "London",
    entry: "XAUUSD", // Default to XAUUSD
    lotSize: "",
    outcome: "Win",
    notes: "",
  });

  // Calculate suggested lot size based on current equity and risk
  const calculateSuggestedLotSize = useMemo(() => {
    let currentEquity = settings.accountBalance;
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      if (lastTrade && lastTrade.equityAfter) {
        const parsed = Number(lastTrade.equityAfter);
        if (!isNaN(parsed) && isFinite(parsed)) {
          currentEquity = parsed;
        }
      }
    }

    const riskDollars = (currentEquity * settings.riskPercent) / 100;
    // Lot size calculation: Risk $ / (SL pips × pip value per lot)
    // Formula: Lot size = Risk $ / (SL pips × 100)
    // Using: 1 lot = $100 per pip (0.01 lot = $1 per pip)
    // Example: $10,000 account, 0.25% risk = $25 risk
    //          If SL is 25 pips: $25 / (25 × 100) = 0.01 lot
    //          This gives: 0.01 lot × 25 pips × $100 = $25 loss ✓
    const suggestedLotSize =
      settings.stopLossPips > 0
        ? (riskDollars / (settings.stopLossPips * 100)).toFixed(2)
        : "0.00";

    return {
      lotSize: suggestedLotSize,
      riskDollars: riskDollars.toFixed(2),
      currentEquity: currentEquity.toFixed(2),
    };
  }, [
    trades,
    settings.riskPercent,
    settings.stopLossPips,
    settings.accountBalance,
  ]);

  // Auto-fill lot size when form opens or risk changes
  useEffect(() => {
    if (showAddTradeForm) {
      setNewTrade((prev) => ({
        ...prev,
        lotSize: calculateSuggestedLotSize.lotSize,
      }));
    }
  }, [
    showAddTradeForm,
    calculateSuggestedLotSize.lotSize,
    settings.riskPercent,
    settings.stopLossPips,
  ]);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      const savedTrades = localStorage.getItem(STORAGE_KEYS.TRADES);

      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          // Validate settings structure
          if (parsed && typeof parsed === "object") {
            setSettings(parsed);
          }
        } catch (e) {
          console.error("Failed to load settings:", e);
          // Clear corrupted data
          localStorage.removeItem(STORAGE_KEYS.SETTINGS);
        }
      }

      if (savedTrades) {
        try {
          const parsed = JSON.parse(savedTrades);
          // Validate trades structure
          if (Array.isArray(parsed)) {
            setTrades(parsed);
          }
        } catch (e) {
          console.error("Failed to load trades:", e);
          // Clear corrupted data
          localStorage.removeItem(STORAGE_KEYS.TRADES);
        }
      }
    } catch (error) {
      console.error("Error accessing localStorage:", error);
    }
  }, []);

  // Save settings to localStorage with error handling
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
      // Handle quota exceeded error
      if (error.name === "QuotaExceededError") {
        alert("Storage quota exceeded. Please clear some data.");
      }
    }
  }, [settings]);

  // Save trades to localStorage with error handling
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(trades));
    } catch (error) {
      console.error("Error saving trades to localStorage:", error);
      // Handle quota exceeded error
      if (error.name === "QuotaExceededError") {
        alert("Storage quota exceeded. Please clear some data.");
      }
    }
  }, [trades]);

  // Calculate equity curve
  const equityCurve = useMemo(() => {
    try {
      const challengeType = settings.challengeType || "two-step";
      let currentEquity = challengeType === "zero-step"
        ? (Number(settings.masterAccountBalance) || settings.accountBalance)
        : Number(settings.accountBalance) || 0;
      const curve = [{ trade: 0, equity: currentEquity }];

      trades.forEach((trade, index) => {
        if (trade && trade.equityAfter) {
          const parsed = Number(trade.equityAfter);
          if (!isNaN(parsed) && isFinite(parsed)) {
            currentEquity = parsed;
          }
        }
        curve.push({ trade: index + 1, equity: currentEquity });
      });

      return curve;
    } catch (error) {
      console.error("Error calculating equity curve:", error);
      const challengeType = settings.challengeType || "two-step";
      const initialEquity = challengeType === "zero-step"
        ? (Number(settings.masterAccountBalance) || settings.accountBalance)
        : settings.accountBalance;
      return [{ trade: 0, equity: initialEquity || 0 }];
    }
  }, [trades, settings.accountBalance, settings.masterAccountBalance, settings.challengeType]);

  // Helper function to get starting balance based on challenge type and phase
  const getStartingBalance = (settings, currentEquity) => {
    const challengeType = settings.challengeType || "two-step";
    
    // For zero-step (direct master), always use masterAccountBalance
    if (challengeType === "zero-step") {
      return Number(settings.masterAccountBalance) || 0;
    }
    
    // For other challenge types, determine if we're in Master phase
    const initialBalance = settings.accountBalance;
    let phase1Target = 0;
    let phase2Target = 0;
    
    if (challengeType === "two-step") {
      phase1Target = initialBalance * (1 + settings.phase1Target / 100);
      phase2Target = phase1Target * (1 + settings.phase2Target / 100);
      if (currentEquity >= phase2Target) {
        // In Master phase, use masterAccountBalance
        return Number(settings.masterAccountBalance) || initialBalance;
      }
    } else if (challengeType === "one-step") {
      phase1Target = initialBalance * (1 + settings.phase1Target / 100);
      if (currentEquity >= phase1Target) {
        // In Master phase, use masterAccountBalance
        return Number(settings.masterAccountBalance) || initialBalance;
      }
    }
    
    // Not in Master phase, use challenge account balance
    return initialBalance;
  };

  // Calculate dashboard metrics
  const metrics = useMemo(() => {
    try {
      const totalTrades = trades.length;
      const wins = trades.filter((t) => t && t.outcome === "Win").length;
      const losses = trades.filter((t) => t && t.outcome === "Loss").length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

      let currentEquity = settings.accountBalance;
      if (trades.length > 0) {
        const lastTrade = trades[trades.length - 1];
        if (lastTrade && lastTrade.equityAfter) {
          const parsed = Number(lastTrade.equityAfter);
          if (!isNaN(parsed) && isFinite(parsed)) {
            currentEquity = parsed;
          }
        }
      }

      // Calculate expectancy
      const winTrades = trades.filter((t) => t.outcome === "Win");
      const lossTrades = trades.filter((t) => t.outcome === "Loss");

      const avgWinPips =
        winTrades.length > 0
          ? winTrades.reduce(
              (sum, t) =>
                sum + (Number(t.takeProfitPips) || settings.takeProfitPips),
              0
            ) / winTrades.length
          : settings.takeProfitPips;

      const avgLossPips =
        lossTrades.length > 0
          ? lossTrades.reduce(
              (sum, t) =>
                sum + (Number(t.stopLossPips) || settings.stopLossPips),
              0
            ) / lossTrades.length
          : settings.stopLossPips;

      const winPercent = winRate / 100;
      const lossPercent = 1 - winPercent;
      const expectancy = winPercent * avgWinPips - lossPercent * avgLossPips;

      // Strategy grade
      let strategyGrade = "C";
      if (expectancy > 1) {
        strategyGrade = "A";
      } else if (expectancy >= 0) {
        strategyGrade = "B";
      }

      // Suggested lot size: Based on capital, risk %, and stop loss
      // Formula: Lot size = Risk $ / (Stop Loss Pips × pip value per lot)
      // Using: 1 lot = $100 per pip (0.01 lot = $1 per pip)
      // Example: $25 risk, 25 pips SL = $25 / (25 × 100) = 0.01 lot
      // Risk $ = Equity × Risk %
      const riskDollars = (currentEquity * settings.riskPercent) / 100;
      const suggestedLotSize =
        settings.stopLossPips > 0
          ? (riskDollars / (settings.stopLossPips * 100)).toFixed(2)
          : "0.00";

      // Phase progress and detection based on challenge type
      // For zero-step, use masterAccountBalance as initial balance
      const challengeType = settings.challengeType || "two-step";
      const initialBalance = challengeType === "zero-step" 
        ? (Number(settings.masterAccountBalance) || settings.accountBalance)
        : settings.accountBalance;

      let phase1Target = 0;
      let phase2Target = 0;
      let currentPhase = "Phase1";
      let phaseProgress = 0;
      let phaseTarget = initialBalance;
      let phase1Progress = 0;
      let phase2Progress = 0;

      if (challengeType === "two-step") {
        phase1Target = initialBalance * (1 + settings.phase1Target / 100);
        phase2Target = phase1Target * (1 + settings.phase2Target / 100);

        if (currentEquity >= phase2Target) {
          currentPhase = "Master";
          phaseProgress = 100;
          phaseTarget = phase2Target;
        } else if (currentEquity >= phase1Target) {
          currentPhase = "Phase2";
          phaseProgress = Math.min(
            ((currentEquity - phase1Target) / (phase2Target - phase1Target)) *
              100,
            100
          );
          phaseTarget = phase2Target;
        } else {
          currentPhase = "Phase1";
          phaseProgress =
            currentEquity >= initialBalance
              ? Math.min(
                  ((currentEquity - initialBalance) /
                    (phase1Target - initialBalance)) *
                    100,
                  100
                )
              : 0;
          phaseTarget = phase1Target;
        }

        phase1Progress =
          currentEquity >= initialBalance
            ? Math.min(
                ((currentEquity - initialBalance) /
                  (phase1Target - initialBalance)) *
                  100,
                100
              )
            : 0;

        phase2Progress =
          currentEquity >= phase1Target
            ? Math.min(
                ((currentEquity - phase1Target) /
                  (phase2Target - phase1Target)) *
                  100,
                100
              )
            : 0;
      } else if (challengeType === "one-step") {
        phase1Target = initialBalance * (1 + settings.phase1Target / 100);

        if (currentEquity >= phase1Target) {
          currentPhase = "Master";
          phaseProgress = 100;
          phaseTarget = phase1Target;
        } else {
          currentPhase = "Phase1";
          phaseProgress =
            currentEquity >= initialBalance
              ? Math.min(
                  ((currentEquity - initialBalance) /
                    (phase1Target - initialBalance)) *
                    100,
                  100
                )
              : 0;
          phaseTarget = phase1Target;
        }

        phase1Progress = phaseProgress;
        phase2Progress = 0;
      } else {
        // zero-step
        currentPhase = "Master";
        phaseProgress = 100;
        phaseTarget = initialBalance;
        phase1Progress = 0;
        phase2Progress = 0;
      }

      // Daily drawdown check
      let dailyDrawdown = 0;
      let drawdownWarning = false;

      try {
        const today = new Date().toDateString();
        const todayTrades = trades.filter((t) => {
          if (!t || !t.date) return false;
          try {
            const tradeDate = new Date(t.date).toDateString();
            return tradeDate === today;
          } catch {
            return false;
          }
        });

        let highestEquityToday = currentEquity;
        let currentEquityToday = currentEquity;

        // Calculate drawdown from today's trades
        if (todayTrades.length > 0) {
          const beforeTodayTrades = trades.filter((t) => {
            if (!t || !t.date) return false;
            try {
              const tradeDate = new Date(t.date).toDateString();
              return tradeDate !== today;
            } catch {
              return false;
            }
          });

          if (beforeTodayTrades.length > 0) {
            const lastBeforeTrade =
              beforeTodayTrades[beforeTodayTrades.length - 1];
            if (lastBeforeTrade && lastBeforeTrade.equityAfter) {
              const parsed = Number(lastBeforeTrade.equityAfter);
              if (!isNaN(parsed) && isFinite(parsed)) {
                highestEquityToday = parsed;
              }
            }
          }

          todayTrades.forEach((trade) => {
            if (!trade) return;
            if (trade.outcome === "Win") {
              const reward = Number(trade.rewardDollars) || 0;
              currentEquityToday += reward;
            } else {
              const risk = Number(trade.riskDollars) || 0;
              currentEquityToday -= risk;
            }
          });

          if (
            highestEquityToday > 0 &&
            isFinite(highestEquityToday) &&
            isFinite(currentEquityToday)
          ) {
            dailyDrawdown =
              ((highestEquityToday - currentEquityToday) / highestEquityToday) *
              100;
            if (isNaN(dailyDrawdown) || !isFinite(dailyDrawdown)) {
              dailyDrawdown = 0;
            }
          }
        }

        drawdownWarning = dailyDrawdown >= (settings.dailyDrawdownLimit || 0);
      } catch (error) {
        console.error("Error calculating drawdown:", error);
      }

      // Calculate monthly target progress for master account
      let monthlyTargetProgress = 0;
      let monthlyTargetAmount = 0;
      let monthlyStartingBalance = 0;
      
      if (currentPhase === "Master" || challengeType === "zero-step") {
        monthlyTargetAmount = Number(settings.monthlyTarget) || 0;
        if (monthlyTargetAmount > 0) {
          // Find the starting balance for the current month
          const now = new Date();
          const currentMonth = now.getMonth();
          const currentYear = now.getFullYear();
          
          // Find the first trade of the current month or the master account balance
          const currentMonthTrades = trades.filter((t) => {
            if (!t || !t.date) return false;
            try {
              const tradeDate = new Date(t.date);
              return tradeDate.getMonth() === currentMonth && 
                     tradeDate.getFullYear() === currentYear &&
                     (t.isMasterPhase || challengeType === "zero-step");
            } catch {
              return false;
            }
          });
          
          if (currentMonthTrades.length > 0) {
            // Find the balance before the first trade of this month
            const firstMonthTradeIndex = trades.findIndex((t) => {
              if (!t || !t.date) return false;
              try {
                const tradeDate = new Date(t.date);
                return tradeDate.getMonth() === currentMonth && 
                       tradeDate.getFullYear() === currentYear &&
                       (t.isMasterPhase || challengeType === "zero-step");
              } catch {
                return false;
              }
            });
            
            if (firstMonthTradeIndex > 0) {
              const prevTrade = trades[firstMonthTradeIndex - 1];
              if (prevTrade && prevTrade.equityAfter) {
                monthlyStartingBalance = Number(prevTrade.equityAfter) || Number(settings.masterAccountBalance);
              } else {
                monthlyStartingBalance = Number(settings.masterAccountBalance);
              }
            } else {
              monthlyStartingBalance = Number(settings.masterAccountBalance);
            }
          } else {
            // No trades this month, use master account balance
            monthlyStartingBalance = Number(settings.masterAccountBalance);
          }
          
          // Calculate progress: (current equity - starting balance) / monthly target * 100
          const progressAmount = currentEquity - monthlyStartingBalance;
          monthlyTargetProgress = monthlyTargetAmount > 0
            ? Math.min((progressAmount / monthlyTargetAmount) * 100, 100)
            : 0;
        }
      }

      return {
        totalTrades,
        wins,
        losses,
        winRate: winRate.toFixed(2),
        currentEquity: currentEquity.toFixed(2),
        expectancy: expectancy.toFixed(2),
        strategyGrade,
        suggestedLotSize,
        phase1Progress: Math.max(0, phase1Progress),
        phase2Progress: Math.max(0, phase2Progress),
        currentPhase,
        phaseProgress: Math.max(0, phaseProgress),
        phaseTarget: phaseTarget.toFixed(2),
        phase1Target: phase1Target.toFixed(2),
        phase2Target: phase2Target.toFixed(2),
        drawdownWarning,
        dailyDrawdown: dailyDrawdown.toFixed(2),
        monthlyTargetProgress: monthlyTargetProgress.toFixed(2),
        monthlyTargetAmount: monthlyTargetAmount.toFixed(2),
        monthlyStartingBalance: monthlyStartingBalance.toFixed(2),
      };
    } catch (error) {
      console.error("Error calculating metrics:", error);
      return {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: "0.00",
        currentEquity: String(settings.accountBalance || 0),
        expectancy: "0.00",
        strategyGrade: "C",
        suggestedLotSize: "0.00",
        phase1Progress: 0,
        phase2Progress: 0,
        currentPhase: "Phase1",
        phaseProgress: 0,
        phaseTarget: "0.00",
        phase1Target: "0.00",
        phase2Target: "0.00",
        drawdownWarning: false,
        dailyDrawdown: "0.00",
      };
    }
  }, [trades, settings]);

  // Recalculate all trades
  const recalculateAllTrades = (newSettings) => {
    try {
      setTrades((prev) => {
        if (prev.length === 0) return prev;
        
        const challengeType = newSettings.challengeType || "two-step";
        let runningEquity = challengeType === "zero-step"
          ? (Number(newSettings.masterAccountBalance) || newSettings.accountBalance)
          : Number(newSettings.accountBalance) || 0;
        
        const initialBalance = newSettings.accountBalance;
        const phase1Target = initialBalance * (1 + newSettings.phase1Target / 100);
        const phase2Target = phase1Target * (1 + newSettings.phase2Target / 100);
        let inMasterPhase = challengeType === "zero-step";
        
        return prev.map((trade) => {
          if (!trade) return trade;

          // Check if we should transition to master phase
          if (!inMasterPhase && challengeType !== "zero-step") {
            if (challengeType === "two-step" && runningEquity >= phase2Target) {
              inMasterPhase = true;
              runningEquity = Number(newSettings.masterAccountBalance) || runningEquity;
            } else if (challengeType === "one-step" && runningEquity >= phase1Target) {
              inMasterPhase = true;
              runningEquity = Number(newSettings.masterAccountBalance) || runningEquity;
            }
          }

          const lotSize = Number(trade.lotSize) || 0;
          const riskPercent = Number(newSettings.riskPercent) || 0;
          const takeProfitPips = Number(newSettings.takeProfitPips) || 0;

          const riskDollars = (runningEquity * riskPercent) / 100;
          // Reward calculation: Lot size × TP pips × pip value per lot
          // Using same pip value: 1 lot = $100 per pip (0.01 lot = $1 per pip)
          const rewardDollars =
            lotSize > 0 && takeProfitPips > 0
              ? lotSize * takeProfitPips * 100
              : 0;

          const result = trade.outcome === "Win" ? rewardDollars : -riskDollars;
          runningEquity = runningEquity + result;

          // Ensure runningEquity is valid
          if (isNaN(runningEquity) || !isFinite(runningEquity)) {
            runningEquity = inMasterPhase 
              ? (Number(newSettings.masterAccountBalance) || newSettings.accountBalance)
              : (newSettings.accountBalance || 0);
          }

          return {
            ...trade,
            riskDollars: riskDollars.toFixed(2),
            rewardDollars: rewardDollars.toFixed(2),
            resultDollars: result.toFixed(2),
            equityAfter: runningEquity.toFixed(2),
            isMasterPhase: inMasterPhase,
          };
        });
      });
    } catch (error) {
      console.error("Error recalculating trades:", error);
    }
  };

  // Handle challenge account size change (auto-sets master account)
  const handleChallengeAccountChange = (accountSize) => {
    const newSettings = {
      ...settings,
      accountBalance: accountSize,
      masterAccountBalance: accountSize,
    };
    setSettings(newSettings);
    recalculateAllTrades(newSettings);
  };

  // Handle risk preset change
  const handleRiskPreset = (preset) => {
    const riskValue = RISK_PRESETS[preset];
    const newSettings = {
      ...settings,
      riskPercent: riskValue,
      riskPreset: preset,
    };
    setSettings(newSettings);
    recalculateAllTrades(newSettings);
  };

  // Handle challenge type change
  const handleChallengeTypeChange = (type) => {
    let phase1Target = 8;
    let phase2Target = 5;

    if (type === "two-step") {
      phase1Target = 8; // Default, user can change to 10%
      phase2Target = 5;
    } else if (type === "one-step") {
      phase1Target = 10; // One-step only has 10% target in FundingPips
      phase2Target = 0;
    } else {
      // zero-step
      phase1Target = 0;
      phase2Target = 0;
    }

    const newSettings = {
      ...settings,
      challengeType: type,
      phase1Target,
      phase2Target,
    };
    setSettings(newSettings);
  };

  // Detect which preset matches the current risk value
  const detectRiskPreset = (riskValue) => {
    const risk = Number(riskValue);
    if (Math.abs(risk - RISK_PRESETS.safe) < 0.001) return "safe";
    if (Math.abs(risk - RISK_PRESETS.balanced) < 0.001) return "balanced";
    if (Math.abs(risk - RISK_PRESETS.aggressive) < 0.001) return "aggressive";
    return "custom";
  };

  // Handle settings change with validation
  const handleSettingChange = (key, value) => {
    // Handle empty string - don't update, just return
    if (value === "" || value === null || value === undefined) {
      return;
    }

    // Clean the value (remove leading zeros)
    let cleanedValue = String(value).trim();
    
    // Remove leading zeros except for decimals (0.5, 0.25, etc.)
    if (cleanedValue.length > 1 && cleanedValue[0] === "0" && cleanedValue[1] !== ".") {
      cleanedValue = cleanedValue.replace(/^0+/, "");
      if (cleanedValue === "") cleanedValue = "0";
    }

    const numValue = Number(cleanedValue);
    
    // Validate number
    if (isNaN(numValue) || !isFinite(numValue) || numValue < 0) {
      return;
    }

    // Add reasonable limits for security and data integrity
    const limits = {
      accountBalance: { min: 1, max: 10000000 },
      masterAccountBalance: { min: 1, max: 10000000 },
      riskPercent: { min: 0.01, max: 10 },
      stopLossPips: { min: 1, max: 10000 },
      takeProfitPips: { min: 1, max: 10000 },
      phase1Target: { min: 0, max: 100 },
      phase2Target: { min: 0, max: 100 },
      dailyDrawdownLimit: { min: 0, max: 100 },
      monthlyTarget: { min: 0, max: 10000000 },
    };

    if (limits[key]) {
      const { min, max } = limits[key];
      if (numValue < min || numValue > max) {
        return; // Silently reject out-of-range values
      }
    }

    if (key === "riskPercent") {
      // Automatically detect if it matches a preset or is custom
      const detectedPreset = detectRiskPreset(numValue);
      const newSettings = {
        ...settings,
        [key]: numValue,
        riskPreset: detectedPreset,
      };
      setSettings(newSettings);
      recalculateAllTrades(newSettings);
    } else {
      const newSettings = { ...settings, [key]: numValue };
      setSettings(newSettings);

      // Recalculate trades if calculation-related settings changed
      if (
        [
          "riskPercent",
          "takeProfitPips",
          "stopLossPips",
          "accountBalance",
        ].includes(key)
      ) {
        recalculateAllTrades(newSettings);
      }
    }
  };

  // Validate trade before adding
  const validateTrade = (trade) => {
    return (
      trade.entry &&
      trade.entry.trim() !== "" &&
      trade.lotSize &&
      Number(trade.lotSize) > 0 &&
      trade.date &&
      trade.date.trim() !== ""
    );
  };

  // Add new trade with validation
  const handleAddTrade = () => {
    if (!validateTrade(newTrade)) {
      alert("Please fill in Entry, Lot Size, and Date before adding a trade.");
      return;
    }

    // Calculate current equity before this trade
    let runningEquity = settings.accountBalance;
    const challengeType = settings.challengeType || "two-step";
    
    // For zero-step (direct master), start with masterAccountBalance
    if (challengeType === "zero-step") {
      runningEquity = Number(settings.masterAccountBalance) || settings.accountBalance;
    }
    
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      if (lastTrade && lastTrade.equityAfter) {
        const parsed = Number(lastTrade.equityAfter);
        if (!isNaN(parsed) && isFinite(parsed)) {
          runningEquity = parsed;
        }
      }
    } else {
      // First trade - check if we should use master account
      if (challengeType === "zero-step") {
        runningEquity = Number(settings.masterAccountBalance) || settings.accountBalance;
      }
    }
    
    // Check if we're in Master phase (for non-zero-step challenges)
    if (challengeType !== "zero-step" && trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      if (lastTrade && lastTrade.isMasterPhase) {
        // Already in master phase, continue using master account balance
        // runningEquity is already set from last trade
      } else {
        // Check if this trade will transition us to Master phase
        const initialBalance = settings.accountBalance;
        let phase1Target = 0;
        let phase2Target = 0;
        
        if (challengeType === "two-step") {
          phase1Target = initialBalance * (1 + settings.phase1Target / 100);
          phase2Target = phase1Target * (1 + settings.phase2Target / 100);
          if (runningEquity >= phase2Target) {
            // Transitioning to Master, use masterAccountBalance
            runningEquity = Number(settings.masterAccountBalance) || runningEquity;
          }
        } else if (challengeType === "one-step") {
          phase1Target = initialBalance * (1 + settings.phase1Target / 100);
          if (runningEquity >= phase1Target) {
            // Transitioning to Master, use masterAccountBalance
            runningEquity = Number(settings.masterAccountBalance) || runningEquity;
          }
        }
      }
    }

    const lotSize = Number(newTrade.lotSize) || 0;
    const riskDollars = (runningEquity * settings.riskPercent) / 100;
    // Reward calculation: Lot size × TP pips × pip value per lot
    // Using same pip value: 1 lot = $100 per pip (0.01 lot = $1 per pip)
    const rewardDollars =
      lotSize > 0 && settings.takeProfitPips > 0
        ? lotSize * settings.takeProfitPips * 100
        : 0;

    const result = newTrade.outcome === "Win" ? rewardDollars : -riskDollars;
    const equityAfter = runningEquity + result;
    
    // Determine if this trade is in Master phase
    const isMasterPhase = challengeType === "zero-step" || 
      (challengeType === "two-step" && equityAfter >= settings.accountBalance * (1 + settings.phase1Target / 100) * (1 + settings.phase2Target / 100)) ||
      (challengeType === "one-step" && equityAfter >= settings.accountBalance * (1 + settings.phase1Target / 100));

    const tradeToAdd = {
      id: Date.now(),
      date: newTrade.date,
      session: newTrade.session || "London",
      entry: newTrade.entry.trim(),
      lotSize: newTrade.lotSize,
      outcome: newTrade.outcome,
      notes: newTrade.notes || "",
      riskDollars: riskDollars.toFixed(2),
      rewardDollars: rewardDollars.toFixed(2),
      resultDollars: result.toFixed(2),
      equityAfter: equityAfter.toFixed(2),
      isMasterPhase: isMasterPhase,
    };

    setTrades((prev) => [...prev, tradeToAdd]);
    
    // Update master account balance if in master phase
    if (isMasterPhase && challengeType !== "zero-step") {
      // Update master account balance to reflect the new equity
      setSettings((prev) => ({
        ...prev,
        masterAccountBalance: Number(equityAfter),
      }));
    } else if (challengeType === "zero-step") {
      // For zero-step, always update master account balance
      setSettings((prev) => ({
        ...prev,
        masterAccountBalance: Number(equityAfter),
      }));
    }

    // Reset form
    setNewTrade({
      date: new Date().toISOString().split("T")[0],
      session: "London",
      entry: "XAUUSD", // Default to XAUUSD
      lotSize: "",
      outcome: "Win",
      notes: "",
    });
    setShowAddTradeForm(false);
  };

  // Update trade
  const updateTrade = (id, field, value) => {
    try {
      setTrades((prev) => {
        const tradeIndex = prev.findIndex((t) => t.id === id);
        if (tradeIndex === -1) return prev;

        // Update the specific trade field
        const updatedTrades = [...prev];
        updatedTrades[tradeIndex] = {
          ...updatedTrades[tradeIndex],
          [field]: value,
        };

        // Don't recalculate for entry or notes fields (they don't affect calculations)
        if (field === "entry" || field === "notes") {
          return updatedTrades;
        }

        // Recalculate all trades from the updated one onwards
        const challengeType = settings.challengeType || "two-step";
        let runningEquity = challengeType === "zero-step"
          ? (Number(settings.masterAccountBalance) || settings.accountBalance)
          : settings.accountBalance;
        
        if (tradeIndex > 0) {
          const prevTrade = updatedTrades[tradeIndex - 1];
          if (prevTrade?.equityAfter) {
            const parsed = Number(prevTrade.equityAfter);
            runningEquity = isNaN(parsed) ? runningEquity : parsed;
          }
          
          // Check if previous trade was in master phase
          if (prevTrade?.isMasterPhase && challengeType !== "zero-step") {
            runningEquity = Number(settings.masterAccountBalance) || runningEquity;
          }
        }
        
        // Check if we should be in master phase
        let inMasterPhase = challengeType === "zero-step" || 
          (tradeIndex > 0 && updatedTrades[tradeIndex - 1]?.isMasterPhase);
        
        if (!inMasterPhase && challengeType !== "zero-step") {
          const initialBalance = settings.accountBalance;
          const phase1Target = initialBalance * (1 + settings.phase1Target / 100);
          const phase2Target = phase1Target * (1 + settings.phase2Target / 100);
          
          if (challengeType === "two-step" && runningEquity >= phase2Target) {
            inMasterPhase = true;
            runningEquity = Number(settings.masterAccountBalance) || runningEquity;
          } else if (challengeType === "one-step" && runningEquity >= phase1Target) {
            inMasterPhase = true;
            runningEquity = Number(settings.masterAccountBalance) || runningEquity;
          }
        }

        for (let i = tradeIndex; i < updatedTrades.length; i++) {
          const trade = updatedTrades[i];
          if (!trade) continue;

          const lotSize = Number(trade.lotSize) || 0;
          const riskPercent = Number(settings.riskPercent) || 0;
          const takeProfitPips = Number(settings.takeProfitPips) || 0;

          const riskDollars = (runningEquity * riskPercent) / 100;
          // Reward calculation: Lot size × TP pips × pip value per lot
          // Using same pip value: 1 lot = $100 per pip (0.01 lot = $1 per pip)
          const rewardDollars =
            lotSize > 0 && takeProfitPips > 0
              ? lotSize * takeProfitPips * 100
              : 0;

          const result = trade.outcome === "Win" ? rewardDollars : -riskDollars;
          runningEquity = runningEquity + result;

          // Ensure runningEquity is a valid number
          if (isNaN(runningEquity) || !isFinite(runningEquity)) {
            runningEquity = settings.accountBalance;
          }

          // Check if this trade transitions to master phase
          if (!inMasterPhase && challengeType !== "zero-step") {
            const initialBalance = settings.accountBalance;
            const phase1Target = initialBalance * (1 + settings.phase1Target / 100);
            const phase2Target = phase1Target * (1 + settings.phase2Target / 100);
            
            if (challengeType === "two-step" && runningEquity >= phase2Target) {
              inMasterPhase = true;
              runningEquity = Number(settings.masterAccountBalance) || runningEquity;
            } else if (challengeType === "one-step" && runningEquity >= phase1Target) {
              inMasterPhase = true;
              runningEquity = Number(settings.masterAccountBalance) || runningEquity;
            }
          }
          
          updatedTrades[i] = {
            ...trade,
            riskDollars: riskDollars.toFixed(2),
            rewardDollars: rewardDollars.toFixed(2),
            resultDollars: result.toFixed(2),
            equityAfter: runningEquity.toFixed(2),
            isMasterPhase: inMasterPhase,
          };
        }
        
        // Update master account balance if in master phase
        const lastTrade = updatedTrades[updatedTrades.length - 1];
        if (lastTrade && (lastTrade.isMasterPhase || challengeType === "zero-step")) {
          const finalEquity = Number(lastTrade.equityAfter);
          if (!isNaN(finalEquity) && isFinite(finalEquity)) {
            setSettings((prev) => ({
              ...prev,
              masterAccountBalance: finalEquity,
            }));
          }
        }

        return updatedTrades;
      });
    } catch (error) {
      console.error("Error updating trade:", error);
    }
  };

  // Delete trade
  const deleteTrade = (id) => {
    try {
      setTrades((prev) => {
        const filtered = prev.filter((t) => t && t.id !== id);
        if (filtered.length === 0) {
          // If no trades left, reset master account balance for zero-step
          if (settings.challengeType === "zero-step") {
            setSettings((prev) => ({
              ...prev,
              masterAccountBalance: prev.accountBalance,
            }));
          }
          return filtered;
        }
        
        // Recalculate equity for remaining trades using recalculateAllTrades logic
        const challengeType = settings.challengeType || "two-step";
        let runningEquity = challengeType === "zero-step"
          ? (Number(settings.masterAccountBalance) || settings.accountBalance)
          : Number(settings.accountBalance) || 0;
        
        const initialBalance = settings.accountBalance;
        const phase1Target = initialBalance * (1 + settings.phase1Target / 100);
        const phase2Target = phase1Target * (1 + settings.phase2Target / 100);
        let inMasterPhase = challengeType === "zero-step";
        
        const recalculated = filtered.map((trade) => {
          if (!trade) return trade;

          // Check if we should transition to master phase
          if (!inMasterPhase && challengeType !== "zero-step") {
            if (challengeType === "two-step" && runningEquity >= phase2Target) {
              inMasterPhase = true;
              runningEquity = Number(settings.masterAccountBalance) || runningEquity;
            } else if (challengeType === "one-step" && runningEquity >= phase1Target) {
              inMasterPhase = true;
              runningEquity = Number(settings.masterAccountBalance) || runningEquity;
            }
          }

          const lotSize = Number(trade.lotSize) || 0;
          const riskPercent = Number(settings.riskPercent) || 0;
          const takeProfitPips = Number(settings.takeProfitPips) || 0;

          const riskDollars = (runningEquity * riskPercent) / 100;
          // Reward calculation: Lot size × TP pips × pip value per lot
          // Using same pip value: 1 lot = $100 per pip (0.01 lot = $1 per pip)
          const rewardDollars =
            lotSize > 0 && takeProfitPips > 0
              ? lotSize * takeProfitPips * 100
              : 0;

          const result = trade.outcome === "Win" ? rewardDollars : -riskDollars;
          runningEquity = runningEquity + result;

          // Ensure runningEquity is valid
          if (isNaN(runningEquity) || !isFinite(runningEquity)) {
            runningEquity = inMasterPhase 
              ? (Number(settings.masterAccountBalance) || settings.accountBalance)
              : (settings.accountBalance || 0);
          }

          return {
            ...trade,
            riskDollars: riskDollars.toFixed(2),
            rewardDollars: rewardDollars.toFixed(2),
            resultDollars: result.toFixed(2),
            equityAfter: runningEquity.toFixed(2),
            isMasterPhase: inMasterPhase,
          };
        });
        
        // Update master account balance if in master phase
        const lastTrade = recalculated[recalculated.length - 1];
        if (lastTrade && (lastTrade.isMasterPhase || challengeType === "zero-step")) {
          const finalEquity = Number(lastTrade.equityAfter);
          if (!isNaN(finalEquity) && isFinite(finalEquity)) {
            setSettings((prev) => ({
              ...prev,
              masterAccountBalance: finalEquity,
            }));
          }
        }
        
        return recalculated;
      });
    } catch (error) {
      console.error("Error deleting trade:", error);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Date",
      "Session",
      "Entry",
      "Lot Size",
      "Outcome",
      "Risk $",
      "Reward $",
      "Result $",
      "Equity After",
      "Notes",
    ];
    const rows = trades.map((trade) => [
      trade.date,
      trade.session,
      trade.entry,
      trade.lotSize,
      trade.outcome,
      trade.riskDollars,
      trade.rewardDollars,
      trade.resultDollars,
      trade.equityAfter,
      trade.notes,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `fundingpips-trades-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (Create New Excel File) - Matching XAUUSD_ULTIMATE_TRADING_JOURNAL.xlsx format
  const exportToExcel = () => {
    try {
      if (trades.length === 0) {
        alert("No trades to export. Please add trades first.");
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Prepare data with headers matching the provided Excel format
      const headers = [
        "Trade #",
        "Date",
        "Session",
        "Entry",
        "Lot Size",
        "Outcome",
        "Risk $",
        "Reward $",
        "Result $",
        "Equity After",
        "Notes",
      ];

      const data = [headers];
      
      // Add trade data with trade count - ensure all values are properly formatted
      trades.forEach((trade, index) => {
        if (!trade) return; // Skip null/undefined trades
        
        data.push([
          index + 1, // Trade count starting from 1
          String(trade.date || "").trim(),
          String(trade.session || "London").trim(),
          String(trade.entry || "").trim(),
          String(trade.lotSize || "").trim(),
          String(trade.outcome || "Win").trim(),
          String(trade.riskDollars || "0.00").trim(),
          String(trade.rewardDollars || "0.00").trim(),
          String(trade.resultDollars || "0.00").trim(),
          String(trade.equityAfter || "0.00").trim(),
          String(trade.notes || "").trim(),
        ]);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Set optimal column widths - reduced for Date/Entry/Lot Size, increased for Risk/Reward/Result
      ws["!cols"] = [
        { wch: 8 },  // Trade # - compact
        { wch: 11 }, // Date - reduced (fits YYYY-MM-DD)
        { wch: 10 }, // Session - compact
        { wch: 10 }, // Entry - reduced (fits trading pairs)
        { wch: 9 },  // Lot Size - reduced (fits 0.01 format)
        { wch: 10 }, // Outcome - compact
        { wch: 15 }, // Risk $ - increased
        { wch: 15 }, // Reward $ - increased
        { wch: 15 }, // Result $ - increased
        { wch: 15 }, // Equity After
        { wch: 40 }, // Notes - wider for longer notes
      ];

      // Freeze header row for better navigation
      ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

      // Add auto-filter to header row (11 columns now with Trade #)
      if (data.length > 1) {
        ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: headers.length - 1 } }) };
      }

      // Style header row - Note: XLSX browser version has limited styling support
      // But we'll set it up for Excel to apply when opened
      const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        
        // Set cell type and format
        ws[cellAddress].t = "s"; // String type
        // Note: Full styling requires xlsx-style library, but basic formatting will work
      }

      // Format number columns (Trade #, Risk $, Reward $, Result $, Equity After, Lot Size)
      if (data.length > 1) {
        for (let row = 1; row < data.length; row++) {
          // Trade # (column A, index 0) - format as number
          const tradeNumCell = XLSX.utils.encode_cell({ r: row, c: 0 });
          if (ws[tradeNumCell] && ws[tradeNumCell].v) {
            ws[tradeNumCell].t = "n"; // Number type
            ws[tradeNumCell].z = "0"; // Integer format
          }
          
          // Lot Size (column E, index 4) - format as number
          const lotCell = XLSX.utils.encode_cell({ r: row, c: 4 });
          if (ws[lotCell] && ws[lotCell].v) {
            const lotValue = Number(ws[lotCell].v);
            if (!isNaN(lotValue)) {
              ws[lotCell].v = lotValue;
              ws[lotCell].t = "n"; // Number type
              ws[lotCell].z = "0.00"; // 2 decimal places
            }
          }
          
          // Risk $ (column G, index 6) - increased width
          const riskCell = XLSX.utils.encode_cell({ r: row, c: 6 });
          if (ws[riskCell] && ws[riskCell].v) {
            const numValue = Number(ws[riskCell].v);
            if (!isNaN(numValue) && isFinite(numValue)) {
              ws[riskCell].v = numValue;
              ws[riskCell].t = "n";
              ws[riskCell].z = "#,##0.00";
            }
          }
          
          // Reward $ (column H, index 7) - increased width
          const rewardCell = XLSX.utils.encode_cell({ r: row, c: 7 });
          if (ws[rewardCell] && ws[rewardCell].v) {
            const numValue = Number(ws[rewardCell].v);
            if (!isNaN(numValue) && isFinite(numValue)) {
              ws[rewardCell].v = numValue;
              ws[rewardCell].t = "n";
              ws[rewardCell].z = "#,##0.00";
            }
          }
          
          // Result $ (column I, index 8) - increased width
          const resultCell = XLSX.utils.encode_cell({ r: row, c: 8 });
          if (ws[resultCell] && ws[resultCell].v) {
            const numValue = Number(ws[resultCell].v);
            if (!isNaN(numValue) && isFinite(numValue)) {
              ws[resultCell].v = numValue;
              ws[resultCell].t = "n";
              ws[resultCell].z = "#,##0.00";
            }
          }
          
          // Equity After (column J, index 9)
          const equityCell = XLSX.utils.encode_cell({ r: row, c: 9 });
          if (ws[equityCell] && ws[equityCell].v) {
            const numValue = Number(ws[equityCell].v);
            if (!isNaN(numValue) && isFinite(numValue)) {
              ws[equityCell].v = numValue;
              ws[equityCell].t = "n";
              ws[equityCell].z = "#,##0.00";
            }
          }
        }
      }

      // Add worksheet to workbook with exact sheet name
      XLSX.utils.book_append_sheet(wb, ws, "Trading Journal");

      // Use exact filename format: XAUUSD_ULTIMATE_TRADING_JOURNAL.xlsx
      const filename = "XAUUSD_ULTIMATE_TRADING_JOURNAL.xlsx";

      // Write file
      XLSX.writeFile(wb, filename);
      alert(`Excel file "${filename}" created successfully with ${trades.length} trade(s)!`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Error creating Excel file. Please try again.");
    }
  };

  // Upload to Existing Excel (Append with duplicate checking) - FIXED & OPTIMIZED
  const uploadToExistingExcel = () => {
    if (trades.length === 0) {
      alert("No trades to upload. Please add trades first.");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // File size limit: 10MB
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        alert("File size exceeds 10MB limit. Please use a smaller file.");
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        alert("Error reading file. Please try again.");
      };
      
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            alert("Invalid Excel file. No sheets found.");
            return;
          }

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          if (!worksheet) {
            alert("Invalid Excel file. Sheet is empty.");
            return;
          }

          // Convert to array of arrays
          const existingData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          });

          if (!existingData || existingData.length < 1) {
            alert("The Excel file appears to be empty.");
            return;
          }

          // Get headers (first row) - normalize to lowercase for comparison
          const rawHeaders = existingData[0] || [];
          const headers = rawHeaders.map((h) => String(h || "").trim().toLowerCase());

          // Check if Trade # column exists
          const tradeNumIdx = headers.findIndex((h) =>
            (h.includes("trade") && (h.includes("#") || h.includes("num") || h.includes("count"))) || h === "trade #"
          );
          const hasTradeNum = tradeNumIdx !== -1;

          // Find column indices (handle both with and without Trade #)
          const dateIdx = headers.findIndex((h) => h.includes("date") && !h.includes("trade"));
          const entryIdx = headers.findIndex((h) => h.includes("entry"));
          const lotSizeIdx = headers.findIndex((h) => (h.includes("lot") || h.includes("size")) && !h.includes("trade"));
          const sessionIdx = headers.findIndex((h) => h.includes("session"));
          const outcomeIdx = headers.findIndex((h) => h.includes("outcome"));
          const notesIdx = headers.findIndex((h) => h.includes("note"));

          if (dateIdx === -1 || entryIdx === -1) {
            alert(
              "Excel file must contain 'Date' and 'Entry' columns. Please check the file format.\n\nFound columns: " + rawHeaders.join(", ")
            );
            return;
          }

          // Extract existing trades for duplicate checking (skip header row)
          const existingTradesMap = new Map(); // Use Map for faster lookup
          for (let i = 1; i < existingData.length; i++) {
            const row = existingData[i];
            if (!row || !Array.isArray(row) || row.length === 0) continue;

            const date = String(row[dateIdx] || "").trim();
            const entry = String(row[entryIdx] || "").trim();
            const lotSize = String(row[lotSizeIdx] || "").trim();

            // Create unique key for duplicate checking
            if (date && entry) {
              const key = `${date}|${entry}|${lotSize}`;
              existingTradesMap.set(key, true);
            }
          }

          // If Trade # column doesn't exist, add it to the header and existing rows
          if (!hasTradeNum) {
            existingData[0].unshift("Trade #");
            // Shift all existing data rows to accommodate new column
            for (let i = 1; i < existingData.length; i++) {
              if (existingData[i] && Array.isArray(existingData[i])) {
                existingData[i].unshift(i); // Add trade number
              }
            }
          } else {
            // Trade # exists, but we need to ensure all rows have it
            // Re-number existing trades if needed
            for (let i = 1; i < existingData.length; i++) {
              if (existingData[i] && Array.isArray(existingData[i])) {
                if (existingData[i][tradeNumIdx] === undefined || existingData[i][tradeNumIdx] === "") {
                  existingData[i][tradeNumIdx] = i;
                }
              }
            }
          }

          // Check for duplicates and prepare new trades to add
          const newTradesToAdd = [];
          trades.forEach((trade) => {
            if (!trade || !trade.date || !trade.entry) return;

            const date = String(trade.date).trim();
            const entry = String(trade.entry).trim();
            const lotSize = String(trade.lotSize || "").trim();
            
            // Create unique key for duplicate checking
            const key = `${date}|${entry}|${lotSize}`;
            
            if (!existingTradesMap.has(key)) {
              newTradesToAdd.push(trade);
              // Add to map to prevent duplicates within new trades
              existingTradesMap.set(key, true);
            }
          });

          if (newTradesToAdd.length === 0) {
            alert("No new trades to add. All trades already exist in the Excel file.");
            return;
          }

          // Calculate starting trade number
          const existingTradeCount = existingData.length - 1; // Subtract header row

          // Add new trades to existing data
          newTradesToAdd.forEach((trade, index) => {
            const tradeNum = existingTradeCount + index + 1;
            
            // Ensure all values are properly formatted
            const newRow = [
              tradeNum,
              String(trade.date || "").trim(),
              String(trade.session || "London").trim(),
              String(trade.entry || "").trim(),
              String(trade.lotSize || "").trim(),
              String(trade.outcome || "Win").trim(),
              String(trade.riskDollars || "0.00").trim(),
              String(trade.rewardDollars || "0.00").trim(),
              String(trade.resultDollars || "0.00").trim(),
              String(trade.equityAfter || "0.00").trim(),
              String(trade.notes || "").trim(),
            ];
            
            existingData.push(newRow);
          });

          // Create new workbook with updated data
          const newWb = XLSX.utils.book_new();
          const newWs = XLSX.utils.aoa_to_sheet(existingData);

          // Set optimal column widths matching the export format
          newWs["!cols"] = [
            { wch: 8 },  // Trade # - compact
            { wch: 11 }, // Date - reduced
            { wch: 10 }, // Session - compact
            { wch: 10 }, // Entry - reduced
            { wch: 9 },  // Lot Size - reduced
            { wch: 10 }, // Outcome - compact
            { wch: 15 }, // Risk $ - increased
            { wch: 15 }, // Reward $ - increased
            { wch: 15 }, // Result $ - increased
            { wch: 15 }, // Equity After
            { wch: 40 }, // Notes
          ];

          // Freeze header row
          newWs["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

          // Add auto-filter (11 columns now with Trade #)
          if (existingData.length > 1) {
            newWs["!autofilter"] = { 
              ref: XLSX.utils.encode_range({ 
                s: { r: 0, c: 0 }, 
                e: { r: existingData.length - 1, c: 10 } 
              }) 
            };
          }

          // Format number columns
          if (existingData.length > 1) {
            for (let row = 1; row < existingData.length; row++) {
              // Trade # (column A, index 0)
              const tradeNumCell = XLSX.utils.encode_cell({ r: row, c: 0 });
              if (newWs[tradeNumCell]) {
                const tradeNum = Number(newWs[tradeNumCell].v);
                if (!isNaN(tradeNum)) {
                  newWs[tradeNumCell].v = tradeNum;
                  newWs[tradeNumCell].t = "n";
                  newWs[tradeNumCell].z = "0";
                }
              }
              
              // Lot Size (column E, index 4)
              const lotCell = XLSX.utils.encode_cell({ r: row, c: 4 });
              if (newWs[lotCell] && newWs[lotCell].v) {
                const lotValue = Number(newWs[lotCell].v);
                if (!isNaN(lotValue) && isFinite(lotValue)) {
                  newWs[lotCell].v = lotValue;
                  newWs[lotCell].t = "n";
                  newWs[lotCell].z = "0.00";
                }
              }
              
              // Format numeric columns (Risk $, Reward $, Result $, Equity After)
              [6, 7, 8, 9].forEach((colIdx) => {
                const cell = XLSX.utils.encode_cell({ r: row, c: colIdx });
                if (newWs[cell] && newWs[cell].v) {
                  const numValue = Number(newWs[cell].v);
                  if (!isNaN(numValue) && isFinite(numValue)) {
                    newWs[cell].v = numValue;
                    newWs[cell].t = "n";
                    newWs[cell].z = "#,##0.00";
                  }
                }
              });
            }
          }

          // Use the same sheet name
          const sheetName = firstSheetName || "Trading Journal";
          XLSX.utils.book_append_sheet(newWb, newWs, sheetName);

          // Save updated file with original filename format
          const filename = "XAUUSD_ULTIMATE_TRADING_JOURNAL.xlsx";
          XLSX.writeFile(newWb, filename);

          alert(
            `✅ Successfully added ${newTradesToAdd.length} new trade(s) to Excel file!\n\n` +
            `• Duplicate entries were skipped\n` +
            `• File saved as: "${filename}"\n` +
            `• Total trades in file: ${existingData.length - 1}`
          );
        } catch (error) {
          console.error("Error uploading to Excel:", error);
          alert(`Error processing Excel file: ${error.message}\n\nPlease make sure the file format is correct and try again.`);
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  // Import from Excel (Populate trades) - FIXED & OPTIMIZED
  const importFromExcel = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // File size limit: 10MB
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        alert("File size exceeds 10MB limit. Please use a smaller file.");
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => {
        alert("Error reading file. Please try again.");
      };
      
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });

          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            alert("Invalid Excel file. No sheets found.");
            return;
          }

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          if (!worksheet) {
            alert("Invalid Excel file. Sheet is empty.");
            return;
          }

          // Convert to array of arrays
          const excelData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            raw: false,
          });

          if (!excelData || excelData.length < 2) {
            alert("The Excel file appears to be empty or invalid. Please ensure it has at least a header row and one data row.");
            return;
          }

          // Get headers (first row) - normalize to lowercase
          const rawHeaders = excelData[0] || [];
          const headers = rawHeaders.map((h) => String(h || "").trim().toLowerCase());

          // Find column indices (exclude Trade # from searches)
          const dateIdx = headers.findIndex((h) => 
            h.includes("date") && !h.includes("trade")
          );
          const entryIdx = headers.findIndex((h) => 
            h.includes("entry")
          );
          const lotSizeIdx = headers.findIndex((h) => 
            (h.includes("lot") || h.includes("size")) && !h.includes("trade")
          );
          const sessionIdx = headers.findIndex((h) => 
            h.includes("session")
          );
          const outcomeIdx = headers.findIndex((h) => 
            h.includes("outcome")
          );
          const notesIdx = headers.findIndex((h) => 
            h.includes("note")
          );
          const riskIdx = headers.findIndex((h) => 
            h.includes("risk")
          );
          const rewardIdx = headers.findIndex((h) => 
            h.includes("reward")
          );
          const resultIdx = headers.findIndex((h) => 
            h.includes("result")
          );
          const equityIdx = headers.findIndex((h) => 
            h.includes("equity")
          );

          if (dateIdx === -1 || entryIdx === -1) {
            alert(
              "Excel file must contain 'Date' and 'Entry' columns. Please check the file format.\n\nFound columns: " + rawHeaders.join(", ")
            );
            return;
          }

          // Import trades (skip header row)
          const importedTrades = [];
          let skippedCount = 0;
          
          for (let i = 1; i < excelData.length; i++) {
            const row = excelData[i];
            if (!row || !Array.isArray(row) || row.length === 0) {
              skippedCount++;
              continue;
            }

            const date = String(row[dateIdx] || "").trim();
            const entry = String(row[entryIdx] || "").trim();

            // Skip rows without required data
            if (!date || !entry || date === "" || entry === "") {
              skippedCount++;
              continue;
            }

            // Calculate current equity before this trade
            let runningEquity = Number(settings.accountBalance) || 0;
            if (importedTrades.length > 0) {
              const lastTrade = importedTrades[importedTrades.length - 1];
              if (lastTrade && lastTrade.equityAfter) {
                const parsed = Number(lastTrade.equityAfter);
                if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
                  runningEquity = parsed;
                }
              }
            } else if (trades.length > 0) {
              const lastTrade = trades[trades.length - 1];
              if (lastTrade && lastTrade.equityAfter) {
                const parsed = Number(lastTrade.equityAfter);
                if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
                  runningEquity = parsed;
                }
              }
            }

            // Parse lot size with defensive checks
            let lotSize = 0;
            if (lotSizeIdx !== -1 && row[lotSizeIdx] !== undefined && row[lotSizeIdx] !== "") {
              const parsed = Number(row[lotSizeIdx]);
              if (!isNaN(parsed) && isFinite(parsed) && parsed >= 0) {
                lotSize = parsed;
              }
            }

            const riskDollars = (runningEquity * (Number(settings.riskPercent) || 0)) / 100;
            const takeProfitPips = Number(settings.takeProfitPips) || 0;
            const rewardDollars =
              lotSize > 0 && takeProfitPips > 0
                ? lotSize * takeProfitPips * 100
                : 0;

            // Use outcome from Excel or calculate from result
            let outcome = "Win";
            if (outcomeIdx !== -1 && row[outcomeIdx] !== undefined) {
              const outcomeStr = String(row[outcomeIdx] || "").trim();
              if (outcomeStr === "Win" || outcomeStr === "Loss") {
                outcome = outcomeStr;
              } else if (resultIdx !== -1 && row[resultIdx] !== undefined) {
                // Try to determine from result column
                const result = Number(row[resultIdx]);
                if (!isNaN(result)) {
                  outcome = result >= 0 ? "Win" : "Loss";
                }
              }
            }

            const result = outcome === "Win" ? rewardDollars : -riskDollars;
            const equityAfter = runningEquity + result;

            // Ensure equity doesn't go negative
            const finalEquity = Math.max(0, equityAfter);

            importedTrades.push({
              id: Date.now() + i + Math.random(), // Unique ID
              date: date,
              session: String(row[sessionIdx] || "London").trim(),
              entry: entry,
              lotSize: String(lotSize || ""),
              outcome: outcome,
              notes: String(row[notesIdx] || "").trim(),
              riskDollars: riskDollars.toFixed(2),
              rewardDollars: rewardDollars.toFixed(2),
              resultDollars: result.toFixed(2),
              equityAfter: finalEquity.toFixed(2),
            });
          }

          if (importedTrades.length === 0) {
            alert(
              `No valid trades found in the Excel file.\n\n` +
              `• Skipped ${skippedCount} invalid/empty row(s)\n` +
              `• Please ensure rows have Date and Entry values`
            );
            return;
          }

          // Limit number of trades to prevent memory issues (max 10,000 trades)
          const MAX_TRADES = 10000;
          const currentTradeCount = trades.length;
          if (currentTradeCount + importedTrades.length > MAX_TRADES) {
            const allowed = MAX_TRADES - currentTradeCount;
            if (allowed <= 0) {
              alert(`Maximum trade limit (${MAX_TRADES}) reached. Please delete some trades before importing.`);
              return;
            }
            const skipped = importedTrades.length - allowed;
            importedTrades.splice(allowed);
            if (skipped > 0) {
              alert(`Importing ${allowed} trades (limit reached). ${skipped} trades were skipped.`);
            }
          }

          // Add imported trades to existing trades
          setTrades((prev) => [...prev, ...importedTrades]);

          // Recalculate all trades to ensure consistency with current settings
          setTimeout(() => {
            recalculateAllTrades(settings);
          }, 100);

          const message = skippedCount > 0
            ? `✅ Successfully imported ${importedTrades.length} trade(s)!\n\n• ${skippedCount} invalid row(s) were skipped\n• All trades recalculated with current settings`
            : `✅ Successfully imported ${importedTrades.length} trade(s)!\n\n• All trades recalculated with current settings`;

          alert(message);
        } catch (error) {
          console.error("Error importing from Excel:", error);
          alert("Error importing Excel file. Please make sure the file format is correct.");
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const getGradeColor = (grade) => {
    switch (grade) {
      case "A":
        return "text-emerald-400";
      case "B":
        return "text-blue-400";
      case "C":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getPhaseColor = (phase) => {
    switch (phase) {
      case "Phase1":
        return "text-blue-400";
      case "Phase2":
        return "text-purple-400";
      case "Master":
        return "text-emerald-400";
      default:
        return "text-gray-400";
    }
  };

  const getPhaseBadgeColor = (phase) => {
    switch (phase) {
      case "Phase1":
        return "bg-blue-500/20 border-blue-500 text-blue-400";
      case "Phase2":
        return "bg-purple-500/20 border-purple-500 text-purple-400";
      case "Master":
        return "bg-emerald-500/20 border-emerald-500 text-emerald-400";
      default:
        return "bg-gray-500/20 border-gray-500 text-gray-400";
    }
  };

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-2 bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            FundingPips Challenge Dashboard
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm md:text-base">
            Two-Step Challenge Trade Journal
          </p>
        </div>

        {/* Current Phase Status */}
        <div
          className={`card mb-4 sm:mb-6 border-2 ${getPhaseBadgeColor(
            metrics.currentPhase
          )}`}
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="text-xs sm:text-sm text-gray-400 mb-1">
                Current Challenge Phase
              </div>
              <div
                className={`text-xl sm:text-2xl md:text-3xl font-bold ${getPhaseColor(
                  metrics.currentPhase
                )}`}
              >
                {metrics.currentPhase === "Phase1"
                  ? "Phase 1"
                  : metrics.currentPhase === "Phase2"
                  ? "Phase 2"
                  : "Master Account"}
              </div>
            </div>
            <div className="flex gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-center sm:text-right">
                <div className="text-xs sm:text-sm text-gray-400 mb-1">Progress</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold">
                  {metrics.phaseProgress.toFixed(1)}%
                </div>
              </div>
              <div className="text-center sm:text-right">
                <div className="text-xs sm:text-sm text-gray-400 mb-1">Target</div>
                <div className="text-lg sm:text-xl md:text-2xl font-bold">
                  ${Number(metrics.phaseTarget).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Drawdown Warning */}
        {metrics.drawdownWarning && (
          <div className="mb-4 sm:mb-6 bg-red-900/30 border border-red-500 rounded-lg p-3 sm:p-4">
            <p className="text-red-400 font-semibold text-sm sm:text-base">
              ⚠️ Daily Drawdown Limit Exceeded: {metrics.dailyDrawdown}% (Limit:{" "}
              {settings.dailyDrawdownLimit}%)
            </p>
          </div>
        )}

        {/* Settings Section */}
        <div className="card mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 text-sky-400">
            Challenge Settings
          </h2>

          {/* Challenge Account Size */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-medium mb-2">
              Challenge Account Size
            </label>
            <div className="flex flex-wrap gap-2">
              {CHALLENGE_ACCOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleChallengeAccountChange(amount)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm ${
                    settings.accountBalance === amount
                      ? "bg-sky-600 text-white ring-2 ring-sky-400"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                  }`}
                >
                  ${amount.toLocaleString()}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Master account automatically set to: $
              {Number(settings.masterAccountBalance).toLocaleString()}
            </p>
          </div>

          {/* Challenge Type */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-medium mb-2">
              Challenge Type
            </label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <button
                onClick={() => handleChallengeTypeChange("two-step")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.challengeType === "two-step"
                    ? "bg-sky-600 text-white ring-2 ring-sky-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                Two-Step (Phase 1 + Phase 2)
              </button>
              <button
                onClick={() => handleChallengeTypeChange("one-step")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.challengeType === "one-step"
                    ? "bg-sky-600 text-white ring-2 ring-sky-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                One-Step (Phase 1 Only)
              </button>
              <button
                onClick={() => handleChallengeTypeChange("zero-step")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.challengeType === "zero-step"
                    ? "bg-sky-600 text-white ring-2 ring-sky-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                Zero-Step (Direct Master)
              </button>
            </div>
          </div>

          {/* Risk Management */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm sm:text-base font-medium mb-2">
              Risk Per Trade
              <span className="block sm:inline sm:ml-2 text-xs font-normal text-gray-400 mt-1 sm:mt-0">
                (Choose your risk level - lot size will auto-calculate)
              </span>
            </label>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-3">
              <button
                onClick={() => handleRiskPreset("safe")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.riskPreset === "safe"
                    ? "bg-emerald-600 text-white ring-2 ring-emerald-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                🛡️ Safe (0.25%)
              </button>
              <button
                onClick={() => handleRiskPreset("balanced")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.riskPreset === "balanced"
                    ? "bg-blue-600 text-white ring-2 ring-blue-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                ⚖️ Balanced (0.5%)
              </button>
              <button
                onClick={() => handleRiskPreset("aggressive")}
                className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all duration-200 text-xs sm:text-sm flex-1 sm:flex-none ${
                  settings.riskPreset === "aggressive"
                    ? "bg-red-600 text-white ring-2 ring-red-400"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600 active:bg-gray-500"
                }`}
              >
                ⚡ Aggressive (1%)
              </button>
              {settings.riskPreset === "custom" && (
                <button
                  className="px-4 py-2 rounded-lg font-medium bg-purple-600 text-white ring-2 ring-purple-400"
                  disabled
                >
                  ✏️ Custom ({settings.riskPercent}%)
                </button>
              )}
            </div>
            <div className="mb-3 p-3 bg-gray-800/50 rounded border border-gray-700">
              <div className="text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Selected Risk Level:</span>
                  <span
                    className={`font-bold ${
                      settings.riskPreset === "safe"
                        ? "text-emerald-400"
                        : settings.riskPreset === "balanced"
                        ? "text-blue-400"
                        : settings.riskPreset === "aggressive"
                        ? "text-red-400"
                        : "text-purple-400"
                    }`}
                  >
                    {settings.riskPreset === "safe"
                      ? "🛡️ Safe"
                      : settings.riskPreset === "balanced"
                      ? "⚖️ Balanced"
                      : settings.riskPreset === "aggressive"
                      ? "⚡ Aggressive"
                      : "✏️ Custom"}{" "}
                    - {settings.riskPercent}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Current Equity:</span>
                  <span className="text-white font-medium">
                    $
                    {Number(
                      calculateSuggestedLotSize.currentEquity
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-700 pt-1 mt-1">
                  <span className="text-gray-400">Risk Amount per Trade:</span>
                  <span className="text-emerald-400 font-bold">
                    ${calculateSuggestedLotSize.riskDollars}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Suggested Lot Size:</span>
                  <span className="text-sky-400 font-bold">
                    {calculateSuggestedLotSize.lotSize} lots
                  </span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {settings.riskPreset === "custom" ? (
                  <span>
                    Custom Risk %{" "}
                    <span className="text-purple-400">(Active)</span>
                  </span>
                ) : (
                  <span>
                    Custom Risk %{" "}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      (Edit to use custom value)
                    </span>
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                className={`input w-full max-w-xs ${
                  settings.riskPreset === "custom"
                    ? "border-purple-500 ring-2 ring-purple-500/20"
                    : ""
                }`}
                value={inputValues.riskPercent !== undefined ? inputValues.riskPercent : (settings.riskPercent || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val === "") {
                    setInputValues({ ...inputValues, riskPercent: "" });
                    return;
                  }
                  val = val.replace(/[^\d.]/g, "");
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, riskPercent: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, riskPercent: val });
                    handleSettingChange("riskPercent", numValue);
                  }
                }}
                onFocus={(e) => {
                  setInputValues({ ...inputValues, riskPercent: e.target.value });
                }}
                onBlur={(e) => {
                  const newInputValues = { ...inputValues };
                  delete newInputValues.riskPercent;
                  setInputValues(newInputValues);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                {settings.riskPreset === "custom" ? (
                  <span className="text-purple-400">
                    ✏️ Custom risk active - automatically detected when value
                    doesn't match presets
                  </span>
                ) : (
                  "💡 Tip: Lower risk = smaller lot size = safer trading. Higher risk = larger lot size = more potential profit/loss."
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Risk % per Trade
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={inputValues.riskPercent !== undefined ? inputValues.riskPercent : (settings.riskPercent || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val === "") {
                    setInputValues({ ...inputValues, riskPercent: "" });
                    return;
                  }
                  val = val.replace(/[^\d.]/g, "");
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, riskPercent: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, riskPercent: val });
                    handleSettingChange("riskPercent", numValue);
                  }
                }}
                onFocus={(e) => {
                  setInputValues({ ...inputValues, riskPercent: e.target.value });
                }}
                onBlur={(e) => {
                  const newInputValues = { ...inputValues };
                  delete newInputValues.riskPercent;
                  setInputValues(newInputValues);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Stop-Loss (Pips)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full"
                value={inputValues.stopLossPips !== undefined ? inputValues.stopLossPips : (settings.stopLossPips || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  // Allow empty string for clearing
                  if (val === "") {
                    setInputValues({ ...inputValues, stopLossPips: "" });
                    return;
                  }
                  // Remove any non-numeric characters except decimal point
                  val = val.replace(/[^\d.]/g, "");
                  // Remove leading zeros (but keep single 0 or 0.5)
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, stopLossPips: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, stopLossPips: val });
                    handleSettingChange("stopLossPips", numValue);
                  }
                }}
                onFocus={(e) => {
                  // Store current value when focusing
                  setInputValues({ ...inputValues, stopLossPips: e.target.value });
                }}
                onBlur={(e) => {
                  // If empty on blur, restore previous value and clear input state
                  if (e.target.value === "" || e.target.value === ".") {
                    const newInputValues = { ...inputValues };
                    delete newInputValues.stopLossPips;
                    setInputValues(newInputValues);
                  } else {
                    // Clear input state on blur if value is valid
                    const newInputValues = { ...inputValues };
                    delete newInputValues.stopLossPips;
                    setInputValues(newInputValues);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Take-Profit (Pips)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full"
                value={inputValues.takeProfitPips !== undefined ? inputValues.takeProfitPips : (settings.takeProfitPips || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val === "") {
                    setInputValues({ ...inputValues, takeProfitPips: "" });
                    return;
                  }
                  val = val.replace(/[^\d.]/g, "");
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, takeProfitPips: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, takeProfitPips: val });
                    handleSettingChange("takeProfitPips", numValue);
                  }
                }}
                onFocus={(e) => {
                  setInputValues({ ...inputValues, takeProfitPips: e.target.value });
                }}
                onBlur={(e) => {
                  const newInputValues = { ...inputValues };
                  delete newInputValues.takeProfitPips;
                  setInputValues(newInputValues);
                }}
              />
            </div>
            {(settings.challengeType === "two-step" ||
              settings.challengeType === "one-step") && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phase-1 Target %
                </label>
                {settings.challengeType === "two-step" && (
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => handleSettingChange("phase1Target", 8)}
                      className={`px-3 py-1 text-sm rounded ${
                        settings.phase1Target === 8
                          ? "bg-sky-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      8%
                    </button>
                    <button
                      onClick={() => handleSettingChange("phase1Target", 10)}
                      className={`px-3 py-1 text-sm rounded ${
                        settings.phase1Target === 10
                          ? "bg-sky-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      10%
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input w-full"
                  value={
                    inputValues.phase1Target !== undefined
                      ? inputValues.phase1Target
                      : settings.phase1Target || ""
                  }
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === "") {
                      setInputValues({ ...inputValues, phase1Target: "" });
                      return;
                    }
                    val = val.replace(/[^\d.]/g, "");
                    if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                      val = val.replace(/^0+/, "");
                    }
                    if (val === "" || val === ".") {
                      setInputValues({ ...inputValues, phase1Target: val });
                      return;
                    }
                    const numValue = Number(val);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setInputValues({ ...inputValues, phase1Target: val });
                      handleSettingChange("phase1Target", numValue);
                    }
                  }}
                  onFocus={(e) => {
                    setInputValues({ ...inputValues, phase1Target: e.target.value });
                  }}
                  onBlur={(e) => {
                    const newInputValues = { ...inputValues };
                    delete newInputValues.phase1Target;
                    setInputValues(newInputValues);
                  }}
                />
              </div>
            )}
            {settings.challengeType === "two-step" && (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phase-2 Target %
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full"
                  value={inputValues.phase2Target !== undefined ? inputValues.phase2Target : (settings.phase2Target || "")}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === "") {
                      setInputValues({ ...inputValues, phase2Target: "" });
                      return;
                    }
                    val = val.replace(/[^\d.]/g, "");
                    if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                      val = val.replace(/^0+/, "");
                    }
                    if (val === "" || val === ".") {
                      setInputValues({ ...inputValues, phase2Target: val });
                      return;
                    }
                    const numValue = Number(val);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setInputValues({ ...inputValues, phase2Target: val });
                      handleSettingChange("phase2Target", numValue);
                    }
                  }}
                  onFocus={(e) => {
                    setInputValues({ ...inputValues, phase2Target: e.target.value });
                  }}
                  onBlur={(e) => {
                    const newInputValues = { ...inputValues };
                    delete newInputValues.phase2Target;
                    setInputValues(newInputValues);
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">Default: 5%</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                Daily Drawdown Limit %
              </label>
              <input
                type="number"
                step="0.01"
                className="input w-full"
                value={inputValues.dailyDrawdownLimit !== undefined ? inputValues.dailyDrawdownLimit : (settings.dailyDrawdownLimit || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val === "") {
                    setInputValues({ ...inputValues, dailyDrawdownLimit: "" });
                    return;
                  }
                  val = val.replace(/[^\d.]/g, "");
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, dailyDrawdownLimit: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, dailyDrawdownLimit: val });
                    handleSettingChange("dailyDrawdownLimit", numValue);
                  }
                }}
                onFocus={(e) => {
                  setInputValues({ ...inputValues, dailyDrawdownLimit: e.target.value });
                }}
                onBlur={(e) => {
                  const newInputValues = { ...inputValues };
                  delete newInputValues.dailyDrawdownLimit;
                  setInputValues(newInputValues);
                }}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Master Account Balance ($)
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="input w-full"
                value={inputValues.masterAccountBalance !== undefined ? inputValues.masterAccountBalance : (settings.masterAccountBalance || "")}
                onChange={(e) => {
                  let val = e.target.value;
                  if (val === "") {
                    setInputValues({ ...inputValues, masterAccountBalance: "" });
                    return;
                  }
                  val = val.replace(/[^\d.]/g, "");
                  if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                    val = val.replace(/^0+/, "");
                  }
                  if (val === "" || val === ".") {
                    setInputValues({ ...inputValues, masterAccountBalance: val });
                    return;
                  }
                  const numValue = Number(val);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setInputValues({ ...inputValues, masterAccountBalance: val });
                    handleSettingChange("masterAccountBalance", numValue);
                  }
                }}
                onFocus={(e) => {
                  setInputValues({ ...inputValues, masterAccountBalance: e.target.value });
                }}
                onBlur={(e) => {
                  const newInputValues = { ...inputValues };
                  delete newInputValues.masterAccountBalance;
                  setInputValues(newInputValues);
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                For master account tracking
              </p>
            </div>
            {metrics.currentPhase === "Master" || settings.challengeType === "zero-step" ? (
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">
                  Monthly Target ($)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="input w-full"
                  value={inputValues.monthlyTarget !== undefined ? inputValues.monthlyTarget : (settings.monthlyTarget || "")}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val === "") {
                      setInputValues({ ...inputValues, monthlyTarget: "" });
                      return;
                    }
                    val = val.replace(/[^\d.]/g, "");
                    if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                      val = val.replace(/^0+/, "");
                    }
                    if (val === "" || val === ".") {
                      setInputValues({ ...inputValues, monthlyTarget: val });
                      return;
                    }
                    const numValue = Number(val);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setInputValues({ ...inputValues, monthlyTarget: val });
                      handleSettingChange("monthlyTarget", numValue);
                    }
                  }}
                  onFocus={(e) => {
                    setInputValues({ ...inputValues, monthlyTarget: e.target.value });
                  }}
                  onBlur={(e) => {
                    const newInputValues = { ...inputValues };
                    delete newInputValues.monthlyTarget;
                    setInputValues(newInputValues);
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Set monthly profit target for master account (0 to disable)
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Dashboard Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Balance</div>
            <div className="text-base sm:text-lg md:text-xl font-bold break-words">
              ${(settings.challengeType === "zero-step" 
                ? Number(settings.masterAccountBalance) 
                : settings.accountBalance).toLocaleString()}
            </div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Equity</div>
            <div className="text-base sm:text-lg md:text-xl font-bold break-words">
              ${Number(metrics.currentEquity).toLocaleString()}
            </div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-base sm:text-lg md:text-xl font-bold">{metrics.winRate}%</div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Expectancy</div>
            <div className="text-base sm:text-lg md:text-xl font-bold">{metrics.expectancy}</div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Grade</div>
            <div
              className={`text-xl sm:text-2xl md:text-3xl font-bold ${getGradeColor(
                metrics.strategyGrade
              )}`}
            >
              {metrics.strategyGrade}
            </div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Lot Size</div>
            <div className="text-base sm:text-lg md:text-xl font-bold">{metrics.suggestedLotSize}</div>
          </div>
          <div className="card text-center p-2 sm:p-3">
            <div className="text-xs sm:text-sm text-gray-400 mb-1">Trades</div>
            <div className="text-base sm:text-lg md:text-xl font-bold">{metrics.totalTrades}</div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="card mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 text-sky-400">
            Challenge Progress
          </h2>
          <div className="space-y-4">
            {(settings.challengeType === "two-step" ||
              settings.challengeType === "one-step") && (
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    Phase 1 Progress ({settings.phase1Target}% Target)
                  </span>
                  <span className="text-sm">
                    {(Number(metrics.phase1Progress) || 0).toFixed(1)}%
                    {metrics.currentPhase !== "Phase1" && (
                      <span className="text-emerald-400 ml-2">✓ Completed</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, Number(metrics.phase1Progress) || 0)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Target: ${Number(metrics.phase1Target).toLocaleString()} |
                  Current: ${Number(metrics.currentEquity).toLocaleString()}
                </p>
              </div>
            )}
            {settings.challengeType === "two-step" && (
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    Phase 2 Progress ({settings.phase2Target}% Target)
                  </span>
                  <span className="text-sm">
                    {(Number(metrics.phase2Progress) || 0).toFixed(1)}%
                    {metrics.currentPhase === "Master" && (
                      <span className="text-emerald-400 ml-2">✓ Completed</span>
                    )}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, Number(metrics.phase2Progress) || 0)
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Target: ${Number(metrics.phase2Target).toLocaleString()} |
                  Current: ${Number(metrics.currentEquity).toLocaleString()}
                </p>
              </div>
            )}
            {(metrics.currentPhase === "Master" || settings.challengeType === "zero-step") &&
              settings.masterAccountBalance > 0 && (
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">Master Account</span>
                    <span className="text-sm text-emerald-400">Active</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-emerald-500 h-3 rounded-full"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Master Account Balance: $
                    {Number(metrics.currentEquity).toLocaleString()}
                  </p>
                  {Number(settings.monthlyTarget) > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Monthly Target</span>
                        <span className="text-sm text-emerald-400">
                          {Number(metrics.monthlyTargetProgress) > 0 ? `${metrics.monthlyTargetProgress}%` : "0%"}
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-3">
                        <div
                          className="bg-sky-500 h-3 rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(Number(metrics.monthlyTargetProgress) || 0, 100)}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Target: ${Number(settings.monthlyTarget).toLocaleString()} | 
                        Progress: ${(Number(metrics.currentEquity) - Number(metrics.monthlyStartingBalance)).toLocaleString()} / ${Number(settings.monthlyTarget).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>

        {/* Equity Curve Chart */}
        <div className="card mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4 text-sky-400">
            Equity Curve
          </h2>
          <div className="h-48 sm:h-64 md:h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="trade" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1F2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#E5E7EB" }}
                />
                <Line
                  type="monotone"
                  dataKey="equity"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: "#10B981", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trade Journal */}
        <div className="card mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-sky-400">
              Trade Journal
            </h2>
            <div className="flex flex-wrap gap-2 items-center w-full sm:w-auto">
              <button
                onClick={() => setShowAddTradeForm(!showAddTradeForm)}
                className="btn-primary flex-1 sm:flex-none"
              >
                {showAddTradeForm ? "Cancel" : "Add Trade"}
              </button>
              <button
                onClick={exportToExcel}
                className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                title="Create a new Excel file with your trades"
              >
                <span className="hidden sm:inline">📊</span>
                <span className="sm:hidden">📊</span>
                <span className="hidden sm:inline">Create Excel</span>
                <span className="sm:hidden">Excel</span>
              </button>
              <button
                onClick={uploadToExistingExcel}
                className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                title="Upload trades to an existing Excel file (duplicates will be skipped)"
              >
                <span className="hidden sm:inline">📤</span>
                <span className="sm:hidden">📤</span>
                <span className="hidden sm:inline">Upload to Excel</span>
                <span className="sm:hidden">Upload</span>
              </button>
              <button
                onClick={importFromExcel}
                className="btn-secondary flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                title="Import trades from an Excel file"
              >
                <span className="hidden sm:inline">📥</span>
                <span className="sm:hidden">📥</span>
                <span className="hidden sm:inline">Import Excel</span>
                <span className="sm:hidden">Import</span>
              </button>
            </div>
          </div>

          {/* Add Trade Form */}
          {showAddTradeForm && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-700/30 rounded-lg border border-gray-600">
              <div className="flex justify-between items-center mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-sky-400">
                  Add New Trade
                </h3>
                <div className="text-xs text-gray-400 bg-gray-800/50 px-3 py-1 rounded">
                  💡 Lot size auto-calculated from your risk settings
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1">
                    Date *
                  </label>
                  <DatePicker
                    value={newTrade.date}
                    onChange={(value) =>
                      setNewTrade({ ...newTrade, date: value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1">
                    Lot Size *
                    <span className="block sm:inline sm:ml-2 text-xs font-normal text-gray-400 mt-0.5 sm:mt-0">
                      (Auto-calculated from your risk)
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="input w-full"
                      value={newTrade.lotSize}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (val === "") {
                          setNewTrade({ ...newTrade, lotSize: "" });
                          return;
                        }
                        val = val.replace(/[^\d.]/g, "");
                        if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                          val = val.replace(/^0+/, "");
                        }
                        setNewTrade({ ...newTrade, lotSize: val });
                      }}
                      placeholder={calculateSuggestedLotSize.lotSize}
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({
                          ...newTrade,
                          lotSize: calculateSuggestedLotSize.lotSize,
                        })
                      }
                      className="px-2 sm:px-3 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200"
                      title="Use suggested lot size"
                    >
                      Auto
                    </button>
                  </div>
                  <div className="mt-2 p-2 sm:p-3 bg-gray-800/50 rounded border border-gray-700">
                    <div className="text-xs sm:text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Equity:</span>
                        <span className="text-white font-medium">
                          $
                          {Number(
                            calculateSuggestedLotSize.currentEquity
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Risk %:</span>
                        <span className="text-white font-medium">
                          {settings.riskPercent}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Risk Amount:</span>
                        <span className="text-emerald-400 font-medium">
                          ${calculateSuggestedLotSize.riskDollars}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stop Loss:</span>
                        <span className="text-white font-medium">
                          {settings.stopLossPips} pips
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-gray-700 pt-1 mt-1">
                        <span className="text-sky-400 font-medium">
                          Suggested Lot Size:
                        </span>
                        <span className="text-sky-400 font-bold">
                          {calculateSuggestedLotSize.lotSize} lots
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 This lot size ensures you risk exactly{" "}
                      {settings.riskPercent}% (
                      {calculateSuggestedLotSize.riskDollars}) of your $
                      {Number(
                        calculateSuggestedLotSize.currentEquity
                      ).toLocaleString()}{" "}
                      equity
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Session
                  </label>
                  <select
                    className="input w-full"
                    value={newTrade.session}
                    onChange={(e) =>
                      setNewTrade({ ...newTrade, session: e.target.value })
                    }
                  >
                    <option value="Asian">Asian</option>
                    <option value="London">London</option>
                    <option value="New York">New York</option>
                    <option value="Overlap">Overlap</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Entry (Pair) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="trading-pairs"
                      className="input w-full"
                      value={newTrade.entry}
                      onChange={(e) =>
                        setNewTrade({ ...newTrade, entry: e.target.value })
                      }
                      placeholder="Select or type pair (e.g., XAUUSD)"
                      required
                    />
                    <datalist id="trading-pairs">
                      {TRADING_PAIRS.map((pair) => (
                        <option key={pair} value={pair} />
                      ))}
                    </datalist>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, entry: "XAUUSD" })
                      }
                      className="px-2 py-1 text-xs bg-yellow-600/20 hover:bg-yellow-600/30 active:bg-yellow-600/40 text-yellow-400 rounded border border-yellow-600/30 transition-all duration-200"
                    >
                      XAUUSD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, entry: "EUR/USD" })
                      }
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-300 rounded transition-all duration-200"
                    >
                      EUR/USD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, entry: "GBP/USD" })
                      }
                      className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-300 rounded transition-all duration-200"
                    >
                      GBP/USD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, entry: "BTC/USD" })
                      }
                      className="px-2 py-1 text-xs bg-orange-600/20 hover:bg-orange-600/30 active:bg-orange-600/40 text-orange-400 rounded border border-orange-600/30 transition-all duration-200"
                    >
                      BTC/USD
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, entry: "ETH/USD" })
                      }
                      className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 text-blue-400 rounded border border-blue-600/30 transition-all duration-200"
                    >
                      ETH/USD
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Quick select popular pairs or type any custom pair
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1">
                    Outcome
                  </label>
                  <select
                    className="input w-full"
                    value={newTrade.outcome}
                    onChange={(e) =>
                      setNewTrade({ ...newTrade, outcome: e.target.value })
                    }
                  >
                    <option value="Win">Win</option>
                    <option value="Loss">Loss</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs sm:text-sm font-medium mb-1">
                    Notes
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="trading-notes"
                      className="input w-full"
                      value={newTrade.notes}
                      onChange={(e) =>
                        setNewTrade({ ...newTrade, notes: e.target.value })
                      }
                      placeholder="Select or type notes (e.g., Very Good, Bad, Followed Plan)"
                    />
                    <datalist id="trading-notes">
                      {TRADING_NOTES.map((note) => (
                        <option key={note} value={note} />
                      ))}
                    </datalist>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Very Good" })
                      }
                      className="px-2 py-1 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-400 rounded border border-emerald-600/30 transition-all duration-200"
                    >
                      Very Good
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Good" })
                      }
                      className="px-2 py-1 text-xs bg-green-600/20 hover:bg-green-600/30 active:bg-green-600/40 text-green-400 rounded border border-green-600/30 transition-all duration-200"
                    >
                      Good
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTrade({ ...newTrade, notes: "Bad" })}
                      className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 active:bg-red-600/40 text-red-400 rounded border border-red-600/30 transition-all duration-200"
                    >
                      Bad
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Followed Plan" })
                      }
                      className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 active:bg-blue-600/40 text-blue-400 rounded border border-blue-600/30 transition-all duration-200"
                    >
                      Followed Plan
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Emotional Trade" })
                      }
                      className="px-2 py-1 text-xs bg-orange-600/20 hover:bg-orange-600/30 active:bg-orange-600/40 text-orange-400 rounded border border-orange-600/30 transition-all duration-200"
                    >
                      Emotional Trade
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Requires Review" })
                      }
                      className="px-2 py-1 text-xs bg-yellow-600/20 hover:bg-yellow-600/30 active:bg-yellow-600/40 text-yellow-400 rounded border border-yellow-600/30 transition-all duration-200"
                    >
                      Requires Review
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewTrade({ ...newTrade, notes: "Well Executed" })
                      }
                      className="px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 active:bg-purple-600/40 text-purple-400 rounded border border-purple-600/30 transition-all duration-200"
                    >
                      Well Executed
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Quick select common notes or type custom notes
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={handleAddTrade} className="btn-primary w-full sm:w-auto">
                  Save Trade
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px] sm:min-w-[1000px]">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Date
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Session
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Entry
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Lot Size
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Outcome
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Risk $
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Reward $
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Result $
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Equity After
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Notes
                  </th>
                  <th className="text-left p-2 text-xs sm:text-sm font-medium text-gray-400 whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr>
                    <td colSpan="11" className="text-center p-6 sm:p-8 text-gray-500 text-sm sm:text-base">
                      No trades yet. Click "Add Trade" to get started.
                    </td>
                  </tr>
                ) : (
                  trades.map((trade) => (
                    <tr
                      key={trade.id}
                      className={`border-b border-gray-700/50 ${
                        trade.outcome === "Win"
                          ? "bg-emerald-900/10"
                          : "bg-red-900/10"
                      }`}
                    >
                      <td className="p-2">
                        <div className="relative">
                          <DatePicker
                            value={trade.date || ""}
                            onChange={(value) =>
                              updateTrade(trade.id, "date", value)
                            }
                          />
                        </div>
                      </td>
                      <td className="p-2">
                        <select
                          className="input w-full text-sm"
                          value={trade.session || "London"}
                          onChange={(e) =>
                            updateTrade(trade.id, "session", e.target.value)
                          }
                        >
                          <option value="Asian">Asian</option>
                          <option value="London">London</option>
                          <option value="New York">New York</option>
                          <option value="Overlap">Overlap</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          list={`trading-pairs-${trade.id}`}
                          className="input w-full text-sm"
                          value={trade.entry || ""}
                          onChange={(e) =>
                            updateTrade(trade.id, "entry", e.target.value)
                          }
                          placeholder="Select or type pair"
                        />
                        <datalist id={`trading-pairs-${trade.id}`}>
                          {TRADING_PAIRS.map((pair) => (
                            <option key={pair} value={pair} />
                          ))}
                        </datalist>
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="input w-full text-sm"
                          value={trade.lotSize || ""}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val === "") {
                              updateTrade(trade.id, "lotSize", "");
                              return;
                            }
                            val = val.replace(/[^\d.]/g, "");
                            if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
                              val = val.replace(/^0+/, "");
                            }
                            updateTrade(trade.id, "lotSize", val);
                          }}
                          placeholder="0.01"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className={`input w-full text-sm ${
                            (trade.outcome || "Win") === "Win"
                              ? "bg-emerald-900/30 border-emerald-600"
                              : "bg-red-900/30 border-red-600"
                          }`}
                          value={trade.outcome || "Win"}
                          onChange={(e) =>
                            updateTrade(trade.id, "outcome", e.target.value)
                          }
                        >
                          <option value="Win">Win</option>
                          <option value="Loss">Loss</option>
                        </select>
                      </td>
                      <td className="p-2 text-sm">
                        ${trade.riskDollars || "0.00"}
                      </td>
                      <td className="p-2 text-sm">
                        ${trade.rewardDollars || "0.00"}
                      </td>
                      <td
                        className={`p-2 text-sm font-semibold ${
                          Number(trade.resultDollars || 0) >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        ${trade.resultDollars || "0.00"}
                      </td>
                      <td className="p-2 text-sm">
                        ${(Number(trade.equityAfter) || 0).toLocaleString()}
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          list={`trading-notes-${trade.id}`}
                          className="input w-full text-sm"
                          value={trade.notes || ""}
                          onChange={(e) =>
                            updateTrade(trade.id, "notes", e.target.value)
                          }
                          placeholder="Select or type notes"
                        />
                        <datalist id={`trading-notes-${trade.id}`}>
                          {TRADING_NOTES.map((note) => (
                            <option key={note} value={note} />
                          ))}
                        </datalist>
                      </td>
                      <td className="p-2">
                        <button
                          onClick={() => deleteTrade(trade.id)}
                          className="text-red-400 hover:text-red-300 active:text-red-200 text-xs sm:text-sm font-medium transition-colors duration-200 px-2 py-1 rounded hover:bg-red-900/20"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

import type { Trade, Settings, Metrics } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Clamp a value into [0, 100]. */
const clamp100 = (v: number) => Math.min(Math.max(v, 0), 100);

/** Linear progress % between two equity levels. Returns 0 if below start. */
const progressPct = (equity: number, start: number, end: number): number =>
  equity >= start ? clamp100(((equity - start) / (end - start)) * 100) : 0;

/** Recover the current equity from the last trade, falling back to the
 *  appropriate starting balance when no trades exist. */
function getCurrentEquity(trades: Trade[], settings: Settings): number {
  if (trades.length === 0) {
    return settings.challengeType === "zero-step"
      ? Number(settings.masterAccountBalance) || settings.accountBalance
      : settings.accountBalance;
  }
  const last = trades[trades.length - 1];
  const parsed = Number(last?.equityAfter);
  return isFinite(parsed) && parsed > 0 ? parsed : settings.accountBalance;
}

// ─── Core Recalculation ──────────────────────────────────────────────────────

/** Recalculate risk, reward, result, equity, and master-phase flag for every
 *  trade from scratch.  Pure function — returns a new array; input is unchanged. */
export function recalculateAllTrades(trades: Trade[], settings: Settings): Trade[] {
  if (trades.length === 0) return trades;

  const challengeType = settings.challengeType || "two-step";
  const initialBalance = settings.accountBalance;
  const phase1Threshold = initialBalance * (1 + settings.phase1Target / 100);
  const phase2Threshold = phase1Threshold * (1 + settings.phase2Target / 100);
  const masterBalance   = Number(settings.masterAccountBalance) || initialBalance;

  // Starting equity and phase depend on challenge type.
  let equity        = challengeType === "zero-step" ? masterBalance : initialBalance;
  let isMasterPhase = challengeType === "zero-step";

  return trades.map((trade) => {
    if (!trade) return trade;

    // Detect phase graduation before this trade is resolved.
    if (!isMasterPhase && challengeType !== "zero-step") {
      const threshold = challengeType === "two-step" ? phase2Threshold : phase1Threshold;
      if (equity >= threshold) {
        isMasterPhase = true;
        equity = masterBalance;
      }
    }

    const lotSize      = Number(trade.lotSize) || 0;
    const riskDollars  = (equity * settings.riskPercent) / 100;
    const rewardDollars = (lotSize > 0 && settings.takeProfitPips > 0)
      ? lotSize * settings.takeProfitPips * 100
      : 0;
    const result = trade.outcome === "Win" ? rewardDollars : -riskDollars;
    equity += result;

    // Guard against NaN/Infinity from bad input data.
    if (!isFinite(equity)) equity = isMasterPhase ? masterBalance : initialBalance;

    return {
      ...trade,
      riskDollars:   riskDollars.toFixed(2),
      rewardDollars: rewardDollars.toFixed(2),
      resultDollars: result.toFixed(2),
      equityAfter:   equity.toFixed(2),
      isMasterPhase,
    };
  });
}

// ─── Metrics ────────────────────────────────────────────────────────────────

const METRICS_FALLBACK: Metrics = {
  totalTrades: 0, wins: 0, losses: 0,
  winRate: "0.00", currentEquity: "0.00",
  expectancy: "0.00", strategyGrade: "C", suggestedLotSize: "0.00",
  phase1Progress: 0, phase2Progress: 0, currentPhase: "Phase1",
  phaseProgress: 0, phaseTarget: "0.00", phase1Target: "0.00", phase2Target: "0.00",
  drawdownWarning: false, dailyDrawdown: "0.00",
  monthlyTargetProgress: "0.00", monthlyTargetAmount: "0.00", monthlyStartingBalance: "0.00",
};

/** Derive all display metrics from the (already-recalculated) trade list and
 *  current settings.  Never throws — returns safe fallback values on error. */
export function calculateMetrics(trades: Trade[], settings: Settings): Metrics {
  try {
    const challengeType = settings.challengeType || "two-step";
    const totalTrades   = trades.length;
    const wins          = trades.filter((t) => t?.outcome === "Win").length;
    const losses        = totalTrades - wins;
    const winRate       = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const currentEquity = getCurrentEquity(trades, settings);

    // Expectancy: (winRate × avgWin) − (lossRate × avgLoss), expressed in pips.
    // avgWin uses the lot-size-weighted TP pips; avgLoss is always the fixed SL.
    const winTrades  = trades.filter((t) => t?.outcome === "Win");
    const avgWinPips = winTrades.length > 0
      ? winTrades.reduce((s, t) => s + Number(t.lotSize) * settings.takeProfitPips * 100, 0) / winTrades.length
      : settings.takeProfitPips;
    const avgLossPips = settings.stopLossPips; // fixed SL — same for every trade
    const winPct  = winRate / 100;
    const expectancy = winPct * avgWinPips - (1 - winPct) * avgLossPips;

    const strategyGrade: "A" | "B" | "C" =
      expectancy > 1 ? "A" : expectancy >= 0 ? "B" : "C";

    const riskDollars     = (currentEquity * settings.riskPercent) / 100;
    const suggestedLotSize = settings.stopLossPips > 0
      ? (riskDollars / (settings.stopLossPips * 100)).toFixed(2)
      : "0.00";

    // ── Phase progress ──────────────────────────────────────────────────────
    const initialBalance = challengeType === "zero-step"
      ? Number(settings.masterAccountBalance) || settings.accountBalance
      : settings.accountBalance;

    let phase1TargetVal = 0;
    let phase2TargetVal = 0;
    let currentPhase: "Phase1" | "Phase2" | "Master" = "Phase1";
    let phaseProgress = 0;
    let phaseTarget   = initialBalance;
    let phase1Progress = 0;
    let phase2Progress = 0;

    if (challengeType === "two-step") {
      phase1TargetVal = initialBalance * (1 + settings.phase1Target / 100);
      phase2TargetVal = phase1TargetVal * (1 + settings.phase2Target / 100);
      phase1Progress  = progressPct(currentEquity, initialBalance, phase1TargetVal);
      phase2Progress  = progressPct(currentEquity, phase1TargetVal, phase2TargetVal);

      if (currentEquity >= phase2TargetVal) {
        currentPhase = "Master"; phaseProgress = 100; phaseTarget = phase2TargetVal;
      } else if (currentEquity >= phase1TargetVal) {
        currentPhase = "Phase2"; phaseProgress = phase2Progress; phaseTarget = phase2TargetVal;
      } else {
        currentPhase = "Phase1"; phaseProgress = phase1Progress; phaseTarget = phase1TargetVal;
      }
    } else if (challengeType === "one-step") {
      phase1TargetVal = initialBalance * (1 + settings.phase1Target / 100);
      phase1Progress  = progressPct(currentEquity, initialBalance, phase1TargetVal);
      if (currentEquity >= phase1TargetVal) {
        currentPhase = "Master"; phaseProgress = 100; phaseTarget = phase1TargetVal;
      } else {
        currentPhase = "Phase1"; phaseProgress = phase1Progress; phaseTarget = phase1TargetVal;
      }
    } else {
      // zero-step: always in master
      currentPhase = "Master"; phaseProgress = 100; phaseTarget = initialBalance;
    }

    // ── Daily drawdown ──────────────────────────────────────────────────────
    let dailyDrawdown  = 0;
    let drawdownWarning = false;
    try {
      const todayStr = new Date().toDateString();
      const isTodayTrade = (t: Trade) => {
        try { return new Date(t.date).toDateString() === todayStr; } catch { return false; }
      };
      const todayTrades = trades.filter((t) => t?.date && isTodayTrade(t));

      if (todayTrades.length > 0) {
        // Equity at the start of today = last trade before today (or current equity).
        const lastBeforeIdx = trades.findLastIndex((t) => t?.date && !isTodayTrade(t));
        const sodEquity = lastBeforeIdx !== -1
          ? (Number(trades[lastBeforeIdx]?.equityAfter) || currentEquity)
          : currentEquity;

        const eodEquity = todayTrades.reduce((eq, t) =>
          t.outcome === "Win" ? eq + (Number(t.rewardDollars) || 0) : eq - (Number(t.riskDollars) || 0),
          sodEquity
        );

        if (sodEquity > 0 && isFinite(sodEquity) && isFinite(eodEquity)) {
          dailyDrawdown   = Math.max(0, ((sodEquity - eodEquity) / sodEquity) * 100);
          drawdownWarning = dailyDrawdown >= (settings.dailyDrawdownLimit || 0);
        }
      }
    } catch { /* non-fatal — default to 0 */ }

    // ── Monthly target (master phase only) ──────────────────────────────────
    let monthlyTargetProgress  = 0;
    let monthlyTargetAmount    = Number(settings.monthlyTarget) || 0;
    let monthlyStartingBalance = 0;

    const trackMonthly = monthlyTargetAmount > 0 &&
      (currentPhase === "Master" || challengeType === "zero-step");

    if (trackMonthly) {
      const now = new Date();
      const isMasterMonthTrade = (t: Trade) => {
        if (!t?.date) return false;
        try {
          const d = new Date(t.date);
          return d.getMonth() === now.getMonth()
            && d.getFullYear() === now.getFullYear()
            && (t.isMasterPhase || challengeType === "zero-step");
        } catch { return false; }
      };

      // Single pass: findIndex gives us both the first match and the index
      // needed to look up the preceding equity.
      const firstMonthIdx = trades.findIndex(isMasterMonthTrade);
      if (firstMonthIdx !== -1) {
        monthlyStartingBalance = firstMonthIdx > 0
          ? (Number(trades[firstMonthIdx - 1]?.equityAfter) || Number(settings.masterAccountBalance))
          : Number(settings.masterAccountBalance);
      } else {
        monthlyStartingBalance = Number(settings.masterAccountBalance);
      }

      monthlyTargetProgress = clamp100(
        ((currentEquity - monthlyStartingBalance) / monthlyTargetAmount) * 100
      );
    }

    return {
      totalTrades, wins, losses,
      winRate:           winRate.toFixed(2),
      currentEquity:     currentEquity.toFixed(2),
      expectancy:        expectancy.toFixed(2),
      strategyGrade,     suggestedLotSize,
      phase1Progress:    Math.max(0, phase1Progress),
      phase2Progress:    Math.max(0, phase2Progress),
      currentPhase,
      phaseProgress:     Math.max(0, phaseProgress),
      phaseTarget:       phaseTarget.toFixed(2),
      phase1Target:      phase1TargetVal.toFixed(2),
      phase2Target:      phase2TargetVal.toFixed(2),
      drawdownWarning,
      dailyDrawdown:     dailyDrawdown.toFixed(2),
      monthlyTargetProgress:  monthlyTargetProgress.toFixed(2),
      monthlyTargetAmount:    monthlyTargetAmount.toFixed(2),
      monthlyStartingBalance: monthlyStartingBalance.toFixed(2),
    };
  } catch {
    return { ...METRICS_FALLBACK, currentEquity: Number(settings.accountBalance || 0).toFixed(2) };
  }
}

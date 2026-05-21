/** A single logged trade position. Numeric P/L fields are stored as strings
 *  to preserve formatting precision from the calculation engine. */
export interface Trade {
  id: number;
  date: string;
  session: string;
  /** Trading pair symbol, e.g. "XAUUSD" */
  entry: string;
  lotSize: string;
  outcome: "Win" | "Loss";
  notes: string;
  riskDollars: string;
  rewardDollars: string;
  resultDollars: string;
  equityAfter: string;
  /** True once the trader has passed into the funded master account phase */
  isMasterPhase?: boolean;
}

/** Persisted challenge configuration. All percentage fields are stored as
 *  human-readable values (e.g. 0.5 means 0.5%, not 50%). */
export interface Settings {
  accountBalance: number;
  riskPercent: number;
  riskPreset: "safe" | "balanced" | "aggressive";
  stopLossPips: number;
  takeProfitPips: number;
  phase1Target: number;
  phase2Target: number;
  dailyDrawdownLimit: number;
  challengeType: "two-step" | "one-step" | "zero-step";
  masterAccountBalance: number;
  monthlyTarget: number;
}

/** Derived read-only statistics calculated from trades + settings.
 *  String fields are pre-formatted to two decimal places. */
export interface Metrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: string;
  currentEquity: string;
  expectancy: string;
  strategyGrade: "A" | "B" | "C";
  suggestedLotSize: string;
  phase1Progress: number;
  phase2Progress: number;
  currentPhase: "Phase1" | "Phase2" | "Master";
  phaseProgress: number;
  phaseTarget: string;
  phase1Target: string;
  phase2Target: string;
  drawdownWarning: boolean;
  dailyDrawdown: string;
  monthlyTargetProgress: string;
  monthlyTargetAmount: string;
  monthlyStartingBalance: string;
}

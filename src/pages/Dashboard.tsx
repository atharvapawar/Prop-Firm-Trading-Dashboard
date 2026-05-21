import { useState, useEffect, useCallback, useMemo } from "react";
import { useUserSettings } from "@/hooks/user-settings";
import {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Trade, Settings } from "../types";
import {
  STORAGE_KEYS,
  RISK_PRESETS,
  CHALLENGE_ACCOUNTS,
  TRADING_PAIRS,
  TRADING_NOTES,
  DEFAULT_SETTINGS,
} from "../lib/trading-data";
import {
  recalculateAllTrades,
  calculateMetrics,
} from "../lib/trade-calculations";
import {
  exportToCSV,
  exportToExcel,
  importFromExcel,
  uploadToExistingExcel,
} from "../lib/excel-utils";
import DatePicker from "../components/DatePicker";

// ─── Module-level constants ──────────────────────────────────────────────────

const SESSIONS = ["London", "New York", "Asian", "Sydney", "Overlap"] as const;
const today = new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
  date: today,
  session: "London",
  entry: "",
  lotSize: "",
  outcome: "Win" as "Win" | "Loss",
  notes: "",
};

/** Tab definitions are static — defined once at module scope, not per render. */
const TABS = [
  { id: "journal" as const, label: "Trade Journal", icon: "▦" },
  { id: "chart" as const, label: "Equity Curve", icon: "◈" },
  { id: "settings" as const, label: "Settings", icon: "⬡" },
];

/** Per-preset accent colours for the Settings tab toggle. */
const PRESET_STYLES = {
  safe: {
    bg: "rgba(0,255,157,0.1)",
    border: "rgba(0,255,157,0.35)",
    text: "#00ff9d",
  },
  balanced: {
    bg: "rgba(0,217,255,0.1)",
    border: "rgba(0,217,255,0.35)",
    text: "#00d9ff",
  },
  aggressive: {
    bg: "rgba(255,45,85,0.1)",
    border: "rgba(255,45,85,0.35)",
    text: "#ff2d55",
  },
} as const;

// ─── Utility functions ───────────────────────────────────────────────────────

function cn(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

function formatCurrency(val: number | string, d = 2) {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

function formatSign(val: number | string) {
  const n = Number(val);
  if (isNaN(n)) return "$0.00";
  return `${n >= 0 ? "+" : "-"}${formatCurrency(Math.abs(n))}`;
}

/** Factory: returns a form-field updater bound to a given state setter.
 *  Eliminates the duplicate handleFormChange / handleEditFormChange pattern. */
function makeFormSetter(
  setter: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>,
) {
  return (k: string, v: string) => setter((p) => ({ ...p, [k]: v }));
}

// ─── Animated Counter ────────────────────────────────────────────────────────

/** Renders a number that physically springs to its target value on change. */
function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const spring = useSpring(value, { stiffness: 60, damping: 18, mass: 0.8 });
  const display = useTransform(
    spring,
    (v) =>
      `${prefix}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );
  useEffect(() => {
    spring.set(value);
  }, [value, spring]);
  return <motion.span className={className}>{display}</motion.span>;
}

// ─── Sigil SVGs ──────────────────────────────────────────────────────────────

const SIGILS = {
  equity: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <polyline
        points="2,22 8,14 14,18 20,8 26,10 30,4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="100"
        style={{ animation: "draw-line 1.8s ease-out forwards" }}
      />
      <circle cx="30" cy="4" r="2" fill="currentColor" opacity="0.8" />
      <line
        x1="2"
        y1="28"
        x2="30"
        y2="28"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <line
        x1="2"
        y1="28"
        x2="2"
        y2="2"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
    </svg>
  ),
  trades: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.4"
      />
      <line
        x1="16"
        y1="3"
        x2="16"
        y2="29"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <line
        x1="3"
        y1="16"
        x2="29"
        y2="16"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <line
        x1="16"
        y1="3"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  winrate: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
        strokeDasharray="75.4"
      />
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="75.4"
        strokeDashoffset="20"
        strokeLinecap="round"
        transform="rotate(-90 16 16)"
      />
      <text
        x="16"
        y="20"
        textAnchor="middle"
        fill="currentColor"
        fontSize="8"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        %
      </text>
    </svg>
  ),
  expectancy: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <path
        d="M4 22 Q10 8 16 16 Q22 24 28 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 16 H28"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.3"
        strokeDasharray="3 2"
      />
      <circle
        cx="16"
        cy="16"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="4" cy="22" r="1.5" fill="currentColor" opacity="0.6" />
      <circle cx="28" cy="10" r="1.5" fill="currentColor" opacity="0.6" />
    </svg>
  ),
  grade: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <polygon
        points="16,3 19.5,12 29,12 21.5,18 24,27 16,22 8,27 10.5,18 3,12 12.5,12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <polygon
        points="16,8 18.2,14.5 25,14.5 19.5,18.5 21.5,25 16,21 10.5,25 12.5,18.5 7,14.5 13.8,14.5"
        fill="currentColor"
        opacity="0.18"
      />
    </svg>
  ),
  lot: (
    <svg viewBox="0 0 32 32" className="w-full h-full">
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.3"
      />
      <circle
        cx="16"
        cy="16"
        r="8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      <circle
        cx="16"
        cy="16"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="16" cy="16" r="1.2" fill="currentColor" />
      <line
        x1="16"
        y1="4"
        x2="16"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="16"
        y1="24"
        x2="16"
        y2="28"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="4"
        y1="16"
        x2="8"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line
        x1="24"
        y1="16"
        x2="28"
        y2="16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
};

// ─── Elite Progress Bar ──────────────────────────────────────────────────────

function EliteProgress({ value, color }: { value: number; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="elite-progress-track">
      <motion.div
        className="elite-progress-bar"
        style={{ background: color, boxShadow: `0 0 10px ${color}60` }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.4, ease: [0.34, 1.2, 0.64, 1] }}
      />
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  sub?: string;
  sigilKey: keyof typeof SIGILS;
  color: string;
  glowClass: string;
  index?: number;
}

function MetricCard({
  label,
  value,
  prefix,
  suffix,
  decimals = 2,
  sub,
  sigilKey,
  color,
  glowClass,
  index = 0,
}: MetricCardProps) {
  return (
    <motion.div
      className="metric-card"
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.07,
        duration: 0.55,
        ease: [0.34, 1.56, 0.64, 1],
      }}
      whileHover={{
        y: -4,
        transition: { type: "spring", stiffness: 300, damping: 20 },
      }}
    >
      <div className="corner-mark corner-mark-tl" />
      <div className="corner-mark corner-mark-br" />
      <div className="flex items-start justify-between mb-2">
        <div className="uppercase tracking-[0.12em] text-[9px] font-semibold text-slate-500">
          {label}
        </div>
        <div style={{ color }} className="w-7 h-7 opacity-60">
          {SIGILS[sigilKey]}
        </div>
      </div>
      <div
        className={cn(
          "text-2xl font-bold tabular-nums tracking-tight",
          glowClass,
        )}
      >
        <AnimatedNumber
          value={value}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
        />
      </div>
      {sub && (
        <div className="text-[10px] text-slate-500 mt-1 truncate">{sub}</div>
      )}
    </motion.div>
  );
}

// ─── Trade Form ───────────────────────────────────────────────────────────────

interface TradeFormProps {
  form: typeof EMPTY_FORM;
  onChange: (k: string, v: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  isEdit?: boolean;
}

function TradeForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
}: TradeFormProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Date
          </label>
          <DatePicker value={form.date} onChange={(v) => onChange("date", v)} />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Session
          </label>
          <select
            value={form.session}
            onChange={(e) => onChange("session", e.target.value)}
            className="dash-input"
          >
            {SESSIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Trading Pair
          </label>
          <input
            list="tp-list"
            value={form.entry}
            onChange={(e) => onChange("entry", e.target.value)}
            className="dash-input"
            placeholder="e.g. XAUUSD"
          />
          <datalist id="tp-list">
            {TRADING_PAIRS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Lot Size
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.lotSize}
            onChange={(e) => onChange("lotSize", e.target.value)}
            className="dash-input"
            placeholder="0.10"
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Outcome
          </label>
          <div className="flex gap-2">
            {(["Win", "Loss"] as const).map((o) => (
              <motion.button
                key={o}
                whileTap={{ scale: 0.94 }}
                onClick={() => onChange("outcome", o)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-semibold transition-all border tracking-wide",
                  form.outcome === o && o === "Win"
                    ? "bg-[#00ff9d14] border-[#00ff9d55] text-[#00ff9d] shadow-[0_0_12px_#00ff9d22]"
                    : form.outcome === o && o === "Loss"
                      ? "bg-[#ff2d5514] border-[#ff2d5555] text-[#ff2d55] shadow-[0_0_12px_#ff2d5522]"
                      : "border-[rgba(0,217,255,0.1)] text-slate-500 hover:bg-[rgba(0,217,255,0.04)]",
                )}
              >
                {o}
              </motion.button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
            Notes
          </label>
          <input
            list="tn-list"
            value={form.notes}
            onChange={(e) => onChange("notes", e.target.value)}
            className="dash-input"
            placeholder="Trade notes..."
          />
          <datalist id="tn-list">
            {TRADING_NOTES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="col-span-full flex gap-3 justify-end">
          {onCancel && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className="btn-secondary"
            >
              Cancel
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onSubmit}
            className="btn-primary"
          >
            {isEdit ? "Update Trade" : "Add Trade"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Equity Curve Tooltip ─────────────────────────────────────────────────────

function EliteTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#02060e] border border-[rgba(0,217,255,0.25)] rounded-xl px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wider">
        Trade #{label}
      </div>
      <div className="text-[#00d9ff] font-bold tabular-nums text-sm">
        {formatCurrency(payload[0]?.value ?? 0)}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeTab, setActiveTab] = useState<"journal" | "chart" | "settings">(
    "journal",
  );
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [filterOutcome, setFilterOutcome] = useState<"All" | "Win" | "Loss">(
    "All",
  );
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // user preferences provider (persisted separately)
  const userPrefs = useUserSettings();

  // ── Bootstrap from localStorage ──────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object")
          setSettings((p) => ({ ...p, ...parsed }));
      }
    } catch {
      /* corrupt storage — start with defaults */
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TRADES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTrades(parsed);
      }
    } catch {
      /* corrupt storage — start empty */
    }
  }, []);

  // ── Persistence helpers ───────────────────────────────────────────────────
  const saveTrades = useCallback((t: Trade[]) => {
    setTrades(t);
    try {
      localStorage.setItem(STORAGE_KEYS.TRADES, JSON.stringify(t));
    } catch {
      /* quota exceeded */
    }
  }, []);

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s);
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(s));
    } catch {
      /* quota exceeded */
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const recalculated = useMemo(
    () => recalculateAllTrades(trades, settings),
    [trades, settings],
  );
  const metrics = useMemo(
    () => calculateMetrics(recalculated, settings),
    [recalculated, settings],
  );

  const equityData = useMemo(() => {
    const initial =
      settings.challengeType === "zero-step"
        ? Number(settings.masterAccountBalance) || settings.accountBalance
        : settings.accountBalance;
    const pts: { trade: number; equity: number }[] = [
      { trade: 0, equity: initial },
    ];
    recalculated.forEach((t, i) => {
      const eq = Number(t?.equityAfter);
      if (isFinite(eq)) pts.push({ trade: i + 1, equity: eq });
    });
    return pts;
  }, [recalculated, settings]);

  /** Equity Y-axis bounds — derived in a single pass over equityData. */
  const equityBounds = useMemo(() => {
    if (!equityData.length)
      return { min: 0, max: settings.accountBalance * 1.15 };
    const vals = equityData.map((d) => d.equity);
    return {
      min: Math.floor(Math.min(...vals) * 0.994),
      max: Math.ceil(Math.max(...vals) * 1.006),
    };
  }, [equityData, settings.accountBalance]);

  const filteredTrades = useMemo(() => {
    const base =
      filterOutcome === "All"
        ? [...recalculated]
        : recalculated.filter((t) => t.outcome === filterOutcome);
    return sortOrder === "newest" ? [...base].reverse() : base;
  }, [recalculated, filterOutcome, sortOrder]);

  // ── Unified form-field handlers ───────────────────────────────────────────
  const handleFormChange = useMemo(() => makeFormSetter(setForm), []);
  const handleEditFormChange = useMemo(() => makeFormSetter(setEditForm), []);

  // ── Trade CRUD ────────────────────────────────────────────────────────────
  const handleAdd = useCallback(() => {
    if (!form.entry.trim()) {
      alert("Please enter a trading pair.");
      return;
    }
    if (
      !form.lotSize ||
      isNaN(Number(form.lotSize)) ||
      Number(form.lotSize) <= 0
    ) {
      alert("Please enter a valid lot size.");
      return;
    }
    const newTrade: Trade = {
      id: Date.now(),
      date: form.date || today,
      session: form.session,
      entry: form.entry.trim().toUpperCase(),
      lotSize: form.lotSize,
      outcome: form.outcome,
      notes: form.notes,
      riskDollars: "0",
      rewardDollars: "0",
      resultDollars: "0",
      equityAfter: String(settings.accountBalance),
    };
    saveTrades(recalculateAllTrades([...trades, newTrade], settings));
    setForm((p) => ({ ...EMPTY_FORM, date: p.date }));
    setShowAddForm(false);
  }, [form, trades, settings, saveTrades]);

  /** Populate the edit form and mark the target trade as editing. */
  const handleStartEdit = useCallback((trade: Trade) => {
    setEditingId(trade.id);
    setEditForm({
      date: trade.date || today,
      session: trade.session || "London",
      entry: trade.entry || "",
      lotSize: trade.lotSize || "",
      outcome: trade.outcome || "Win",
      notes: trade.notes || "",
    });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editForm.entry.trim()) {
      alert("Please enter a trading pair.");
      return;
    }
    if (
      !editForm.lotSize ||
      isNaN(Number(editForm.lotSize)) ||
      Number(editForm.lotSize) <= 0
    ) {
      alert("Please enter a valid lot size.");
      return;
    }
    saveTrades(
      recalculateAllTrades(
        trades.map((t) =>
          t.id === editingId
            ? { ...t, ...editForm, entry: editForm.entry.trim().toUpperCase() }
            : t,
        ),
        settings,
      ),
    );
    setEditingId(null);
  }, [editForm, editingId, trades, settings, saveTrades]);

  const handleDelete = useCallback(
    (id: number) => {
      saveTrades(
        recalculateAllTrades(
          trades.filter((t) => t.id !== id),
          settings,
        ),
      );
      setDeletingId(null);
    },
    [trades, settings, saveTrades],
  );

  const handleImport = useCallback(
    (importedTrades: Partial<Trade>[]) => {
      const cleaned: Trade[] = importedTrades.map((t, i) => ({
        id: Date.now() + i,
        date: t.date || today,
        session: t.session || "London",
        entry: t.entry || "XAUUSD",
        lotSize: String(t.lotSize || "0"),
        outcome: t.outcome === "Loss" ? "Loss" : "Win",
        notes: t.notes || "",
        riskDollars: "0",
        rewardDollars: "0",
        resultDollars: "0",
        equityAfter: String(settings.accountBalance),
      }));
      saveTrades(recalculateAllTrades(cleaned, settings));
    },
    [settings, saveTrades],
  );

  // ── Settings handlers ─────────────────────────────────────────────────────
  const handleSettingsChange = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) =>
      setSettings((p) => ({ ...p, [key]: value })),
    [],
  );

  const handleRiskPreset = useCallback(
    (preset: "safe" | "balanced" | "aggressive") =>
      setSettings((p) => ({
        ...p,
        riskPreset: preset,
        riskPercent: RISK_PRESETS[preset],
      })),
    [],
  );

  const handleSaveSettings = useCallback(() => {
    if (settings.accountBalance <= 0) {
      alert("Account balance must be positive.");
      return;
    }
    if (settings.riskPercent <= 0) {
      alert("Risk percent must be positive.");
      return;
    }
    saveTrades(recalculateAllTrades(trades, settings));
    saveSettings(settings);
  }, [settings, trades, saveTrades, saveSettings]);

  // ── User preference helpers ─────────────────────────────────────────────
  const applyPreferredDefaults = useCallback(() => {
    const pref = userPrefs.settings;
    if (!pref) return;
    if (pref.safeMode) handleRiskPreset("safe");
    handleSettingsChange("stopLossPips", pref.tpSlPips as unknown as number);
    handleSettingsChange("takeProfitPips", pref.tpSlPips as unknown as number);
    handleSettingsChange(
      "phase1Target",
      pref.targetPercent as unknown as number,
    );
  }, [userPrefs, handleSettingsChange, handleRiskPreset]);

  const saveCurrentAsPreferred = useCallback(() => {
    userPrefs.setSetting("safeMode", settings.riskPreset === "safe");
    userPrefs.setSetting(
      "tpSlPips",
      settings.takeProfitPips as unknown as number,
    );
    userPrefs.setSetting(
      "targetPercent",
      settings.phase1Target as unknown as number,
    );
  }, [userPrefs, settings]);

  const resetPreferences = useCallback(
    () => userPrefs.resetSettings(),
    [userPrefs],
  );

  // ── Render-time scalars ───────────────────────────────────────────────────
  const equityNum = Number(metrics.currentEquity);
  const winRateNum = Number(metrics.winRate);
  const expNum = Number(metrics.expectancy);
  const gradeNum =
    metrics.strategyGrade === "A"
      ? 100
      : metrics.strategyGrade === "B"
        ? 65
        : 35;
  const lotNum = Number(metrics.suggestedLotSize);
  const totalPL = equityNum - settings.accountBalance;
  const isPositive = totalPL >= 0;
  const riskDollar = (equityNum * settings.riskPercent) / 100;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.34, 1.2, 0.64, 1] }}
        className="mb-7"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="status-dot" />
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-mono">
                SYSTEM ACTIVE
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
              <span className="glow-cyan animate-flicker">PROP FIRM</span>{" "}
              <span className="text-slate-200">COMMAND</span>
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] text-slate-500 font-mono">
                FundingPips Challenge Tracker
              </span>
              <span className="text-slate-700">·</span>
              <span className="text-[11px] text-slate-600 font-mono">
                {new Date()
                  .toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </span>
            </div>
          </div>

          {/* Phase badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.3,
              duration: 0.6,
              ease: [0.34, 1.56, 0.64, 1],
            }}
            className={cn(
              "px-5 py-2.5 rounded-xl font-black text-sm tracking-[0.1em] border",
              metrics.currentPhase === "Master"
                ? "bg-[rgba(255,208,71,0.08)] border-[rgba(255,208,71,0.3)]  text-[#ffd047] animate-pulse-gold"
                : metrics.currentPhase === "Phase2"
                  ? "bg-[rgba(176,108,255,0.08)] border-[rgba(176,108,255,0.3)] text-[#b06cff]"
                  : "bg-[rgba(0,217,255,0.06)]   border-[rgba(0,217,255,0.25)]  text-[#00d9ff]",
            )}
          >
            {metrics.currentPhase === "Master"
              ? "⬡ MASTER ACCOUNT"
              : metrics.currentPhase === "Phase2"
                ? "◈ PHASE 2"
                : "▦ PHASE 1"}
          </motion.div>
        </div>

        {/* Drawdown alert */}
        <AnimatePresence>
          {metrics.drawdownWarning && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-4 p-4 bg-[rgba(255,45,85,0.08)] border border-[rgba(255,45,85,0.4)] rounded-xl flex items-center gap-4 animate-pulse-red"
            >
              <div className="text-[#ff2d55] text-xl font-black">⚠</div>
              <div>
                <p className="text-[#ff2d55] font-bold text-sm tracking-wide">
                  DAILY DRAWDOWN BREACH
                </p>
                <p className="text-[rgba(255,45,85,0.7)] text-xs mt-0.5">
                  Drawdown at {metrics.dailyDrawdown}% — Limit:{" "}
                  {settings.dailyDrawdownLimit}% — Consider halting operations
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Metric grid ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        <MetricCard
          index={0}
          label="Current Equity"
          value={equityNum}
          prefix="$"
          decimals={2}
          sigilKey="equity"
          color="#00d9ff"
          glowClass={
            equityNum >= settings.accountBalance ? "glow-green" : "glow-red"
          }
          sub={`Start ${formatCurrency(settings.accountBalance)}`}
        />
        <MetricCard
          index={1}
          label="Total Trades"
          value={metrics.totalTrades}
          decimals={0}
          sigilKey="trades"
          color="#00d9ff"
          glowClass="text-slate-100"
          sub={`${metrics.wins}W  ${metrics.losses}L`}
        />
        <MetricCard
          index={2}
          label="Win Rate"
          value={winRateNum}
          suffix="%"
          decimals={2}
          sigilKey="winrate"
          color={winRateNum >= 50 ? "#00ff9d" : "#ff2d55"}
          glowClass={winRateNum >= 50 ? "glow-green" : "glow-red"}
          sub={
            winRateNum >= 60
              ? "Strong edge"
              : winRateNum >= 50
                ? "Positive edge"
                : "Below threshold"
          }
        />
        <MetricCard
          index={3}
          label="Expectancy"
          value={expNum}
          suffix=" pips"
          decimals={2}
          sigilKey="expectancy"
          color={expNum >= 0 ? "#00ff9d" : "#ff2d55"}
          glowClass={expNum >= 0 ? "glow-green" : "glow-red"}
          sub="Per trade avg"
        />
        <MetricCard
          index={4}
          label="Strategy Grade"
          value={gradeNum}
          suffix={` — ${metrics.strategyGrade}`}
          decimals={0}
          sigilKey="grade"
          color={
            metrics.strategyGrade === "A"
              ? "#00ff9d"
              : metrics.strategyGrade === "B"
                ? "#ffd047"
                : "#ff2d55"
          }
          glowClass={
            metrics.strategyGrade === "A"
              ? "glow-green"
              : metrics.strategyGrade === "B"
                ? "glow-gold"
                : "glow-red"
          }
          sub={
            metrics.strategyGrade === "A"
              ? "Excellent"
              : metrics.strategyGrade === "B"
                ? "Solid"
                : "Rebuild"
          }
        />
        <MetricCard
          index={5}
          label="Suggested Lot"
          value={lotNum}
          decimals={2}
          sigilKey="lot"
          color="#b06cff"
          glowClass="glow-purple"
          sub={`${settings.riskPercent}% = ${formatCurrency(riskDollar)}`}
        />
      </div>

      {/* ── P/L Banner ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="dash-card mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex items-center gap-4">
          {[
            {
              label: "Net P / L",
              value: formatSign(totalPL),
              cls: isPositive ? "glow-green" : "glow-red",
              size: "text-2xl font-black",
            },
            {
              label: "Return %",
              value:
                settings.accountBalance > 0
                  ? `${isPositive ? "+" : ""}${((totalPL / settings.accountBalance) * 100).toFixed(2)}%`
                  : "—",
              cls: isPositive ? "glow-green" : "glow-red",
              size: "text-xl font-bold",
            },
            {
              label: "Daily DD",
              value: `${metrics.dailyDrawdown}%`,
              cls: metrics.drawdownWarning ? "glow-red" : "text-slate-300",
              size: "text-xl font-bold",
            },
          ].map(({ label, value, cls, size }, i) => (
            <div key={label} className="flex items-center gap-4">
              {i > 0 && <div className="w-px h-10 bg-[rgba(0,217,255,0.1)]" />}
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-[0.15em] mb-0.5">
                  {label}
                </div>
                <div className={cn("tabular-nums", size, cls)}>{value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-slate-600 font-mono tracking-widest">
          {recalculated.length} TRADES LOGGED
        </div>
      </motion.div>

      {/* ── Challenge progress ──────────────────────── */}
      {settings.challengeType !== "zero-step" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="dash-card mb-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] font-semibold">
              Challenge Progress
            </div>
            <div
              className={cn(
                "text-xs font-semibold",
                metrics.currentPhase === "Master"
                  ? "glow-gold"
                  : metrics.currentPhase === "Phase2"
                    ? "glow-purple"
                    : "glow-cyan",
              )}
            >
              {metrics.currentPhase === "Master"
                ? "✓ CHALLENGE PASSED"
                : `TARGET ${formatCurrency(metrics.phaseTarget)}`}
            </div>
          </div>
          <div
            className={cn(
              "grid gap-5",
              settings.challengeType === "two-step"
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1",
            )}
          >
            {[
              settings.challengeType !== "one-step"
                ? null
                : {
                    label: `Phase 1 — ${settings.phase1Target}% target`,
                    pct: metrics.phase1Progress,
                    from: settings.accountBalance,
                    to: metrics.phase1Target,
                    grad: "linear-gradient(90deg,#005fa3,#00d9ff)",
                  },
              settings.challengeType === "two-step"
                ? {
                    label: `Phase 1 — ${settings.phase1Target}% target`,
                    pct: metrics.phase1Progress,
                    from: settings.accountBalance,
                    to: metrics.phase1Target,
                    grad: "linear-gradient(90deg,#005fa3,#00d9ff)",
                  }
                : null,
              settings.challengeType === "two-step"
                ? {
                    label: `Phase 2 — ${settings.phase2Target}% target`,
                    pct: metrics.phase2Progress,
                    from: metrics.phase1Target,
                    to: metrics.phase2Target,
                    grad: "linear-gradient(90deg,#5b21b6,#b06cff)",
                  }
                : null,
            ]
              .filter(Boolean)
              .map((row) => {
                const r = row!;
                return (
                  <div key={r.label}>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-2">
                      <span className="uppercase tracking-wider">
                        {r.label}
                      </span>
                      <span
                        style={{ color: r.pct >= 100 ? "#00ff9d" : "#00d9ff" }}
                        className="font-bold"
                      >
                        {Math.min(r.pct, 100).toFixed(1)}%
                      </span>
                    </div>
                    <EliteProgress value={r.pct} color={r.grad} />
                    <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1.5">
                      <span>{formatCurrency(r.from)}</span>
                      <span>{formatCurrency(r.to)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Monthly target (master phase) */}
      {(metrics.currentPhase === "Master" ||
        settings.challengeType === "zero-step") &&
        Number(settings.monthlyTarget) > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="dash-card mb-5"
          >
            <div className="flex justify-between items-center mb-3">
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] font-semibold">
                Monthly Target
              </div>
              <span className="glow-gold text-xs font-bold">
                {metrics.monthlyTargetProgress}%
              </span>
            </div>
            <EliteProgress
              value={Number(metrics.monthlyTargetProgress)}
              color="linear-gradient(90deg,#a16207,#ffd047)"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1.5">
              <span>{formatCurrency(metrics.monthlyStartingBalance)}</span>
              <span>+{formatCurrency(metrics.monthlyTargetAmount)}</span>
            </div>
          </motion.div>
        )}

      {/* ── Tab bar ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
        className="flex gap-1.5 mb-4"
      >
        {TABS.map((tab) => (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 rounded-xl text-xs font-semibold tracking-[0.08em] transition-all border flex items-center gap-2 uppercase",
              activeTab === tab.id
                ? "bg-[rgba(0,217,255,0.1)] border-[rgba(0,217,255,0.4)] text-[#00d9ff] shadow-[0_0_16px_rgba(0,217,255,0.15)]"
                : "bg-[rgba(3,10,22,0.7)] border-[rgba(0,217,255,0.08)] text-slate-500 hover:text-slate-300 hover:border-[rgba(0,217,255,0.18)]",
            )}
          >
            <span className="text-xs opacity-70">{tab.icon}</span>
            {tab.label}
          </motion.button>
        ))}
      </motion.div>

      {/* ── Tab content ────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* ── Journal ──────────────────────────────── */}
        {activeTab === "journal" && (
          <motion.div
            key="journal"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="dash-card">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="btn-primary"
                  >
                    {showAddForm ? "✕ Close" : "+ Add Trade"}
                  </motion.button>
                  {[
                    { label: "↓ CSV", fn: () => exportToCSV(recalculated) },
                    {
                      label: "↓ Excel",
                      fn: () => exportToExcel(recalculated, settings),
                    },
                    {
                      label: "↑ Upload Excel",
                      fn: () => uploadToExistingExcel(recalculated, settings),
                    },
                    {
                      label: "↑ Import Excel",
                      fn: () => importFromExcel(handleImport),
                    },
                  ].map(({ label, fn }) => (
                    <motion.button
                      key={label}
                      whileTap={{ scale: 0.95 }}
                      onClick={fn}
                      className="btn-secondary"
                    >
                      {label}
                    </motion.button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterOutcome}
                    onChange={(e) =>
                      setFilterOutcome(e.target.value as typeof filterOutcome)
                    }
                    className="dash-input w-auto text-xs"
                  >
                    <option>All</option>
                    <option>Win</option>
                    <option>Loss</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as typeof sortOrder)
                    }
                    className="dash-input w-auto text-xs"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                </div>
              </div>

              <AnimatePresence>
                {showAddForm && (
                  <div className="mt-4 pt-4 border-t border-[rgba(0,217,255,0.08)]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] mb-3">
                      New Position
                    </div>
                    <TradeForm
                      form={form}
                      onChange={handleFormChange}
                      onSubmit={handleAdd}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Trade table */}
            <div className="dash-card overflow-hidden p-0">
              <div className="overflow-x-auto scrollbar-elite">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(0,217,255,0.08)]">
                      {[
                        "Date",
                        "Session",
                        "Pair",
                        "Lot",
                        "Result",
                        "Risk $",
                        "P/L $",
                        "Equity",
                        "Notes",
                        "Actions",
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={cn(
                            "py-3 px-3 text-[10px] text-slate-500 uppercase tracking-[0.14em] font-semibold",
                            i === 8
                              ? "hidden md:table-cell text-left"
                              : i === 9
                                ? "text-center"
                                : i >= 5
                                  ? "text-right"
                                  : "text-left",
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{
                              repeat: Infinity,
                              duration: 3,
                              ease: "easeInOut",
                            }}
                          >
                            <div className="text-4xl mb-3 opacity-20">◈</div>
                            <div className="text-slate-600 text-xs uppercase tracking-widest">
                              No positions logged
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    ) : (
                      filteredTrades.map((trade, idx) => (
                        <motion.tr
                          key={trade.id}
                          className="trade-row border-b border-[rgba(0,217,255,0.04)]"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(idx * 0.025, 0.4) }}
                        >
                          {editingId === trade.id ? (
                            <td
                              colSpan={10}
                              className="py-4 px-4 bg-[rgba(0,20,45,0.6)]"
                            >
                              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">
                                Edit Position
                              </div>
                              <TradeForm
                                form={editForm}
                                onChange={handleEditFormChange}
                                onSubmit={handleSaveEdit}
                                onCancel={() => setEditingId(null)}
                                isEdit
                              />
                            </td>
                          ) : deletingId === trade.id ? (
                            <td
                              colSpan={10}
                              className="py-3 px-4 bg-[rgba(255,45,85,0.06)] border-l-2 border-[#ff2d55]"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-[#ff2d55] text-xs">
                                  Delete {trade.entry} on {trade.date}?
                                </span>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleDelete(trade.id)}
                                  className="px-3 py-1 text-xs bg-[rgba(255,45,85,0.2)] border border-[rgba(255,45,85,0.4)] text-[#ff2d55] rounded-lg"
                                >
                                  Confirm
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setDeletingId(null)}
                                  className="btn-secondary text-xs px-3 py-1"
                                >
                                  Cancel
                                </motion.button>
                              </div>
                            </td>
                          ) : (
                            <>
                              <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {trade.date}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {trade.session}
                              </td>
                              <td className="py-2.5 px-3 text-slate-100 font-semibold tracking-wider">
                                {trade.entry}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                                {trade.lotSize}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span
                                  className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider",
                                    trade.outcome === "Win"
                                      ? "bg-[rgba(0,255,157,0.1)] text-[#00ff9d] border border-[rgba(0,255,157,0.2)]"
                                      : "bg-[rgba(255,45,85,0.1)]  text-[#ff2d55] border border-[rgba(255,45,85,0.2)]",
                                  )}
                                >
                                  {trade.outcome.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-mono text-[11px]">
                                {formatCurrency(trade.riskDollars)}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 px-3 text-right font-bold font-mono",
                                  Number(trade.resultDollars) >= 0
                                    ? "text-[#00ff9d]"
                                    : "text-[#ff2d55]",
                                )}
                              >
                                {Number(trade.resultDollars) >= 0 ? "+" : ""}
                                {formatCurrency(trade.resultDollars)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-300 font-mono text-[11px]">
                                {formatCurrency(trade.equityAfter)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-[160px] truncate hidden md:table-cell text-[11px]">
                                {trade.notes}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex gap-1 justify-center">
                                  <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleStartEdit(trade)}
                                    className="p-1.5 rounded-lg border border-[rgba(0,217,255,0.15)] text-[#00d9ff] hover:bg-[rgba(0,217,255,0.08)] transition-colors"
                                  >
                                    ✏
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setDeletingId(trade.id)}
                                    className="p-1.5 rounded-lg border border-[rgba(255,45,85,0.15)] text-[#ff2d55] hover:bg-[rgba(255,45,85,0.08)] transition-colors"
                                  >
                                    ✕
                                  </motion.button>
                                </div>
                              </td>
                            </>
                          )}
                        </motion.tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredTrades.length > 0 && (
                <div className="px-4 py-3 border-t border-[rgba(0,217,255,0.06)] flex flex-wrap gap-5 text-[10px] font-mono">
                  <span className="text-slate-600">
                    {filteredTrades.length} POSITIONS
                  </span>
                  <span className="text-[#00ff9d]">
                    {filteredTrades.filter((t) => t.outcome === "Win").length}{" "}
                    WINS
                  </span>
                  <span className="text-[#ff2d55]">
                    {filteredTrades.filter((t) => t.outcome === "Loss").length}{" "}
                    LOSSES
                  </span>
                  <span
                    className={
                      filteredTrades.reduce(
                        (s, t) => s + Number(t.resultDollars),
                        0,
                      ) >= 0
                        ? "text-[#00ff9d]"
                        : "text-[#ff2d55]"
                    }
                  >
                    NET:{" "}
                    {formatSign(
                      filteredTrades.reduce(
                        (s, t) => s + Number(t.resultDollars),
                        0,
                      ),
                    )}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Equity Curve ─────────────────────────── */}
        {activeTab === "chart" && (
          <motion.div
            key="chart"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="dash-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] mb-1">
                  Equity Curve
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "text-xl font-black tabular-nums",
                      isPositive ? "glow-green" : "glow-red",
                    )}
                  >
                    {formatCurrency(metrics.currentEquity)}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isPositive ? "text-[#00ff9d]" : "text-[#ff2d55]",
                    )}
                  >
                    {formatSign(totalPL)}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-slate-600">
                <span>
                  <span className="text-slate-500">START </span>
                  {formatCurrency(
                    equityData[0]?.equity ?? settings.accountBalance,
                  )}
                </span>
                <span>
                  <span className="text-slate-500">TRADES </span>
                  {recalculated.length}
                </span>
              </div>
            </div>

            {equityData.length <= 1 ? (
              <div className="flex flex-col items-center justify-center py-24 text-slate-700">
                <motion.div
                  className="text-5xl mb-4 opacity-20"
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "easeInOut",
                  }}
                >
                  ◈
                </motion.div>
                <p className="text-xs uppercase tracking-widest">
                  Awaiting position data
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={380}>
                <AreaChart
                  data={equityData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="egGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#00d9ff"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="100%"
                        stopColor="#00d9ff"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="1 6"
                    stroke="rgba(0,217,255,0.06)"
                  />
                  <XAxis
                    dataKey="trade"
                    stroke="rgba(0,100,150,0.4)"
                    tick={{
                      fill: "#334155",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <YAxis
                    stroke="rgba(0,100,150,0.4)"
                    tick={{
                      fill: "#334155",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                    domain={[equityBounds.min, equityBounds.max]}
                    tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                    width={85}
                  />
                  <Tooltip content={<EliteTooltip />} />
                  <ReferenceLine
                    y={settings.accountBalance}
                    stroke="rgba(100,150,200,0.3)"
                    strokeDasharray="4 3"
                    label={{
                      value: "START",
                      fill: "#334155",
                      fontSize: 9,
                      letterSpacing: "0.1em",
                    }}
                  />
                  {settings.challengeType !== "zero-step" &&
                    Number(metrics.phase1Target) > 0 && (
                      <ReferenceLine
                        y={Number(metrics.phase1Target)}
                        stroke="rgba(0,217,255,0.35)"
                        strokeDasharray="4 3"
                        label={{ value: "P1", fill: "#00d9ff", fontSize: 9 }}
                      />
                    )}
                  {settings.challengeType === "two-step" &&
                    Number(metrics.phase2Target) > 0 && (
                      <ReferenceLine
                        y={Number(metrics.phase2Target)}
                        stroke="rgba(176,108,255,0.4)"
                        strokeDasharray="4 3"
                        label={{ value: "P2", fill: "#b06cff", fontSize: 9 }}
                      />
                    )}
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#00d9ff"
                    strokeWidth={2}
                    fill="url(#egGrad)"
                    dot={
                      equityData.length < 40
                        ? {
                            r: 3,
                            fill: "#00d9ff",
                            stroke: "#02060e",
                            strokeWidth: 1.5,
                          }
                        : false
                    }
                    activeDot={{
                      r: 6,
                      fill: "#00d9ff",
                      stroke: "#02060e",
                      strokeWidth: 2,
                      filter: "url(#glow)",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        )}

        {/* ── Settings ─────────────────────────────── */}
        {activeTab === "settings" && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="dash-card space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] font-semibold">
                Challenge Configuration
              </div>
              <AnimatePresence>
                {savedMsg && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-[#00ff9d] text-xs font-mono tracking-widest glow-green"
                  >
                    ✓ SAVED
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            {/* User preferences — persisted separately and suggested as defaults */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-[0.18em] font-semibold mb-2">
                User Preferences
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Safe Mode
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="pref-safe"
                      type="checkbox"
                      checked={userPrefs.settings.safeMode}
                      onChange={(e) =>
                        userPrefs.setSetting("safeMode", e.target.checked)
                      }
                    />
                    <label
                      htmlFor="pref-safe"
                      className="text-sm text-slate-300"
                    >
                      Prefer safe preset (low risk)
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Default TP/SL (pips)
                  </label>
                  <input
                    type="number"
                    className="dash-input"
                    value={userPrefs.settings.tpSlPips}
                    onChange={(e) =>
                      userPrefs.setSetting("tpSlPips", Number(e.target.value))
                    }
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Preferred Target (%)
                  </label>
                  <input
                    type="number"
                    className="dash-input"
                    value={userPrefs.settings.targetPercent}
                    onChange={(e) =>
                      userPrefs.setSetting(
                        "targetPercent",
                        Number(e.target.value),
                      )
                    }
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={applyPreferredDefaults}
                  className="btn-primary"
                >
                  Apply Preferred Defaults
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={saveCurrentAsPreferred}
                  className="btn-secondary"
                >
                  Save Current as Preferred
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={resetPreferences}
                  className="btn-secondary"
                >
                  Reset Preferences
                </motion.button>
              </div>
            </div>

            {/* Challenge type */}
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                Challenge Type
              </div>
              <div className="flex flex-wrap gap-2">
                {(["two-step", "one-step", "zero-step"] as const).map(
                  (type) => (
                    <motion.button
                      key={type}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        handleSettingsChange("challengeType", type)
                      }
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-semibold tracking-[0.08em] transition-all border uppercase",
                        settings.challengeType === type
                          ? "bg-[rgba(0,217,255,0.1)] border-[rgba(0,217,255,0.4)] text-[#00d9ff] shadow-[0_0_14px_rgba(0,217,255,0.15)]"
                          : "border-[rgba(0,217,255,0.1)] text-slate-500 hover:border-[rgba(0,217,255,0.25)] hover:text-slate-300",
                      )}
                    >
                      {type === "two-step"
                        ? "Two-Step"
                        : type === "one-step"
                          ? "One-Step"
                          : "Zero-Step"}
                    </motion.button>
                  ),
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Account balance */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Account Balance ($)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.accountBalance}
                  onChange={(e) =>
                    handleSettingsChange(
                      "accountBalance",
                      Number(e.target.value),
                    )
                  }
                  step="1000"
                  min="1000"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {CHALLENGE_ACCOUNTS.map((a) => (
                    <motion.button
                      key={a}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => handleSettingsChange("accountBalance", a)}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[10px] border transition-all",
                        settings.accountBalance === a
                          ? "bg-[rgba(0,217,255,0.12)] border-[rgba(0,217,255,0.35)] text-[#00d9ff]"
                          : "border-[rgba(0,217,255,0.08)] text-slate-600 hover:text-slate-400 hover:border-[rgba(0,217,255,0.2)]",
                      )}
                    >
                      ${(a / 1000).toFixed(0)}K
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Risk preset */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Risk Preset
                </label>
                <div className="flex gap-1.5">
                  {(
                    Object.keys(PRESET_STYLES) as Array<
                      keyof typeof PRESET_STYLES
                    >
                  ).map((p) => {
                    const s = PRESET_STYLES[p];
                    const active = settings.riskPreset === p;
                    return (
                      <motion.button
                        key={p}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => handleRiskPreset(p)}
                        className="flex-1 py-2.5 rounded-xl text-[10px] font-bold tracking-widest transition-all border uppercase flex flex-col items-center gap-0.5"
                        style={
                          active
                            ? {
                                background: s.bg,
                                borderColor: s.border,
                                color: s.text,
                              }
                            : {
                                borderColor: "rgba(0,217,255,0.1)",
                                color: "#64748b",
                              }
                        }
                      >
                        {p}
                        <br />
                        <span className="opacity-60">{RISK_PRESETS[p]}%</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Custom risk % */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Custom Risk % / Trade
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.riskPercent}
                  onChange={(e) =>
                    handleSettingsChange("riskPercent", Number(e.target.value))
                  }
                  step="0.05"
                  min="0.05"
                  max="5"
                />
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  = {formatCurrency(riskDollar)} on current equity
                </p>
              </div>

              {/* SL */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Stop Loss (pips)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.stopLossPips}
                  onChange={(e) =>
                    handleSettingsChange("stopLossPips", Number(e.target.value))
                  }
                  step="1"
                  min="1"
                />
              </div>

              {/* TP */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Take Profit (pips)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.takeProfitPips}
                  onChange={(e) =>
                    handleSettingsChange(
                      "takeProfitPips",
                      Number(e.target.value),
                    )
                  }
                  step="1"
                  min="1"
                />
                {settings.stopLossPips > 0 && (
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    R:R = 1:
                    {(settings.takeProfitPips / settings.stopLossPips).toFixed(
                      2,
                    )}
                  </p>
                )}
              </div>

              {/* Phase 1 target */}
              {settings.challengeType !== "zero-step" && (
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Phase 1 Target (%)
                  </label>
                  <input
                    type="number"
                    className="dash-input"
                    value={settings.phase1Target}
                    onChange={(e) =>
                      handleSettingsChange(
                        "phase1Target",
                        Number(e.target.value),
                      )
                    }
                    step="0.5"
                    min="0.5"
                    max="20"
                  />
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    ={" "}
                    {formatCurrency(
                      settings.accountBalance *
                        (1 + settings.phase1Target / 100),
                    )}
                  </p>
                </div>
              )}

              {/* Phase 2 target */}
              {settings.challengeType === "two-step" && (
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                    Phase 2 Target (%)
                  </label>
                  <input
                    type="number"
                    className="dash-input"
                    value={settings.phase2Target}
                    onChange={(e) =>
                      handleSettingsChange(
                        "phase2Target",
                        Number(e.target.value),
                      )
                    }
                    step="0.5"
                    min="0.5"
                    max="20"
                  />
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    ={" "}
                    {formatCurrency(
                      settings.accountBalance *
                        (1 + settings.phase1Target / 100) *
                        (1 + settings.phase2Target / 100),
                    )}
                  </p>
                </div>
              )}

              {/* Daily drawdown limit */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Daily Drawdown Limit (%)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.dailyDrawdownLimit}
                  onChange={(e) =>
                    handleSettingsChange(
                      "dailyDrawdownLimit",
                      Number(e.target.value),
                    )
                  }
                  step="0.5"
                  min="0.5"
                  max="20"
                />
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  Max daily loss:{" "}
                  {formatCurrency(
                    (equityNum * settings.dailyDrawdownLimit) / 100,
                  )}
                </p>
              </div>

              {/* Master account balance */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Master Account Balance ($)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.masterAccountBalance}
                  onChange={(e) =>
                    handleSettingsChange(
                      "masterAccountBalance",
                      Number(e.target.value),
                    )
                  }
                  step="1000"
                  min="0"
                />
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  Balance upon challenge pass
                </p>
              </div>

              {/* Monthly target */}
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">
                  Monthly Target $ (Master)
                </label>
                <input
                  type="number"
                  className="dash-input"
                  value={settings.monthlyTarget}
                  onChange={(e) =>
                    handleSettingsChange(
                      "monthlyTarget",
                      Number(e.target.value),
                    )
                  }
                  step="100"
                  min="0"
                />
                <p className="text-[10px] text-slate-600 font-mono mt-1">
                  Set 0 to disable tracking
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[rgba(0,217,255,0.08)] flex gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleSaveSettings}
                className="btn-primary"
              >
                Save & Recalculate
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  if (!confirm("Reset all settings to defaults?")) return;
                  setSettings(DEFAULT_SETTINGS);
                }}
                className="btn-secondary"
              >
                Reset Defaults
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-10 flex items-center justify-center gap-3"
      >
        <div className="h-px w-16 bg-gradient-to-r from-transparent to-[rgba(0,217,255,0.15)]" />
        <span className="text-[10px] text-slate-700 uppercase tracking-[0.2em] font-mono">
          Prop Firm Command · {recalculated.length} positions · Local storage
        </span>
        <div className="h-px w-16 bg-gradient-to-l from-transparent to-[rgba(0,217,255,0.15)]" />
      </motion.div>
    </div>
  );
}

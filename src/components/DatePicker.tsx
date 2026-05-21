import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DatePickerProps {
  value: string;
  onChange: (val: string) => void;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const [show, setShow] = useState(false);
  const [current, setCurrent] = useState(() => value ? new Date(value + "T12:00:00") : new Date());
  const today = new Date();
  const selected = value ? new Date(value + "T12:00:00") : null;

  const getDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    return new Date(current.getFullYear(), current.getMonth(), day).toDateString() === today.toDateString();
  };

  const isSelected = (day: number | null) => {
    if (!day || !selected) return false;
    return new Date(current.getFullYear(), current.getMonth(), day).toDateString() === selected.toDateString();
  };

  const handleSelect = (day: number | null) => {
    if (!day) return;
    const d = new Date(current.getFullYear(), current.getMonth(), day);
    onChange(d.toISOString().split("T")[0]);
    setShow(false);
  };

  const nav = (dir: number) =>
    setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));

  return (
    <div className="relative">
      <button
        type="button"
        className="dash-input w-full text-left flex items-center justify-between gap-2 cursor-pointer"
        onClick={() => setShow(!show)}
      >
        <span className={value ? "text-slate-200 font-mono text-xs tracking-wider" : "text-slate-600 text-xs"}>
          {value || "Select date"}
        </span>
        <svg className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="3" width="14" height="12" rx="2" />
          <path d="M1 7h14M5 1v4M11 1v4" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {show && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute z-50 mt-1.5 bg-[#02060e] border border-[rgba(0,217,255,0.2)] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(0,217,255,0.08)] p-4 w-72 backdrop-blur-2xl"
              style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,217,255,0.1), 0 0 30px rgba(0,217,255,0.06)" }}
            >
              {/* Corner marks */}
              <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[rgba(0,217,255,0.4)] rounded-tl" />
              <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[rgba(0,217,255,0.4)] rounded-tr" />
              <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[rgba(0,217,255,0.4)] rounded-bl" />
              <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[rgba(0,217,255,0.4)] rounded-br" />

              {/* Month nav */}
              <div className="flex justify-between items-center mb-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => nav(-1)}
                  className="p-1.5 rounded-lg border border-[rgba(0,217,255,0.1)] text-slate-500 hover:text-[#00d9ff] hover:border-[rgba(0,217,255,0.3)] transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M8 2L4 6l4 4" />
                  </svg>
                </motion.button>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-[0.12em] font-mono">
                  {MONTHS[current.getMonth()].slice(0,3)} {current.getFullYear()}
                </span>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => nav(1)}
                  className="p-1.5 rounded-lg border border-[rgba(0,217,255,0.1)] text-slate-500 hover:text-[#00d9ff] hover:border-[rgba(0,217,255,0.3)] transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 2l4 4-4 4" />
                  </svg>
                </motion.button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-[9px] text-slate-600 uppercase tracking-wider py-1 font-mono">{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {getDays(current).map((day, idx) => (
                  <motion.button
                    key={idx}
                    whileTap={day ? { scale: 0.88 } : {}}
                    onClick={() => handleSelect(day)}
                    className={
                      day === null ? "invisible p-1.5" :
                      isSelected(day)
                        ? "p-1.5 rounded-lg bg-[rgba(0,217,255,0.15)] text-[#00d9ff] text-xs font-bold border border-[rgba(0,217,255,0.4)] shadow-[0_0_10px_rgba(0,217,255,0.2)]"
                      : isToday(day)
                        ? "p-1.5 rounded-lg bg-[rgba(0,217,255,0.06)] text-[#00d9ff] text-xs font-semibold border border-[rgba(0,217,255,0.2)]"
                      : "p-1.5 rounded-lg text-slate-500 text-xs hover:bg-[rgba(0,217,255,0.06)] hover:text-slate-200 transition-colors"
                    }
                  >
                    {day}
                  </motion.button>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-[rgba(0,217,255,0.08)] flex justify-between">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const t = new Date();
                    onChange(t.toISOString().split("T")[0]);
                    setCurrent(t);
                    setShow(false);
                  }}
                  className="px-3 py-1 text-[10px] font-mono tracking-widest uppercase bg-[rgba(0,217,255,0.08)] border border-[rgba(0,217,255,0.25)] text-[#00d9ff] rounded-lg hover:bg-[rgba(0,217,255,0.14)] transition-colors"
                >
                  Today
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShow(false)}
                  className="px-3 py-1 text-[10px] font-mono tracking-widest uppercase border border-[rgba(0,217,255,0.08)] text-slate-600 rounded-lg hover:text-slate-400 transition-colors"
                >
                  Close
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

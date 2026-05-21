import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Settings = {
  safeMode: boolean;
  tpSlPips: number;
  targetPercent: number;
};

type Persisted = {
  values: Partial<Record<string, any>>;
  usage: Record<string, Record<string, number>>;
  lastUsed?: Record<string, number>;
};

const STORAGE_KEY = "pf_user_settings_v1";

const DEFAULT_SETTINGS: Settings = {
  safeMode: true,
  tpSlPips: 10,
  targetPercent: 10,
};

interface UserSettingsContextValue {
  settings: Settings;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  resetSettings(): void;
  getMostUsed<K extends keyof Settings>(key: K): Settings[K] | undefined;
}

const UserSettingsContext = createContext<UserSettingsContextValue | undefined>(
  undefined,
);

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { values: {}, usage: {} };
    return JSON.parse(raw) as Persisted;
  } catch {
    return { values: {}, usage: {} };
  }
}

function savePersisted(persisted: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore storage errors
  }
}

function mostUsedValue(persisted: Persisted, key: string) {
  const usage = persisted.usage?.[key];
  if (!usage) return undefined;
  let best: string | null = null;
  let bestCount = -1;
  for (const k in usage) {
    const c = usage[k] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  if (best == null) return undefined;
  try {
    return JSON.parse(best);
  } catch {
    return best;
  }
}

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const persisted = loadPersisted();
    const values = persisted.values ?? {};
    return {
      safeMode:
        values.safeMode ??
        mostUsedValue(persisted, "safeMode") ??
        DEFAULT_SETTINGS.safeMode,
      tpSlPips:
        values.tpSlPips ??
        mostUsedValue(persisted, "tpSlPips") ??
        DEFAULT_SETTINGS.tpSlPips,
      targetPercent:
        values.targetPercent ??
        mostUsedValue(persisted, "targetPercent") ??
        DEFAULT_SETTINGS.targetPercent,
    } as Settings;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = loadPersisted();
    persisted.values = { ...(persisted.values ?? {}), ...settings };
    persisted.usage = persisted.usage ?? {};
    savePersisted(persisted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: value } as Settings;
      try {
        const persisted = loadPersisted();
        persisted.values = { ...(persisted.values ?? {}), [key]: value };
        persisted.usage = persisted.usage ?? {};
        const valueKey = JSON.stringify(value);
        persisted.usage[key as string] = persisted.usage[key as string] ?? {};
        persisted.usage[key as string][valueKey] =
          (persisted.usage[key as string][valueKey] ?? 0) + 1;
        persisted.lastUsed = persisted.lastUsed ?? {};
        persisted.lastUsed[key as string] = Date.now();
        savePersisted(persisted);
      } catch {
        // ignore
      }
      return next;
    });
  }

  function resetSettings() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setSettingsState(DEFAULT_SETTINGS);
  }

  function getMostUsed<K extends keyof Settings>(
    key: K,
  ): Settings[K] | undefined {
    try {
      const persisted = loadPersisted();
      return mostUsedValue(persisted, key as string) as Settings[K] | undefined;
    } catch {
      return undefined;
    }
  }

  const ctxValue: UserSettingsContextValue = {
    settings,
    setSetting,
    resetSettings,
    getMostUsed,
  };

  return (
    <UserSettingsContext.Provider value={ctxValue}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  const ctx = useContext(UserSettingsContext);
  if (!ctx)
    throw new Error(
      "useUserSettings must be used within a UserSettingsProvider",
    );
  return ctx;
}

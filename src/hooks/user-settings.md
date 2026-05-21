# useUserSettings — usage

This file documents the `UserSettingsProvider` and `useUserSettings()` hook implemented in `src/hooks/user-settings.tsx`.

Overview

- Persists user preferences to `localStorage` under the key `pf_user_settings_v1`.
- Tracks usage counts per value so the most-used value can be inferred as a fallback.
- Exposes `settings`, `setSetting()`, `resetSettings()`, and `getMostUsed()`.

Files

- Provider + hook: `src/hooks/user-settings.tsx`

Quick start

1. Ensure the app is wrapped with the provider (already done in `src/App.tsx`):

```tsx
import { UserSettingsProvider } from "@/hooks/user-settings";

export default function App() {
  return <UserSettingsProvider>{/* ... */}</UserSettingsProvider>;
}
```

2. Use the hook inside any component:

```tsx
import { useUserSettings } from "@/hooks/user-settings";

export default function SettingsExample() {
  const { settings, setSetting, resetSettings, getMostUsed } =
    useUserSettings();

  return (
    <div>
      <div>Safe mode: {settings.safeMode ? "on" : "off"}</div>
      <button onClick={() => setSetting("safeMode", !settings.safeMode)}>
        Toggle Safe Mode
      </button>

      <div>
        TP/SL pips:{" "}
        <input
          type="number"
          value={settings.tpSlPips}
          onChange={(e) => setSetting("tpSlPips", Number(e.target.value))}
        />
      </div>

      <div>
        Target %:{" "}
        <input
          type="number"
          value={settings.targetPercent}
          onChange={(e) => setSetting("targetPercent", Number(e.target.value))}
        />
      </div>

      <button onClick={() => resetSettings()}>Reset</button>
    </div>
  );
}
```

Data format (localStorage)

Key: `pf_user_settings_v1`

Example shape:

```json
{
  "values": { "safeMode": true, "tpSlPips": 10, "targetPercent": 10 },
  "usage": { "tpSlPips": { "10": 5, "15": 2 } },
  "lastUsed": { "tpSlPips": 1684200000000 }
}
```

Notes

- Calling `setSetting()` updates `values` and increments the `usage` counter for that exact value.
- On initial load the provider prefers an explicit saved value, otherwise falls back to the most-used value recorded for that key, otherwise the built-in default.

If you want, I can add a small UI in the Dashboard to expose these settings visually and preview changes immediately.

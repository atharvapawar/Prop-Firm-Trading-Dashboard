import { ErrorBoundary } from "@/components/ErrorBoundary";
import Dashboard from "@/pages/Dashboard";
import { UserSettingsProvider } from "@/hooks/user-settings";

export default function App() {
  return (
    <UserSettingsProvider>
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </UserSettingsProvider>
  );
}

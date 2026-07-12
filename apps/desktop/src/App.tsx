import { Provider } from "react-redux";
import { store } from "@/store";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { AppInit } from "@/components/AppInit";
import { MicButton } from "@/components/MicButton";
import { LanguageSelect } from "@/components/LanguageSelect";
import { StatusBar } from "@/components/StatusBar";
import { SettingsModal } from "@/components/SettingsModal";
import { SettingsButton } from "@/components/SettingsButton";
import { LogPanel } from "@/components/LogPanel";
import { setSelectedProvider, setShowSettings } from "@/store/translatorSlice";

function ConfigWarning() {
  const { apiKeys } = useAppSelector((state) => state.translator);
  const hasAnyKey = Object.values(apiKeys).some(Boolean);
  const dispatch = useAppDispatch();

  if (hasAnyKey) return null;

  return (
    <div className="animate-fade-in w-full rounded-lg border border-warning/30 bg-warning-muted px-4 py-2.5 text-center text-xs text-warning">
      An API key is required for translation.{" "}
      <button
        onClick={() => dispatch(setShowSettings(true))}
        className="font-medium underline decoration-warning/40 underline-offset-2 hover:text-warning/80"
      >
        Open Settings
      </button>
      {" "}to configure one.
    </div>
  );
}

function ProviderBadge() {
  const dispatch = useAppDispatch();
  const { apiKeys, selectedProvider } = useAppSelector((state) => state.translator);
  const savedProviders = Object.entries(apiKeys).filter(([, v]) => v);

  if (savedProviders.length === 0) return null;

  const labels: Record<string, string> = {
    sarvam: "Sarvam AI",
  };

  const sortedProviders = [...savedProviders].sort(([a], [b]) =>
    (labels[a] ?? a).localeCompare(labels[b] ?? b)
  );

  if (savedProviders.length === 1) {
    const [id] = savedProviders[0];
    return (
      <div className="animate-fade-in rounded-full border border-primary/30 bg-primary-muted px-3 py-1 text-xs text-primary">
        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary" />
        {labels[id] ?? id}
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
      <span>Provider:</span>
      <select
        value={selectedProvider}
        onChange={(e) => dispatch(setSelectedProvider(e.target.value))}
        className="cursor-pointer bg-transparent text-ink outline-none hover:text-primary"
      >
        {sortedProviders.map(([id]) => (
          <option key={id} value={id} className="bg-surface text-ink">
            {labels[id] ?? id}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <AppInit>
        <div className="relative flex min-h-dvh flex-col">
          <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-5 py-8 sm:gap-8 sm:px-6">
            <div className="relative flex w-full items-center justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Personal Translator
                </h1>
                <p className="text-sm italic text-muted/60">
                  Speak into your mic. Get translated audio back.
                </p>
              </div>
              <div className="absolute right-0">
                <SettingsButton />
              </div>
            </div>

            <ProviderBadge />

            <ConfigWarning />

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
              <LanguageSelect type="source" />
              <LanguageSelect type="target" />
            </div>

            <MicButton />

            <StatusBar />
          </main>

          <SettingsModal />
          <LogPanel />
        </div>
      </AppInit>
    </Provider>
  );
}

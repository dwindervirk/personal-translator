import { Provider } from "react-redux";
import { store } from "@/store";
import { MicButton } from "@/components/MicButton";
import { LanguageSelect } from "@/components/LanguageSelect";
import { StatusBar } from "@/components/StatusBar";
import { SettingsModal } from "@/components/SettingsModal";
import { SettingsButton } from "@/components/SettingsButton";

export default function App() {
  return (
    <Provider store={store}>
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6">
        <div className="relative flex w-full items-center justify-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Personal Translator
          </h1>
          <div className="absolute right-0">
            <SettingsButton />
          </div>
        </div>
        <p className="text-sm text-gray-400 sm:text-base">
          Speak into your mic. Get translated audio back.
        </p>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-4">
          <LanguageSelect type="source" />
          <LanguageSelect type="target" />
        </div>

        <MicButton />

        <StatusBar />

        <SettingsModal />
      </main>
    </Provider>
  );
}


import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { reset } from "@/store/translatorSlice";

function Waveform() {
  return (
    <div className="flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 3, 2, 1].map((_, i) => (
        <span
          key={i}
          className="block h-5 w-1 rounded-full bg-current"
          style={{
            animation: `pulse-bar 1s ease-in-out ${i * 0.1}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin-custom"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function StatusBar() {
  const { status, error } = useAppSelector((state) => state.translator);
  const dispatch = useAppDispatch();

  if (status === "IDLE") return null;

  const styles: Record<string, string> = {
    RECORDING: "bg-red-900/30 border-red-600/30 text-red-300",
    TRANSLATING: "bg-yellow-900/30 border-yellow-600/30 text-yellow-300",
    PLAYBACK_ACTIVE: "bg-emerald-900/30 border-emerald-600/30 text-emerald-300",
    ERROR: "bg-red-900/40 border-red-500/50 text-red-200",
  };

  return (
    <div
      className={`animate-fade-in flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${styles[status]}`}
    >
      {status === "RECORDING" && (
        <>
          <Waveform />
          <span className="text-red-300">Recording... speak now</span>
        </>
      )}

      {status === "TRANSLATING" && (
        <>
          <Spinner />
          <span>Processing translation…</span>
        </>
      )}

      {status === "PLAYBACK_ACTIVE" && (
        <>
          <Waveform />
          <span>Playing translated audio</span>
        </>
      )}

      {status === "ERROR" && (
        <>
          <span className="flex-1">{error || "Something went wrong"}</span>
          <button
            onClick={() => dispatch(reset())}
            className="ml-2 shrink-0 rounded-md bg-red-800/50 px-2 py-0.5 text-xs text-red-300 hover:bg-red-700/50"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}


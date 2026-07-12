import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { reset } from "@/store/translatorSlice";

function Waveform() {
  return (
    <div className="flex items-center gap-[3px]" aria-hidden>
      {[1, 2, 3, 4, 3, 2, 1].map((_, i) => (
        <span
          key={i}
          className="block h-5 w-0.5 rounded-full bg-current"
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
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path
        fill="currentColor"
        className="opacity-75"
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
    RECORDING: "border-primary/30 bg-primary-muted text-primary",
    TRANSLATING: "border-accent/30 bg-accent-muted text-accent",
    PLAYBACK_ACTIVE: "border-success/30 bg-success-muted text-success",
    ERROR: "border-error/30 bg-error-muted text-error",
  };

  return (
    <div
      className={`animate-scale-in flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${styles[status]}`}
    >
      {status === "RECORDING" && (
        <>
          <Waveform />
          <span>Recording... speak now</span>
        </>
      )}

      {status === "TRANSLATING" && (
        <>
          <Spinner />
          <span>Processing translation...</span>
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
          <span className="flex-1 leading-snug">{error || "Something went wrong"}</span>
          <button
            onClick={() => dispatch(reset())}
            className="shrink-0 rounded-md bg-error/20 px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:bg-error/30"
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}


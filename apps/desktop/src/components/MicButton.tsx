
import { useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setStatus, setError, reset } from "@/store/translatorSlice";
import {
  captureMicrophone,
  startRecording,
  stopRecording,
  blobToWav,
  playAudio,
} from "@/lib/audio";

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

export function MicButton() {
  const dispatch = useAppDispatch();
  const { status, sourceLanguage, targetLanguage, apiKey } = useAppSelector(
    (state) => state.translator
  );
  const recorderRef = useRef<MediaRecorder | null>(null);
  const promiseRef = useRef<Promise<Blob> | null>(null);

  const handleStart = useCallback(async () => {
    if (!apiKey) {
      dispatch(setError("No API key configured. Open Settings (gear icon) to add one."));
      return;
    }
    try {
      dispatch(setStatus("RECORDING"));
      const recorder = await captureMicrophone();
      recorderRef.current = recorder;
      promiseRef.current = startRecording(recorder);
    } catch {
      dispatch(setError("Microphone access denied"));
    }
  }, [dispatch, apiKey]);

  const handleStop = useCallback(async () => {
    if (!recorderRef.current || !promiseRef.current) return;
    stopRecording(recorderRef.current);

    try {
      const blob = await promiseRef.current;
      const wavBlob = await blobToWav(blob);

      dispatch(setStatus("TRANSLATING"));

      const formData = new FormData();
      formData.append("file", wavBlob, "audio.wav");

      const params = new URLSearchParams({ targetLanguage });
      if (sourceLanguage && sourceLanguage !== "unknown") {
        params.set("sourceLanguage", sourceLanguage);
      }

      const apiBase = (window as any).__API_PORT__
        ? `http://127.0.0.1:${(window as any).__API_PORT__}`
        : "";

      const response = await fetch(`${apiBase}/api/translate?${params}`, {
        method: "POST",
        headers: apiKey ? { "X-API-Key": apiKey } : {},
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        let message: string;
        try {
          const json = JSON.parse(text);
          message = json.error ?? "Translation failed";
        } catch {
          message = text || `HTTP ${response.status}`;
        }
        throw new Error(message);
      }

      const audioBuffer = await response.arrayBuffer();
      dispatch(setStatus("PLAYBACK_ACTIVE"));
      await playAudio(audioBuffer);
      dispatch(reset());
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : "Translation failed"));
    } finally {
      recorderRef.current = null;
      promiseRef.current = null;
    }
  }, [dispatch, sourceLanguage, targetLanguage, apiKey]);

  const isRecording = status === "RECORDING";
  const isTranslating = status === "TRANSLATING";
  const isDisabled = isTranslating;

  return (
    <button
      onClick={isRecording ? handleStop : handleStart}
      disabled={isDisabled}
      className={`
        flex items-center gap-2 rounded-full px-8 py-4 text-lg font-semibold
        transition-all duration-200 text-white shadow-lg select-none
        ${
          isRecording
            ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
            : isTranslating
            ? "bg-yellow-600 cursor-not-allowed"
            : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
        }
      `}
    >
      {isRecording && (
        <span className="flex h-4 w-4 items-center justify-center">
          <span className="h-3 w-3 rounded-sm bg-white" />
        </span>
      )}
      {isTranslating && <Spinner />}
      {isRecording && "Stop Recording"}
      {isTranslating && "Translating..."}
      {!isRecording && !isTranslating && "Start Recording"}
    </button>
  );
}


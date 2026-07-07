
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const promiseRef = useRef<Promise<Blob> | null>(null);

  const handleStart = useCallback(async () => {
    if (!apiKey) {
      dispatch(setError("No API key configured. Open Settings (gear icon) to add one."));
      return;
    }
    try {
      dispatch(setStatus("RECORDING"));
      // Create AudioContext from user gesture for reliable playback on Android
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const recorder = await captureMicrophone();
      recorderRef.current = recorder;
      promiseRef.current = startRecording(recorder);
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : "Microphone access denied"));
    }
  }, [dispatch, apiKey]);

  const handleStop = useCallback(async () => {
    if (!recorderRef.current || !promiseRef.current) return;
    stopRecording(recorderRef.current);

    try {
      const blob = await promiseRef.current;
      const wavBlob = await blobToWav(blob);

      dispatch(setStatus("TRANSLATING"));

      // Read as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]); // strip data:audio/wav;base64, prefix
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(wavBlob);
      });
      const base64Audio = await base64Promise;

      let audioBinary: ArrayBuffer;

      // Try Tauri IPC first (Android), fall back to HTTP (desktop)
      if ((window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import("@tauri-apps/api/core");
        const result: string = await invoke("translate_audio", {
          apiKey,
          audioB64: base64Audio,
          targetLanguage,
        });
        audioBinary = Uint8Array.from(atob(result), (c) => c.charCodeAt(0)).buffer;
      } else {
        const apiBase = (window as any).__API_PORT__
          ? `http://127.0.0.1:${(window as any).__API_PORT__}`
          : "";
        const params = new URLSearchParams({ targetLanguage });
        if (sourceLanguage && sourceLanguage !== "unknown") {
          params.set("sourceLanguage", sourceLanguage);
        }

        const xhr = new XMLHttpRequest();
        const xhrPromise = new Promise<ArrayBuffer>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                const audio = Uint8Array.from(atob(json.audio), (c) => c.charCodeAt(0)).buffer;
                resolve(audio);
              } catch {
                reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
              }
            } else {
              try {
                const json = JSON.parse(xhr.responseText);
                reject(new Error(json.error ?? "Translation failed"));
              } catch {
                reject(new Error(xhr.responseText || `HTTP ${xhr.status}`));
              }
            }
          };
          xhr.onerror = () => reject(new Error("Network request failed"));
          xhr.open("POST", `${apiBase}/api/translate?${params}`);
          xhr.setRequestHeader("Content-Type", "application/json");
          if (apiKey) xhr.setRequestHeader("X-API-Key", apiKey);
          xhr.send(JSON.stringify({ audio: base64Audio }));
        });
        audioBinary = await xhrPromise;
      }

      dispatch(setStatus("PLAYBACK_ACTIVE"));
      const ctx = audioCtxRef.current ?? new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      const audioBuffer = await ctx.decodeAudioData(audioBinary);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start(0);
      });
      dispatch(reset());
      } catch (err) {
        const message = typeof err === "string" ? err : err instanceof Error ? err.message : "Translation failed";
        dispatch(setError(message));
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


import { useRef, useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setStatus, setError } from "@/store/translatorSlice";
import {
  captureMicrophone,
  startRecording,
  stopRecording,
  blobToWav,
} from "@/lib/audio";
import { useSpeech, languageCodeToSpeechLang } from "@/lib/useSpeech";

function Spinner() {
  return (
    <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="size-6 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="size-6 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="size-6 sm:size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function isTauri(): boolean {
  return !!(window as any).__TAURI_INTERNALS__;
}

export function MicButton() {
  const dispatch = useAppDispatch();
  const { status, sourceLanguage, targetLanguage, apiKeys, selectedProvider } = useAppSelector(
    (state) => state.translator
  );
  const apiKey = apiKeys[selectedProvider] ?? null;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const promiseRef = useRef<Promise<Blob> | null>(null);
  const [rippling, setRippling] = useState(false);
  const speech = useSpeech();

  const triggerRipple = useCallback(() => {
    setRippling(true);
    setTimeout(() => setRippling(false), 600);
  }, []);

  const useAudioRecording = selectedProvider === "gemini" && isTauri();
  const useSpeechRecognition = selectedProvider === "gemini" && !isTauri();

  const handleStart = useCallback(async () => {
    if (!apiKey) {
      dispatch(setError("No API key configured for this provider. Open Settings (gear icon) to add one."));
      return;
    }

    try {
      dispatch(setStatus("RECORDING"));
      triggerRipple();

      if (useSpeechRecognition) {
        if (!speech.isSupported.recognition) {
          dispatch(setError("Speech Recognition is not supported in this browser. Please use Chrome or Edge."));
          return;
        }
        const speechLang = languageCodeToSpeechLang(sourceLanguage === "unknown" ? "en" : sourceLanguage);
        speech.startListening(speechLang);
      } else {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const recorder = await captureMicrophone();
        recorderRef.current = recorder;
        promiseRef.current = startRecording(recorder);
      }
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : "Microphone access denied"));
    }
  }, [dispatch, apiKey, triggerRipple, speech, sourceLanguage, useSpeechRecognition]);

  const handleStop = useCallback(async () => {
    try {
      let translatedText: string;

      if (useSpeechRecognition) {
        const recognizedText = await speech.stopListening();
        if (!recognizedText.trim()) {
          dispatch(setError("No speech detected. Please try again."));
          return;
        }
        dispatch(setStatus("TRANSLATING"));

        const apiBase = (window as any).__API_PORT__
          ? `http://127.0.0.1:${(window as any).__API_PORT__}`
          : "";
        const params = new URLSearchParams({ targetLanguage });
        if (sourceLanguage && sourceLanguage !== "unknown") {
          params.set("sourceLanguage", sourceLanguage);
        }
        const response = await fetch(`${apiBase}/api/translate-text?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({ text: recognizedText }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Translation failed");
        }
        const result = await response.json();
        translatedText = result.translatedText;
      } else {
        if (!recorderRef.current || !promiseRef.current) return;
        stopRecording(recorderRef.current);
        const blob = await promiseRef.current;
        const wavBlob = await blobToWav(blob);
        dispatch(setStatus("TRANSLATING"));

        const reader = new FileReader();
        const base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(wavBlob);
        });

        if (isTauri()) {
          const { invoke } = await import("@tauri-apps/api/core");
          if (selectedProvider === "gemini") {
            translatedText = await invoke("translate_audio_gemini", {
              apiKey,
              audioB64: base64Audio,
              sourceLanguage: sourceLanguage !== "unknown" ? sourceLanguage : undefined,
              targetLanguage,
            });
          } else {
            const result: string = await invoke("translate_audio", {
              apiKey,
              audioB64: base64Audio,
              targetLanguage,
              provider: selectedProvider,
            });
            const audioBinary = Uint8Array.from(atob(result), (c) => c.charCodeAt(0)).buffer;
            dispatch(setStatus("PLAYBACK_ACTIVE"));
            triggerRipple();
            const ctx = audioCtxRef.current ?? new AudioContext();
            if (ctx.state === "suspended") await ctx.resume();
            const audioBuffer = await ctx.decodeAudioData(audioBinary);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.onended = () => dispatch(setStatus("IDLE"));
            source.start();
            return;
          }
        } else {
          const apiBase = (window as any).__API_PORT__
            ? `http://127.0.0.1:${(window as any).__API_PORT__}`
            : "";
          const params = new URLSearchParams({ targetLanguage, provider: selectedProvider });
          if (sourceLanguage && sourceLanguage !== "unknown") {
            params.set("sourceLanguage", sourceLanguage);
          }
          const xhr = new XMLHttpRequest();
          const audioBinary = await new Promise<ArrayBuffer>((resolve, reject) => {
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
          dispatch(setStatus("PLAYBACK_ACTIVE"));
          triggerRipple();
          const ctx = audioCtxRef.current ?? new AudioContext();
          if (ctx.state === "suspended") await ctx.resume();
          const audioBuffer = await ctx.decodeAudioData(audioBinary);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          source.onended = () => dispatch(setStatus("IDLE"));
          source.start();
          return;
        }
      }

      dispatch(setStatus("PLAYBACK_ACTIVE"));
      triggerRipple();
      const speechLang = languageCodeToSpeechLang(targetLanguage);
      await speech.speak(translatedText, speechLang);
      dispatch(setStatus("IDLE"));
    } catch (err) {
      dispatch(setError(err instanceof Error ? err.message : "Translation failed"));
    }
  }, [dispatch, sourceLanguage, targetLanguage, apiKey, selectedProvider, triggerRipple, speech, useSpeechRecognition]);

  const handleClick = status === "IDLE" || status === "ERROR" ? handleStart : handleStop;

  const stateStyles = {
    IDLE: "border-border bg-surface text-muted hover:border-primary/50 hover:bg-surface-hover hover:text-primary",
    RECORDING: "border-error bg-error-muted text-error shadow-lg shadow-error/20",
    TRANSLATING: "border-accent/50 bg-accent-muted text-accent",
    PLAYBACK_ACTIVE: "border-success bg-success-muted text-success shadow-lg shadow-success/20",
    ERROR: "border-border bg-surface text-muted hover:border-primary/50 hover:bg-surface-hover hover:text-primary",
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={status === "TRANSLATING"}
        className={`relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2 transition-all duration-200 sm:size-16 ${
          stateStyles[status] ?? stateStyles.IDLE
        } ${status === "TRANSLATING" ? "cursor-wait" : "cursor-pointer"}`}
      >
        {rippling && (
          <span
            className="absolute inset-0 rounded-full bg-current"
            style={{ animation: "ripple 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
          />
        )}
        <span className="relative">
          {status === "TRANSLATING" ? <Spinner /> : status === "RECORDING" ? <StopIcon /> : status === "PLAYBACK_ACTIVE" ? <PlayIcon /> : <MicIcon />}
        </span>
      </button>
      {status === "IDLE" && (
        <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-muted/50">
          Tap to record
        </span>
      )}
    </div>
  );
}

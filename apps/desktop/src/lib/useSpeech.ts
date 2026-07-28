import { useState, useCallback, useRef } from "react";

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

declare class SpeechRecognitionClass {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionClass, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionClass, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionClass, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionClass, ev: Event) => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognitionClass;
    webkitSpeechRecognition: typeof SpeechRecognitionClass;
  }
}

export interface UseSpeechReturn {
  isListening: boolean;
  startListening: (lang?: string) => void;
  stopListening: () => Promise<string>;
  speak: (text: string, lang?: string) => Promise<void>;
  cancelSpeak: () => void;
  isSpeaking: boolean;
  isSupported: { recognition: boolean; synthesis: boolean };
}

export function useSpeech(): UseSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const transcriptRef = useRef("");
  const recognitionRef = useRef<SpeechRecognitionClass | null>(null);
  const resolveStopRef = useRef<((text: string) => void) | null>(null);
  const stoppedRef = useRef(false);

  const SpeechRecognitionImpl =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = {
    recognition: !!SpeechRecognitionImpl,
    synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
  };

  const startListening = useCallback(
    (lang?: string) => {
      if (!SpeechRecognitionImpl) {
        console.error("Speech Recognition not supported");
        return;
      }

      const recognition = new SpeechRecognitionImpl();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang || "en-US";

      transcriptRef.current = "";
      stoppedRef.current = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = "";
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }
        if (finalText) {
          transcriptRef.current += finalText;
        } else if (interimText) {
          transcriptRef.current = interimText;
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
        if (resolveStopRef.current) {
          resolveStopRef.current(transcriptRef.current);
          resolveStopRef.current = null;
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (resolveStopRef.current) {
          resolveStopRef.current(transcriptRef.current);
          resolveStopRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [SpeechRecognitionImpl]
  );

  const stopListening = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!recognitionRef.current) {
        resolve(transcriptRef.current);
        return;
      }
      resolveStopRef.current = resolve;
      stoppedRef.current = true;
      recognitionRef.current.stop();
    });
  }, []);

  const speak = useCallback(
    (text: string, lang?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
          reject(new Error("Speech synthesis not supported"));
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang || "en-US";
        utterance.rate = 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = (event) => {
          setIsSpeaking(false);
          reject(new Error(`Speech synthesis error: ${event.error}`));
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  const cancelSpeak = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    speak,
    cancelSpeak,
    isSpeaking,
    isSupported,
  };
}

export function languageCodeToSpeechLang(code: string): string {
  const map: Record<string, string> = {
    am: "am-ET",
    ar: "ar-SA",
    as: "as-IN",
    bn: "bn-BD",
    my: "my-MM",
    zh: "zh-CN",
    nl: "nl-NL",
    en: "en-US",
    fr: "fr-FR",
    de: "de-DE",
    gu: "gu-IN",
    ha: "ha-NG",
    hi: "hi-IN",
    ig: "ig-NG",
    id: "id-ID",
    it: "it-IT",
    ja: "ja-JP",
    kn: "kn-IN",
    km: "km-KH",
    ko: "ko-KR",
    lo: "lo-LA",
    ml: "ml-IN",
    ms: "ms-MY",
    mr: "mr-IN",
    ne: "ne-NP",
    or: "or-IN",
    pl: "pl-PL",
    pt: "pt-BR",
    pa: "pa-IN",
    ru: "ru-RU",
    si: "si-LK",
    es: "es-ES",
    sw: "sw-KE",
    sv: "sv-SE",
    ta: "ta-IN",
    te: "te-IN",
    th: "th-TH",
    tr: "tr-TR",
    ur: "ur-PK",
    vi: "vi-VN",
    yo: "yo-NG",
    zu: "zu-ZA",
  };

  const lang = code.split("-")[0].toLowerCase();
  return map[lang] || "en-US";
}

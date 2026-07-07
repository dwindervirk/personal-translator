export interface ISTTProvider {
  transcribe(
    audioData: Uint8Array,
    options?: { languageCode?: string; mode?: string }
  ): Promise<{ text: string; detectedLanguage?: string }>;
}

export interface ITranslationProvider {
  translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ translatedText: string }>;
}

export interface ITTSProvider {
  synthesize(
    text: string,
    languageCode: string,
    options?: { voiceId?: string }
  ): Promise<Uint8Array>;
}

export type ProviderName = "sarvam" | "huggingface";

export type STTProviderName = ProviderName;
export type TranslationProviderName = ProviderName;
export type TTSProviderName = ProviderName;

export interface ProviderConfig {
  stt: STTProviderName;
  translation: TranslationProviderName;
  tts: TTSProviderName;
}

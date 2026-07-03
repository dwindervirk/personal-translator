export interface ISTTProvider {
  transcribe(
    audioData: Buffer,
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
  ): Promise<Buffer>;
}

export type STTProviderName = "sarvam";
export type TranslationProviderName = "sarvam";
export type TTSProviderName = "sarvam";

export interface ProviderConfig {
  stt: STTProviderName;
  translation: TranslationProviderName;
  tts: TTSProviderName;
}

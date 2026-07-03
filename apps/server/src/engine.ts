import type { ISTTProvider, ITranslationProvider, ITTSProvider } from "@repo/shared";

export class TranslationEngine {
  constructor(
    private stt: ISTTProvider,
    private translator: ITranslationProvider,
    private tts: ITTSProvider
  ) {}

  async translateAudio(
    audioData: Buffer,
    options: {
      sourceLanguage?: string;
      targetLanguage: string;
      voiceId?: string;
    }
  ): Promise<Buffer> {
    const { text, detectedLanguage } = await this.stt.transcribe(audioData, {
      languageCode: options.sourceLanguage,
    });

    if (!text.trim()) {
      throw new Error("No speech detected in audio");
    }

    const sourceLang = detectedLanguage ?? options.sourceLanguage ?? "unknown";

    const { translatedText } = await this.translator.translate(
      text,
      sourceLang,
      options.targetLanguage
    );

    const audioBuffer = await this.tts.synthesize(
      translatedText,
      options.targetLanguage,
      { voiceId: options.voiceId }
    );

    return audioBuffer;
  }
}

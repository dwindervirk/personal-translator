import type { ISTTProvider, ITranslationProvider, ITTSProvider } from "@repo/shared";
import { SarvamSTTProvider } from "./sarvam/stt";
import { SarvamTranslationProvider } from "./sarvam/translate";
import { SarvamTTSProvider } from "./sarvam/tts";

export function createSTTProvider(name: string, apiKey: string): ISTTProvider {
  switch (name) {
    case "sarvam":
      return new SarvamSTTProvider(apiKey);
    default:
      throw new Error(`Unknown STT provider: ${name}`);
  }
}

export function createTranslationProvider(
  name: string,
  apiKey: string
): ITranslationProvider {
  switch (name) {
    case "sarvam":
      return new SarvamTranslationProvider(apiKey);
    default:
      throw new Error(`Unknown translation provider: ${name}`);
  }
}

export function createTTSProvider(name: string, apiKey: string): ITTSProvider {
  switch (name) {
    case "sarvam":
      return new SarvamTTSProvider(apiKey);
    default:
      throw new Error(`Unknown TTS provider: ${name}`);
  }
}

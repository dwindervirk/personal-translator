import type { ITranslationProvider } from "@repo/shared";
import { throwSarvamError } from "./errors";

export class SarvamTranslationProvider implements ITranslationProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<{ translatedText: string }> {
    const response = await fetch("https://api.sarvam.ai/translate", {
      method: "POST",
      headers: {
        "api-subscription-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: text,
        source_language_code: sourceLang,
        target_language_code: targetLang,
        mode: "formal",
        model: "mayura:v1",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throwSarvamError(response.status, error);
    }

    const result = await response.json() as {
      translated_text: string;
    };

    return { translatedText: result.translated_text };
  }
}

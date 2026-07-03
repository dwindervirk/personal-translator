import type { ITTSProvider } from "@repo/shared";

export class SarvamTTSProvider implements ITTSProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async synthesize(
    text: string,
    languageCode: string,
    options?: { voiceId?: string }
  ): Promise<Buffer> {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        speaker: options?.voiceId ?? "shubh",
        language_code: languageCode,
        model: "bulbul:v3",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sarvam TTS failed (${response.status}): ${error}`);
    }

    const result = (await response.json()) as { audios: string[] };

    if (!result.audios || result.audios.length === 0) {
      throw new Error("Sarvam TTS returned no audio");
    }

    return Buffer.from(result.audios[0], "base64");
  }
}

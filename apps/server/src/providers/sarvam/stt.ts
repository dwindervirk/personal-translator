import type { ISTTProvider } from "@repo/shared";

export class SarvamSTTProvider implements ISTTProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioData: Buffer,
    options?: { languageCode?: string; mode?: string }
  ): Promise<{ text: string; detectedLanguage?: string }> {
    const formData = new FormData();
    formData.append("file", new Blob([audioData], { type: "audio/wav" }), "audio.wav");
    formData.append("model", "saaras:v3");
    formData.append("language_code", options?.languageCode ?? "unknown");
    formData.append("mode", options?.mode ?? "transcribe");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": this.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sarvam STT failed (${response.status}): ${error}`);
    }

    const result = await response.json() as {
      transcript: string;
      language_code?: string;
    };

    return {
      text: result.transcript,
      detectedLanguage: result.language_code,
    };
  }
}

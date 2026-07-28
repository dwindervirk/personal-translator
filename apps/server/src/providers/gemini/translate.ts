const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.0-flash-lite";

function getLanguageName(code: string): string {
  const map: Record<string, string> = {
    am: "Amharic",
    ar: "Arabic",
    as: "Assamese",
    bn: "Bengali",
    my: "Burmese",
    zh: "Chinese",
    nl: "Dutch",
    en: "English",
    fr: "French",
    de: "German",
    gu: "Gujarati",
    ha: "Hausa",
    hi: "Hindi",
    ig: "Igbo",
    id: "Indonesian",
    it: "Italian",
    ja: "Japanese",
    kn: "Kannada",
    km: "Khmer",
    ko: "Korean",
    lo: "Lao",
    ml: "Malayalam",
    ms: "Malay",
    mr: "Marathi",
    ne: "Nepali",
    or: "Odia",
    pl: "Polish",
    pt: "Portuguese",
    pa: "Punjabi",
    ru: "Russian",
    si: "Sinhala",
    es: "Spanish",
    sw: "Swahili",
    sv: "Swedish",
    ta: "Tamil",
    te: "Telugu",
    th: "Thai",
    tr: "Turkish",
    ur: "Urdu",
    vi: "Vietnamese",
    yo: "Yoruba",
    zu: "Zulu",
  };
  const lang = code.split("-")[0].toLowerCase();
  return map[lang] ?? code;
}

export async function translateText(
  apiKey: string,
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<{ translatedText: string }> {
  const targetName = getLanguageName(targetLang);
  const sourceName = sourceLang && sourceLang !== "unknown" ? getLanguageName(sourceLang) : "the detected language";

  const prompt = `Translate the following text from ${sourceName} to ${targetName}. Return ONLY the translated text, nothing else.

Text to translate:
${text}`;

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let lastError: string = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 30000;
      await new Promise((r) => setTimeout(r, delay));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (response.status === 429) {
      const errorBody = await response.text();
      const match = errorBody.match(/retry in ([\d.]+)s/);
      const waitTime = match ? Math.ceil(parseFloat(match[1])) : 30;
      lastError = `Rate limited. Please wait ${waitTime}s and try again.`;
      continue;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      throw new Error("No translation received from Gemini");
    }

    return { translatedText };
  }

  throw new Error(lastError || "Gemini API rate limited. Please wait and try again.");
}

export async function transcribeAndTranslateAudio(
  apiKey: string,
  audioBase64: string,
  sourceLang: string,
  targetLang: string
): Promise<{ translatedText: string }> {
  const targetName = getLanguageName(targetLang);
  const sourceName = sourceLang && sourceLang !== "unknown" ? getLanguageName(sourceLang) : "the detected language";

  const prompt = `Listen to this audio. Transcribe what is spoken, then translate it from ${sourceName} to ${targetName}. Return ONLY the translated text, nothing else.`;

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  let lastError: string = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 30000;
      await new Promise((r) => setTimeout(r, delay));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "audio/wav", data: audioBase64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (response.status === 429) {
      const errorBody = await response.text();
      const match = errorBody.match(/retry in ([\d.]+)s/);
      const waitTime = match ? Math.ceil(parseFloat(match[1])) : 30;
      lastError = `Rate limited. Please wait ${waitTime}s and try again.`;
      continue;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      throw new Error("No translation received from Gemini");
    }

    return { translatedText };
  }

  throw new Error(lastError || "Gemini API rate limited. Please wait and try again.");
}

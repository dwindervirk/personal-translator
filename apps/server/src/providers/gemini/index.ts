import WebSocket from "ws";

const SEND_CHUNK_SIZE = 3200;
const SEND_DELAY_MS = 20;
const CONNECT_TIMEOUT_MS = 60_000;
const RECEIVE_SAMPLE_RATE = 24000;

function writeWavHeader(sampleRate: number, dataLength: number): Buffer {
  const n = 1, b = 16;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + dataLength, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(n, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * n * (b / 8), 28);
  h.writeUInt16LE(n * (b / 8), 32);
  h.writeUInt16LE(b, 34);
  h.write("data", 36);
  h.writeUInt32LE(dataLength, 40);
  return h;
}

function extractPcmFromWav(wav: Buffer): Buffer {
  if (wav.length < 44) throw new Error("Invalid WAV");
  let offset = 44;
  for (let i = 12; i < wav.length - 8; ) {
    const id = wav.toString("ascii", i, i + 4);
    const size = wav.readUInt32LE(i + 4);
    if (id === "data") { offset = i + 8; break; }
    i += 8 + size;
  }
  return wav.subarray(offset);
}

interface GeminiMessage {
  setupComplete?: Record<string, unknown>;
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: { data: string; mimeType?: string };
      }>;
    };
    turnComplete?: boolean;
  };
}

export class GeminiLiveTranslateProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async translateAudio(wavBuffer: Buffer, targetLanguage: string): Promise<Buffer> {
    const pcmInput = extractPcmFromWav(wavBuffer);
    const langCode = targetLanguage.split("-")[0];

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let setupComplete = false;
      const translatedChunks: Buffer[] = [];
      let timeout: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        clearTimeout(timeout);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Gemini Live Translate timed out"));
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        console.log("Gemini: WebSocket connected, sending setup...");
        const setup = {
          setup: {
            model: "models/gemini-3.5-live-translate-preview",
            generationConfig: {
              responseModalities: ["AUDIO"],
              translationConfig: {
                targetLanguageCode: langCode,
                echoTargetLanguage: true,
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
            },
          },
        };
        ws.send(JSON.stringify(setup));
      });

      ws.on("message", async (data: Buffer) => {
        try {
          const msg: GeminiMessage = JSON.parse(data.toString());

          if (msg.setupComplete) {
            console.log("Gemini: Setup complete, streaming audio...");
            setupComplete = true;

            for (let offset = 0; offset < pcmInput.length; offset += SEND_CHUNK_SIZE) {
              const chunk = pcmInput.subarray(offset, offset + SEND_CHUNK_SIZE);
              const audioMsg = {
                realtimeInput: {
                  audio: {
                    data: chunk.toString("base64"),
                    mimeType: "audio/pcm;rate=16000",
                  },
                },
              };
              ws.send(JSON.stringify(audioMsg));
              await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
            }

            console.log("Gemini: Audio sent, signaling turnComplete...");
            ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
          }

          if (msg.serverContent) {
            const parts = msg.serverContent.modelTurn?.parts ?? [];
            for (const part of parts) {
              if (part.inlineData?.data) {
                translatedChunks.push(Buffer.from(part.inlineData.data, "base64"));
              }
            }

            if (msg.serverContent.turnComplete) {
              console.log(`Gemini: Turn complete, received ${translatedChunks.length} chunks`);
              cleanup();
              if (translatedChunks.length === 0) {
                reject(new Error("No translated audio received from Gemini"));
              } else {
                const combined = Buffer.concat(translatedChunks);
                resolve(Buffer.concat([writeWavHeader(RECEIVE_SAMPLE_RATE, combined.length), combined]));
              }
            }
          }
        } catch (err) {
          cleanup();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      ws.on("error", (err: Error) => {
        console.error(`Gemini WebSocket error: ${err.message}`);
        cleanup();
        reject(new Error(`Gemini WebSocket error: ${err.message}`));
      });

      ws.on("close", (code: number, reason: Buffer) => {
        console.log(`Gemini WebSocket closed: ${code} ${reason.toString()}`);
        if (!setupComplete) {
          cleanup();
          reject(new Error(`Gemini WebSocket closed during setup: ${code}`));
        } else if (translatedChunks.length > 0) {
          cleanup();
          const combined = Buffer.concat(translatedChunks);
          resolve(Buffer.concat([writeWavHeader(RECEIVE_SAMPLE_RATE, combined.length), combined]));
        }
      });
    });
  }
}

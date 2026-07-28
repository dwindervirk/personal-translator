import dotenv from "dotenv";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { createSTTProvider, createTranslationProvider, createTTSProvider } from "./providers/factory";
import { GeminiLiveTranslateProvider } from "./providers/gemini/index";
import { translateText, transcribeAndTranslateAudio } from "./providers/gemini/translate";
import { TranslationEngine } from "./engine";
import { ProviderAuthError, ProviderRateLimitError, ProviderBalanceError } from "./providers/errors";
import "./logger";
import { getLogs } from "./logger";

const MAX_RETRIES = 3;

async function translateWithRetry(
  engine: TranslationEngine,
  audioBuffer: Buffer,
  options: { sourceLanguage?: string; targetLanguage: string; voiceId?: string }
): Promise<Buffer> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await engine.translateAudio(audioBuffer, options);
    } catch (error) {
      if (error instanceof ProviderRateLimitError && attempt < MAX_RETRIES - 1) {
        const delay = 2000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new ProviderRateLimitError("Rate limit exceeded. Please wait a moment and try again.");
}

export async function main(options?: { port?: number; frontendPath?: string }) {
  const app = Fastify({ logger: true });

  app.setErrorHandler((error: { message?: string; statusCode?: number }, request, reply) => {
    const message = error.message ?? "Internal Server Error";
    app.log.error(message);
    reply.status(error.statusCode ?? 500).send({ error: message });
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  app.get("/api/logs", async (_request, reply) => {
    reply.send(getLogs());
  });

  app.post<{
    Querystring: {
      targetLanguage?: string;
      sourceLanguage?: string;
      voiceId?: string;
      provider?: string;
    };
    Headers: {
      "x-api-key"?: string;
    };
  }>("/api/translate", async (request, reply) => {
    try {
      let audioBuffer: Buffer;
      let targetLanguage = request.query.targetLanguage ?? "en-IN";
      const sourceLanguage = request.query.sourceLanguage;
      const voiceId = request.query.voiceId;
      const provider = request.query.provider ?? "sarvam";

      console.log(`Server: Request provider=${provider} target=${targetLanguage} source=${sourceLanguage}`);

      const contentType = request.headers["content-type"] ?? "";

      if (contentType.includes("application/json")) {
        const body = request.body as { audio?: string };
        if (!body?.audio) {
          return reply.status(400).send({ error: "No audio data provided" });
        }
        audioBuffer = Buffer.from(body.audio, "base64");
        console.log(`Server: JSON body audioSize=${audioBuffer.length}`);
      } else {
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({ error: "No audio file provided" });
        }
        audioBuffer = await data.toBuffer();
        console.log(`Server: Multipart audioSize=${audioBuffer.length}`);
      }

      const apiKey = request.headers["x-api-key"] ?? process.env.SARVAM_API_KEY;
      if (!apiKey) {
        return reply.status(401).send({
          error: "API key is required. Set it in the Settings modal or via SARVAM_API_KEY env var.",
        });
      }
      console.log("Server: API key present");

      let translatedAudio: Buffer;

      if (provider === "gemini") {
        console.log("Server: Dispatching to GeminiLiveTranslateProvider");
        const gemini = new GeminiLiveTranslateProvider(apiKey);
        translatedAudio = await gemini.translateAudio(audioBuffer, targetLanguage);
        console.log(`Server: Gemini response received size=${translatedAudio.length}`);
      } else {
        const sttProvider = createSTTProvider(provider, apiKey);
        const translationProvider = createTranslationProvider(provider, apiKey);
        const ttsProvider = createTTSProvider(provider, apiKey);
        const engine = new TranslationEngine(sttProvider, translationProvider, ttsProvider);

        translatedAudio = await translateWithRetry(engine, audioBuffer, {
          sourceLanguage,
          targetLanguage,
          voiceId,
        });
      }

      if (contentType.includes("application/json")) {
        reply.send({ audio: translatedAudio.toString("base64") });
      } else {
        reply
          .header("Content-Type", "audio/wav")
          .header("Content-Length", translatedAudio.length)
          .send(translatedAudio);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Server ERROR: ${message}`);
      app.log.error(message);

      if (error instanceof ProviderAuthError) {
        return reply.status(401).send({ error: message });
      }
      if (error instanceof ProviderRateLimitError) {
        return reply.status(429).send({ error: message });
      }
      if (error instanceof ProviderBalanceError) {
        return reply.status(402).send({ error: message });
      }
      reply.status(500).send({ error: message });
    }
  });

  app.post<{
    Querystring: {
      targetLanguage?: string;
      sourceLanguage?: string;
    };
    Headers: {
      "x-api-key"?: string;
    };
  }>("/api/translate-text", async (request, reply) => {
    try {
      const body = request.body as { text?: string };
      if (!body?.text) {
        return reply.status(400).send({ error: "No text provided" });
      }

      const targetLanguage = request.query.targetLanguage ?? "en";
      const sourceLanguage = request.query.sourceLanguage ?? "unknown";

      const apiKey = request.headers["x-api-key"];
      if (!apiKey) {
        return reply.status(401).send({
          error: "API key is required. Set it in the Settings modal.",
        });
      }

      console.log(`Server: Text translation request target=${targetLanguage} source=${sourceLanguage}`);

      const result = await translateText(apiKey, body.text, sourceLanguage, targetLanguage);
      console.log(`Server: Translation complete`);

      reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Server TEXT ERROR: ${message}`);
      reply.status(500).send({ error: message });
    }
  });

  app.post<{
    Querystring: {
      targetLanguage?: string;
      sourceLanguage?: string;
    };
    Headers: {
      "x-api-key"?: string;
    };
  }>("/api/translate-audio-gemini", async (request, reply) => {
    try {
      const body = request.body as { audio?: string };
      if (!body?.audio) {
        return reply.status(400).send({ error: "No audio data provided" });
      }

      const targetLanguage = request.query.targetLanguage ?? "en";
      const sourceLanguage = request.query.sourceLanguage ?? "unknown";

      const apiKey = request.headers["x-api-key"];
      if (!apiKey) {
        return reply.status(401).send({
          error: "API key is required.",
        });
      }

      console.log(`Server: Gemini audio translation target=${targetLanguage} source=${sourceLanguage}`);

      const result = await transcribeAndTranslateAudio(apiKey, body.audio, sourceLanguage, targetLanguage);
      console.log(`Server: Gemini audio translation complete`);

      reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Server AUDIO GEMINI ERROR: ${message}`);
      reply.status(500).send({ error: message });
    }
  });

  const frontendPath = options?.frontendPath ?? process.env.FRONTEND_PATH;
  if (frontendPath && existsSync(frontendPath)) {
    await app.register(fastifyStatic, {
      root: frontendPath,
      prefix: "/",
      wildcard: false,
    });

    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.status(404).send({ error: "Not found" });
      }
      try {
        const content = readFileSync(resolve(frontendPath, "index.html"), "utf-8");
        reply.type("text/html").send(content);
      } catch {
        reply.status(404).send({ error: "Not found" });
      }
    });
  }

  const port = options?.port ?? parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "127.0.0.1";

  await app.listen({ port, host });
  app.log.info(`Server listening on ${host}:${port}`);
  return { port, host };
}

const frontendPath = process.env.FRONTEND_PATH;
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;

main({ port, frontendPath }).catch((err) => {
  console.error(err);
  process.exit(1);
});

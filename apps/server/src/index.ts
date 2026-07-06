import dotenv from "dotenv";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { SarvamSTTProvider } from "./providers/sarvam/stt";
import { SarvamTranslationProvider } from "./providers/sarvam/translate";
import { SarvamTTSProvider } from "./providers/sarvam/tts";
import { TranslationEngine } from "./engine";
import { SarvamAuthError, SarvamRateLimitError, SarvamBalanceError } from "./providers/sarvam/errors";

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
      if (error instanceof SarvamRateLimitError && attempt < MAX_RETRIES - 1) {
        const delay = 2000 * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new SarvamRateLimitError("Rate limit exceeded. Please wait a moment and try again.");
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

  app.post<{
    Querystring: {
      targetLanguage?: string;
      sourceLanguage?: string;
      voiceId?: string;
    };
    Headers: {
      "x-api-key"?: string;
    };
  }>("/api/translate", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No audio file provided" });
      }

      const apiKey = request.headers["x-api-key"] ?? process.env.SARVAM_API_KEY;
      if (!apiKey) {
        return reply.status(401).send({
          error: "API key is required. Set it in the Settings modal or via SARVAM_API_KEY env var.",
        });
      }

      const audioBuffer = await data.toBuffer();
      const targetLanguage = request.query.targetLanguage ?? "en-IN";
      const sourceLanguage = request.query.sourceLanguage;
      const voiceId = request.query.voiceId;

      const sttProvider = new SarvamSTTProvider(apiKey);
      const translationProvider = new SarvamTranslationProvider(apiKey);
      const ttsProvider = new SarvamTTSProvider(apiKey);

      const engine = new TranslationEngine(sttProvider, translationProvider, ttsProvider);

      const translatedAudio = await translateWithRetry(engine, audioBuffer, {
        sourceLanguage,
        targetLanguage,
        voiceId,
      });

      reply
        .header("Content-Type", "audio/wav")
        .header("Content-Length", translatedAudio.length)
        .send(translatedAudio);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      app.log.error(message);

      if (error instanceof SarvamAuthError) {
        return reply.status(401).send({ error: message });
      }
      if (error instanceof SarvamRateLimitError) {
        return reply.status(429).send({ error: message });
      }
      if (error instanceof SarvamBalanceError) {
        return reply.status(402).send({ error: message });
      }
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

import dotenv from "dotenv";
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { TranslationEngine } from "./engine";
import { createSTTProvider, createTranslationProvider, createTTSProvider } from "./providers/factory";

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

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error("SARVAM_API_KEY is not set in environment");
  }

  const engine = new TranslationEngine(
    createSTTProvider(process.env.SELECTED_STT_PROVIDER ?? "sarvam", apiKey),
    createTranslationProvider(process.env.SELECTED_TRANSLATION_PROVIDER ?? "sarvam", apiKey),
    createTTSProvider(process.env.SELECTED_TTS_PROVIDER ?? "sarvam", apiKey)
  );

  app.post<{
    Querystring: {
      targetLanguage?: string;
      sourceLanguage?: string;
      voiceId?: string;
    };
  }>("/api/translate", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: "No audio file provided" });
      }

      const audioBuffer = await data.toBuffer();

      const targetLanguage = request.query.targetLanguage ?? "en-IN";
      const sourceLanguage = request.query.sourceLanguage;
      const voiceId = request.query.voiceId;

      const translatedAudio = await engine.translateAudio(audioBuffer, {
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

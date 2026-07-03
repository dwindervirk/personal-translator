import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../../../.env.local") });
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { TranslationEngine } from "./engine";
import { createSTTProvider, createTranslationProvider, createTTSProvider } from "./providers/factory";

async function main() {
  const app = Fastify({ logger: true });

  // Return JSON for all unhandled errors
  app.setErrorHandler((error: { message?: string; statusCode?: number }, request, reply) => {
    const message = error.message ?? "Internal Server Error";
    app.log.error(message);
    reply.status(error.statusCode ?? 500).send({ error: message });
  });

  await app.register(cors, { origin: true });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
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

  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = process.env.HOST ?? "127.0.0.1";

  try {
    await app.listen({ port, host });
    app.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();

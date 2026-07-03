// Generates a synthetic 16kHz 16-bit mono WAV file for Playwright mock audio input.
import { writeFileSync } from "fs";
import { resolve } from "path";

const sampleRate = 16000;
const durationSec = 2;
const numSamples = sampleRate * durationSec;
const numChannels = 1;
const bitsPerSample = 16;
const bytesPerSample = bitsPerSample / 8;
const blockAlign = numChannels * bytesPerSample;
const byteRate = sampleRate * blockAlign;
const dataSize = numSamples * blockAlign;
const fileSize = 44 + dataSize;

const buffer = Buffer.alloc(fileSize);
let offset = 0;

const writeStr = (s: string) => {
  buffer.write(s, offset, "ascii");
  offset += s.length;
};

const writeU16 = (v: number) => {
  buffer.writeUInt16LE(v, offset);
  offset += 2;
};

const writeU32 = (v: number) => {
  buffer.writeUInt32LE(v, offset);
  offset += 4;
};

// RIFF header
writeStr("RIFF");
writeU32(fileSize - 8);
writeStr("WAVE");

// fmt chunk
writeStr("fmt ");
writeU32(16);
writeU16(1); // PCM
writeU16(numChannels);
writeU32(sampleRate);
writeU32(byteRate);
writeU16(blockAlign);
writeU16(bitsPerSample);

// data chunk
writeStr("data");
writeU32(dataSize);

// Generate a 440Hz sine wave at moderate volume
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const sample = Math.sin(2 * Math.PI * 440 * t) * 0.3;
  const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
  buffer.writeInt16LE(intSample, offset);
  offset += 2;
}

const outPath = resolve("tests/fixtures/synthetic_voice_input.wav");
writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes)`);

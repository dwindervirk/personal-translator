# SPEC.md: Open-Source Extensible Personal Translator (POC)

## 1. Document Overview & System Objectives

This specification outlines the technical blueprint for an **Open-Source Personal Translator** designed to operate locally on personal workstations as a light-footprint web application. The core objective is an automated audio-to-audio translation loop: hardware microphone capture $\rightarrow$ target language translation $\rightarrow$ local speaker playback.

### Strategic Priorities
* **Provider Agnosticism:** The software pipeline must isolate integration details behind abstract system interfaces. Swapping out the default vendor (Sarvam AI) for competitors (e.g., Deepgram, ElevenLabs, OpenAI, or local Whisper models) must require zero core rewrite.
* **Low-Latency Loop Execution:** Audio conversion pipelines rely heavily on synchronous or streaming execution to provide natural conversation turnarounds ($< 1.5$ seconds overhead).
* **Strict Security Boundaries:** API authentication parameters must remain securely isolated on a local application server layer to prevent credential bleed onto the public-facing client layout.

---

## 2. Tech Stack Architecture

The application implements a decoupled client-server architecture hosted entirely within a single loopback ecosystem (`localhost`).



### Frontend Client Layer
* **Framework:** React 19 / Next.js 15 (App Router architecture).
* **Language Runtime:** TypeScript 5.x enforced with strict type compliance.
* **Audio Interfacing:** W3C Media Stream Recording API (`MediaRecorder`) coupled with standard HTML5 Web Audio API (`AudioContext`).
* **Styling Paradigm:** Tailwind CSS for minimalist, utility-first layout building.

### Backend Server & Orchestration Layer
* **Runtime Environment:** Node.js LTS (v22+).
* **Application Framework:** Fastify v4/v5 (selected over Express due to superior overhead benchmarks and schema-based JSON serialization optimization).
* **Multi-Part Payload Utility:** `@fastify/multipart` for high-throughput buffering of raw audio arrays from client streams.

### Testing & Infrastructure Verification
* **Framework:** Playwright v1.49+ End-to-End Testing Suite.
* **Automation Automation Extensions:** Chromium-level browser flag orchestration for mock hardware input loops (`--use-fake-device-for-media-stream`).

---

## 3. Extensible System Interfaces

To conform to open-source maintainability, vendor code must be contained inside stateless Provider Class abstractions implementing explicit interfaces.

```typescript
// Definitions for provider swapping
export interface ISTTProvider {
  transcribe(audioData: Buffer, options: { languageCode?: string; mode?: string }): Promise<{ text: string; detectedLanguage?: string }>;
}

export interface ITranslationProvider {
  translate(text: string, sourceLang: string, targetLang: string): Promise<{ translatedText: string }>;
}

export interface ITTSProvider {
  synthesize(text: string, languageCode: string, options: { voiceId?: string }): Promise<Buffer>;
}

```

The orchestration workflow is driven by a unified `TranslationEngine` orchestrator that accepts these abstract configurations:

```typescript
export class TranslationEngine {
  constructor(
    private stt: ISTTProvider,
    private translator: ITranslationProvider,
    private tts: ITTSProvider
  ) {}
  
  // Pipeline management logic executes sequentially against interfaces
}

```

---

## 4. Default Implementation Blueprint: Sarvam AI Layer

The Proof-of-Concept leverages Sarvam AI's REST platform. The integration routes payloads sequentially through the specific Indic-optimized models listed below.

```
+------------------+     (Buffer)     +--------------------+
|  Client Browser  | -------------->  | /api/translate Web |
+------------------+                  +--------------------+
         ^                                       |
         | (Translated Audio)                    | (Audio Chunk)
         |                                       v
+------------------+                  +--------------------+
| AudioPlaybackCtx |                  | STT: saaras:v3     |
+------------------+                  +--------------------+
         ^                                       |
         | (Audio Bytes)                         | (Transcript)
         |                                       v
+------------------+                  +--------------------+
| TTS: bulbul:v3   | <--------------  | Translate: Mayura  |
+------------------+   (Target Text)  +--------------------+

```

### 1. Speech-to-Text (STT) Module

* **Vendor Endpoint:** `POST https://api.sarvam.ai/speech-to-text`
* **Underlying Model Architecture:** `saaras:v3`
* **Execution Parameters:**
* `mode`: `"transcribe"` (or `"translate"` if forcing immediate conversion to English).
* `language_code`: Optional BCP-47 identifier (e.g., `hi-IN`, `ta-IN`, `en-IN`). Defaults to `"unknown"` to trigger automatic server-side language routing.


* **Payload Structure:** Multipart form formatting containing binary buffer streams (`audio/wav`).

### 2. Machine Translation Module

* **Vendor Endpoint:** `POST https://api.sarvam.ai/text/translate`
* **Underlying Model Architecture:** `sarvam-translate:v1` or `mayura:v1`
* **Execution Parameters:**
* `input`: Sourced directly from STT output string parsing.
* `source_language_code`: Identified from input configurations.
* `target_language_code`: User selected target configuration (BCP-47 syntax).



### 3. Text-to-Speech (TTS) Module

* **Vendor Endpoint:** `POST https://api.sarvam.ai/text-to-speech`
* **Underlying Model Architecture:** `bulbul:v3`
* **Execution Parameters:**
* `voice`: Assigned speaker identity profile (e.g., `"shubh"`, `"shreya"`, `"manan"`, `"ishita"`).
* `language_code`: Matches target language criteria.


* **Output Format Handling:** Binary payload array containing raw `audio/wav` output bytes returned with a `Content-Type: audio/wav` header block back to the user environment.

---

## 5. Client-Side Web Audio Orchestration

The browser pipeline interfaces with peripheral hardware devices using the following constraints:

### Capture Cycle (Microphone Input)

1. Browser requests permission scope via `navigator.mediaDevices.getUserMedia({ audio: true })`.
2. Audio streaming relies on `MediaRecorder` collecting data slices configured for a native sample rate profile matching Sarvam's preferred standard ($16000\text{ Hz}$ single-channel audio track constraints).
3. On recording termination (`onstop`), array chunks aggregate down into a standardized `Blob` object (`type: 'audio/wav'`).

### Execution Handoff

* The raw multi-part blob acts as payload structure delivered to `/api/translate` via `window.fetch`.

### Playback Cycle (Speaker Output)

1. Server returns raw audio stream chunks to the client.
2. The UI code handles data processing using an asynchronous browser `AudioContext`.
3. Audio array content is converted via `decodeAudioData()`.
4. Decoded material routes directly out to hardware speakers through `AudioContext.destination` channels.

---

## 6. Playwright E2E Quality Assurance Protocol

Testing voice-driven systems introduces peripheral hardware dependencies that disrupt headless Continuous Integration (CI) systems. The verification engine resolves this via browser hardware virtualization flags.

### Virtual Framework Configuration

The Playwright orchestration suite bypasses native system hardware restrictions by launching standard browser binaries with precise Chromium execution flags:

```typescript
// playwright.config.ts parameters
export default defineConfig({
  use: {
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=tests/fixtures/synthetic_voice_input.wav'
      ]
    }
  }
});

```

### Core Verification Sequences (CLI Commands)

* **Isolated System Verification:**
Ensures components are aligned, verifying state mutations and network handoffs without invoking the graphic interface.
```bash
npx playwright test

```


* **Interactive Structural Debugging:**
Launches the step-by-step graphical DOM tracker to inspect network payloads, track recording buffer states, and evaluate audio element lifecycles.
```bash
npx playwright test --debug

```


* **Visual Regression & Workflow Inspection:**
Reviews state-machine progression (e.g., verifying `IDLE` updates cleanly to `RECORDING`, then `TRANSLATING`, and finally `PLAYBACK_ACTIVE`).
```bash
npx playwright show-report

```



---

## 7. Configuration Schema & Secrets Isolation

Authentication requirements are maintained securely through standard local environment files.

```ini
# .env.local Template
PORT=3000
HOST=127.0.0.1
SARVAM_API_KEY=srvm_secret_your_production_subscription_key_here
SELECTED_STT_PROVIDER=sarvam
SELECTED_TRANSLATION_PROVIDER=sarvam
SELECTED_TTS_PROVIDER=sarvam

```

This structural specification details the foundational architecture required to assemble an extensible, production-ready, localized multi-language speech utility.

```

***

For a closer look at integrating Indic speech models and implementing audio interfaces in JavaScript applications, you can check out this [Sarvam AI Platform Integration and Setup Guide](https://www.youtube.com/watch?v=I1o8QO7PU2U). This technical overview demonstrates real-world benchmarks for speech recognition, translation workflows, and code-mixed inputs across various regional languages.


http://googleusercontent.com/youtube_content/0

```

# Important skills to setup
- npx impeccable install
- npx playwright -> please check and install it

# Other
- consider using react/redux for ui 
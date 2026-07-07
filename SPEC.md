# SPEC.md: Open-Source Extensible Personal Translator (POC)

## 1. Document Overview & System Objectives

This specification outlines the technical blueprint for an **Open-Source Personal Translator** designed to operate locally on personal workstations as a light-footprint web application. The core objective is an automated audio-to-audio translation loop: hardware microphone capture $\rightarrow$ target language translation $\rightarrow$ local speaker playback.

### Strategic Priorities
* **Provider Agnosticism:** The software pipeline must isolate integration details behind abstract system interfaces. Swapping out the default vendor (Sarvam AI) for competitors (e.g., Deepgram, ElevenLabs, OpenAI, or local Whisper models) must require zero core rewrite.
* **Low-Latency Loop Execution:** Audio conversion pipelines rely heavily on synchronous or streaming execution to provide natural conversation turnarounds ($< 1.5$ seconds overhead).
* **Strict Security Boundaries:** API authentication parameters must remain securely isolated on the user's machine. API keys are entered through the application's UI (Settings modal), persisted to local storage, and passed server-side per-request. No secrets are embedded in compiled binaries or committed to version control.

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

## 7. UI-Based Configuration & Secrets Management

API keys are configured by the end user through the application's Settings modal. This approach ensures secrets remain on the user's machine and are never embedded in compiled binaries or committed to version control.

### Settings Modal

A gear icon (⚙) button in the main UI opens a Settings modal popup containing:

| Control | Description |
|---------|-------------|
| Provider dropdown | Selects which AI provider to use (Sarvam AI, Hugging Face, etc.) |
| API Key input | Masked password field per selected provider, with a show/hide toggle |
| Save button | Persists the key to `localStorage` (web) / Tauri app data (desktop) and updates Redux store |
| Clear button | Removes the saved key for the selected provider |
| Close | Dismisses the modal (X button or Escape key) |

### First-Run Experience

On initial launch, if no API key is found for any provider, the Settings modal auto-opens with a generic warning banner:

> "An API key is required for translation. Select a provider and enter your key below."

### Data Flow

```
User selects provider (e.g., "Sarvam AI") and enters key
           ↓
Saved to per-provider localStorage key / Redux Store
  apiKeys["sarvam"] = "sk_..."
  apiKeys["huggingface"] = "hf_..."
           ↓
MicButton reads apiKeys[selectedProvider] from Redux
           ↓
POST /api/translate?provider=sarvam
  Headers: X-API-Key: sk_...
           ↓
Fastify backend reads provider query param + X-API-Key header
           ↓
Factory creates provider instances based on name:
  createSTTProvider("sarvam", key)       → SarvamSTTProvider
  createTranslationProvider("sarvam", key) → SarvamTranslationProvider
  createTTSProvider("sarvam", key)       → SarvamTTSProvider
           ↓
Pipeline executes: STT → Translate → TTS
```

### Fallback for Development

A `.env.local` file is still supported during development as a convenience fallback:

```ini
PORT=3001
HOST=127.0.0.1
# SARVAM_API_KEY is optional — use the Settings UI instead
SELECTED_STT_PROVIDER=sarvam
SELECTED_TRANSLATION_PROVIDER=sarvam
SELECTED_TTS_PROVIDER=sarvam
```

If neither the `X-API-Key` header nor `SARVAM_API_KEY` env var is provided, the server returns a clear error: `{ "error": "API key is required. Set it in the Settings modal." }`

### Security

- **Compiled binaries:** The `.msi` installer contains zero hardcoded API keys
- **Storage:** Keys are stored in the browser's `localStorage` (web) or Tauri's secure app data directory (desktop)
- **Transit:** Keys travel from frontend to backend via HTTP headers over `localhost` only — never over the public network
- **Version control:** `.env.local` is excluded by `.gitignore`; no secrets can be committed

---

## 8. Android Platform (Tauri v2)

The application targets Android as a fully standalone APK via **Tauri v2's native Android support**. The same React frontend (Vite build) runs in the Tauri WebView, while an embedded **Rust HTTP server** using `axum` handles the translation pipeline directly on the device — no external backend required.

### Android Architecture

```
Android APK
┌────────────────────────────────────────────┐
│  Tauri WebView (React Vite app)            │
│  ├── Mic recording (MediaRecorder)         │
│  ├── Settings modal for API key            │
│  ├── fetch() → http://127.0.0.1:<port>    │
│  └── AudioContext playback                 │
└──────────────┬─────────────────────────────┘
               │
┌──────────────▼────────────────────────────┐
│  Embedded Rust Backend (axum HTTP server)  │
│  ├── Starts on a random loopback port     │
│  ├── Serves Vite frontend from mem        │
│  ├── POST /api/translate                  │
│  │   ├── STT: reqwest → sarvam.ai         │
│  │   ├── Translate: reqwest → sarvam.ai   │
│  │   └── TTS: reqwest → base64 decode     │
│  └── X-API-Key per request               │
└────────────────────────────────────────────┘
```

### Dual Implementation Strategy

| Platform | Backend | Language |
|----------|---------|----------|
| **Windows** (desktop) | Fastify server (sidecar `.exe`) | TypeScript |
| **Android** (mobile) | Embedded axum server (in APK) | Rust |

Both implementations call the same Sarvam AI REST endpoints. The Rust port is approximately 250 lines covering:
- `SarvamSTT` — multipart form POST → JSON response
- `SarvamTranslate` — JSON POST → translated text
- `SarvamTTS` — JSON POST → base64-decoded WAV audio
- `TranslationEngine` — sequential pipeline orchestrator

### API Key Encryption (Android Keystore)

On Android, the API key is stored using **Android Keystore** (hardware-backed) via a Rust-to-Kotlin JNI bridge:

| Layer | File | Role |
|-------|------|------|
| **Kotlin** | `KeystoreHelper.kt` | Singleton with `save/load/clear` backed by `EncryptedSharedPreferences` (AES-256-GCM) |
| **Rust JNI** | `keystore.rs` | `JNI_OnLoad` captures the `JavaVM` pointer, then `save/load/clear` use JNI to call `KeystoreHelper` static methods |
| **Tauri command** | `lib.rs` | Exposes `save_api_key(key)`, `get_api_key()`, `clear_api_key()` to the frontend |
| **Frontend** | `translatorSlice.ts` | Tries JNI-backed invoke first, falls back to `localStorage` if not in Tauri environment |

Key details:
- `JNI_OnLoad` stores the JVM in a `OnceLock<jni::JavaVM>` global
- `with_jni_env()` helper attaches the calling thread to the JVM and provides a `JNIEnv`
- JNI signatures: `save(Ljava/lang/String;)Z`, `load()Ljava/lang/String;`, `clear()Z`
- Encryption uses AES-256-GCM with per-installation master key from `MasterKeys`
- On desktop, `localStorage` continues to be used (unchanged behavior)

### Platform Detection

The Rust code in `lib.rs` uses `#[cfg(target_os = "android")]` to branch:
- **Android:** Start embedded axum HTTP server, inject `window.__API_PORT__` into WebView
- **Desktop (Windows):** Start Node.js sidecar (existing behavior, unchanged)

---

## 9. API Error Handling & User Feedback

The application handles Sarvam API errors at three layers: **provider** (parses status codes), **server** (returns structured HTTP responses), and **frontend** (displays user-friendly messages).

### Error Types & Mapping

| Sarvam HTTP Status | Cause | User-Facing Message | Frontend Display |
|-------------------|-------|---------------------|------------------|
| `401` / `403` | Invalid, expired, or revoked API key | "Your API key is invalid. Check the key in Settings." | Red error banner |
| `429` | Rate limit exceeded (free/low-tier plans) | "Rate limit exceeded. Please wait a moment and try again." | Red error banner |
| `402` or body contains "balance" / "credit" | Insufficient Sarvam account credits | "Your Sarvam account has insufficient credits." | Red error banner |
| `500` / other | Sarvam internal error | `"Sarvam API error (status): {body}"` | Red error banner |

### Provider Layer (TypeScript — `apps/server/src/providers/`)

Error handling uses generalized classes from `providers/errors.ts` that are provider-agnostic:

```typescript
// apps/server/src/providers/errors.ts
export class ProviderAuthError extends Error { name = "ProviderAuthError"; }
export class ProviderRateLimitError extends Error { name = "ProviderRateLimitError"; }
export class ProviderBalanceError extends Error { name = "ProviderBalanceError"; }
```

Sarvam-specific errors re-export the same classes:

```typescript
// apps/server/src/providers/sarvam/errors.ts
export { ProviderAuthError as SarvamAuthError, ... } from "../errors";
```

Each provider (STT, Translate, TTS) checks `response.status` before throwing:

```typescript
const errBody = await response.text();
if (status === 401 || status === 403) {
  throw new ProviderAuthError("Your API key is invalid...");
}
if (status === 429) {
  throw new ProviderRateLimitError("Rate limit exceeded...");
}
if (status === 402 || errBody.includes("balance") || errBody.includes("credit")) {
  throw new ProviderBalanceError("Your Sarvam account has insufficient credits.");
}
throw new Error(`Sarvam API error (${status}): ${errBody}`);
```

The server route handler checks the generalized classes:

```typescript
if (error instanceof ProviderAuthError)     return reply.status(401);
if (error instanceof ProviderRateLimitError) return reply.status(429);
if (error instanceof ProviderBalanceError)  return reply.status(402);
```

### Provider Layer (Rust — `apps/desktop/src-tauri/src/translate.rs`)

Same logic via a helper function returning structured error strings with prefix markers:

```rust
fn map_sarvam_error(status: u16, body: &str) -> String {
    match status {
        401 | 403 => format!("AUTH_ERROR: Your API key is invalid..."),
        429       => format!("RATE_LIMIT: Rate limit exceeded..."),
        402       => format!("BALANCE_ERROR: Insufficient credits..."),
        _         => format!("Sarvam API error ({status}): {body}"),
    }
}
```

### Server Layer (TypeScript — Fastify `apps/server/src/index.ts`)

The catch block inspects the error `name` property to return the correct HTTP status code:

```typescript
catch (error) {
  if (error instanceof SarvamAuthError)     return reply.status(401).send({ error: error.message });
  if (error instanceof SarvamRateLimitError) return reply.status(429).send({ error: error.message });
  if (error instanceof SarvamBalanceError)  return reply.status(402).send({ error: error.message });
  // ... default 500
}
```

#### Rate-Limit Retry (429)

For `SarvamRateLimitError` only, the Fastify route wraps the `engine.translateAudio()` call with up to 3 retries using exponential backoff (2s → 4s → 8s). All other errors propagate immediately.

### Server Layer (Rust — Tauri command `apps/desktop/src-tauri/src/lib.rs`)

The `translate_audio` Tauri command includes a retry loop for `RATE_LIMIT:` prefixed errors:

```rust
const MAX_RETRIES: u32 = 3;
for attempt in 0..MAX_RETRIES {
    let result = engine.translate_audio(...).await;
    match &result {
        Ok(_) => return result,
        Err(e) if e.starts_with("RATE_LIMIT:") && attempt < MAX_RETRIES - 1 => {
            tokio::time::sleep(std::time::Duration::from_secs(2 * (attempt + 1))).await;
            continue;
        }
        _ => return result,
    }
}
```

### Frontend Layer

The error message from the server/Tauri IPC is dispatched directly via `dispatch(setError(message))` in `MicButton.tsx` and displayed in the `StatusBar` component. No additional parsing is needed — the human-readable messages from the provider layer are already user-ready.

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
# Personal Translator

An **open-source, extensible real-time audio translation web application** that captures microphone input, transcribes it, translates it, and plays back the translated audio — all running locally on your machine.

Built with **Next.js 15**, **Fastify v5**, and **Sarvam AI** APIs. Designed with a provider abstraction layer so you can swap in any STT / translation / TTS vendor (Deepgram, OpenAI, Whisper, etc.) without touching core logic.

---

## Architecture

```
┌─────────────────┐     POST /api/translate     ┌──────────────────────────┐
│   Browser (Mic) │  (multipart audio/wav)      │   Fastify Server (3001) │
│                 │ ──────────────────────────→  │                          │
│  MediaRecorder  │                              │  TranslationEngine       │
│  AudioContext   │                              │  ├─ ISTTProvider         │
│  Redux Toolkit  │                              │  ├─ ITranslationProvider │
│  Next.js (3000) │                              │  └─ ITTSProvider         │
│                 │ ←────────────────────────── │                          │
│  Speaker out    │     audio/wav response       │   Sarvam AI REST APIs   │
└─────────────────┘                              └──────────────────────────┘
```

The app follows a **decoupled client-server** architecture on localhost:

1. **Browser** captures audio via `MediaRecorder` (16kHz mono), converts WebM → WAV
2. **Client** sends the WAV blob as multipart `FormData` via Next.js rewrite proxy to `/api/translate`
3. **Server** runs the `TranslationEngine` pipeline: STT → Translate → TTS, calling Sarvam's REST APIs
4. **Server** returns the translated audio buffer (WAV)
5. **Browser** plays it back via `AudioContext.decodeAudioData` → `destination`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 15 (App Router), TypeScript 5.x strict |
| State Management | Redux Toolkit |
| Styling | Tailwind CSS v4 |
| Audio Capture | W3C `MediaRecorder` API + `AudioContext` |
| Backend | Node.js v22+, Fastify v5 |
| File Upload | `@fastify/multipart` |
| Speech-to-Text | Sarvam AI `saaras:v3` |
| Translation | Sarvam AI `mayura:v1` |
| Text-to-Speech | Sarvam AI `bulbul:v3` (voice: shubh) |
| E2E Testing | Playwright v1.61+ (with fake device flags) |
| Monorepo | Turborepo + npm workspaces |

---

## Project Structure

```
personal-translator/
├── package.json              # Turborepo root (npm workspaces)
├── turbo.json                # Build pipeline config
├── playwright.config.ts      # Playwright with fake mic flags
├── .env.example              # Environment variable template
├── tsconfig.base.json        # Shared TS strict config
├── build-msi.bat             # Windows .msi build script
├── apps/
│   ├── server/               # Fastify backend (@repo/server)
│   │   └── src/
│   │       ├── index.ts      # Server entry, route handler
│   │       ├── engine.ts     # TranslationEngine orchestrator
│   │       └── providers/
│   │           ├── factory.ts      # Provider factory (env-driven)
│   │           └── sarvam/         # Sarvam AI implementations
│   │               ├── stt.ts      # Speech-to-text (saaras:v3)
│   │               ├── translate.ts# Translation (mayura:v1)
│   │               └── tts.ts      # Text-to-speech (bulbul:v3)
│   └── desktop/              # Vite + React frontend + Tauri
│       ├── src/              # React app (components, store, lib)
│       ├── src-tauri/        # Tauri Rust backend
│       │   ├── src/
│       │   │   ├── lib.rs        # Tauri app entry, commands
│       │   │   ├── server.rs     # Embedded HTTP server (frontend)
│       │   │   ├── translate.rs  # TranslationEngine (Rust port)
│       │   │   └── keystore.rs   # API key encryption stubs
│       │   └── gen/android/  # Android Gradle project
│       ├── vite.config.ts
│       └── package.json
├── packages/
│   └── shared/               # Shared TypeScript interfaces
└── tests/
    ├── e2e/                  # Playwright test specifications
    └── fixtures/             # Synthetic WAV for fake mic input
```

---

## Setup

### Prerequisites

- **Node.js** v22+ (tested with v22.15.0)
- **npm** 10+
- **Sarvam AI API key** ([sign up](https://www.sarvam.ai/))

### Installation

```bash
git clone https://github.com/dwindervirk/personal-translator.git
cd personal-translator

# Install all dependencies (root + workspaces)
npm install

# Install Playwright Chromium browser
npx playwright install chromium
npx playwright install chromium-headless-shell
```

### Configuration

API keys are configured through the **Settings modal** in the app (gear icon ⚙). 
No .env file editing required.

If you prefer environment variables for development:

```bash
cp .env.example .env.local
```

Edit `.env.local` (optional — the UI Settings modal overrides this):

```ini
PORT=3001
HOST=127.0.0.1
# SARVAM_API_KEY is optional — use the Settings UI instead
SELECTED_STT_PROVIDER=sarvam
SELECTED_TRANSLATION_PROVIDER=sarvam
SELECTED_TTS_PROVIDER=sarvam
```

> **Security:** API keys are entered in the Settings modal and stored locally.
> `.env.local` is in `.gitignore` and will never be committed.
> The compiled `.msi` installer contains zero hardcoded keys.

### Build

```bash
# Build all packages
npm run build
# or: npx turbo build
```

---

## Running

Start both the backend and frontend. The frontend proxies `/api/*` requests to the backend automatically.

**Terminal 1 — Backend server (Fastify on port 3001):**
```bash
cd apps/server
npx tsx src/index.ts
```

**Terminal 2 — Frontend (Vite on port 3002):**
```bash
cd apps/desktop
npm run dev
```

Then open **http://localhost:3002** in your browser.

---

## Usage

1. Select **source language** (Auto-detect or a specific language)
2. Select **target language** (e.g., English, Punjabi, Hindi, etc.)
3. Click **Start Recording** — grant microphone access when prompted
4. Speak clearly into your microphone
5. Click **Stop Recording**
6. Wait while the pipeline transcribes, translates, and synthesizes audio
7. Translated speech plays back through your speakers

### Supported Languages

Auto-detect, English, Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese

---

## Extensibility: Adding New Providers

The provider abstraction allows swapping vendors by implementing three TypeScript interfaces:

```typescript
// packages/shared/src/interfaces.ts

export interface ISTTProvider {
  transcribe(audioData: Buffer, options?: {
    languageCode?: string;
    mode?: string;
  }): Promise<{ text: string; detectedLanguage?: string }>;
}

export interface ITranslationProvider {
  translate(text: string, sourceLang: string, targetLang: string):
    Promise<{ translatedText: string }>;
}

export interface ITTSProvider {
  synthesize(text: string, languageCode: string, options?: {
    voiceId?: string;
  }): Promise<Buffer>;
}
```

To add a new provider (e.g., Deepgram):
1. Create `apps/server/src/providers/deepgram/stt.ts` implementing `ISTTProvider`
2. Register it in `apps/server/src/providers/factory.ts`
3. Set `SELECTED_STT_PROVIDER=deepgram` in `.env.local`

No other code changes needed.

---

## Testing

### E2E Tests (Playwright)

Tests use a **synthetic WAV fixture** and Chromium's fake device flags — no real microphone needed.

```bash
# Run all E2E tests
npm test

# Run with detailed output
npx playwright test --reporter=list

# Interactive debug mode
npm run test:debug

# View HTML report
npm run test:report
```

The Playwright configuration auto-starts both the Fastify server and Next.js dev server via `webServer`, then launches Chromium with:

- `--use-fake-ui-for-media-stream` (auto-grants mic permission)
- `--use-fake-device-for-media-stream` (virtual mic device)
- `--use-file-for-fake-audio-capture=tests/fixtures/synthetic_voice_input.wav` (440Hz sine wave)

**6 tests covering:**
- Page load with correct title
- Language dropdown presence and interaction
- Start recording button states
- Full record → translate → playback pipeline

---

## API Reference

### `POST /api/translate`

Accepts a WAV audio file and returns translated audio.

**Request (multipart/form-data):**
| Field | Type | Description |
|-------|------|-------------|
| `file` | Audio/WAV | Recorded speech audio |

**Query Parameters:**
| Param | Default | Description |
|-------|---------|-------------|
| `targetLanguage` | `en-IN` | BCP-47 target language code |
| `sourceLanguage` | (auto) | BCP-47 source language code |
| `voiceId` | `shubh` | TTS voice profile |

**Response (200):** `audio/wav` binary buffer containing translated speech.

**Response (4xx/5xx):** `{ "error": "description" }`

---

## API Error Handling

The application handles Sarvam API errors with user-friendly messages and automatic retry logic.

| Error | HTTP Status | User-Facing Message |
|-------|:-----------:|---------------------|
| Invalid/expired API key | `401` / `403` | "Your API key is invalid. Check the key in Settings." |
| Rate limit exceeded | `429` | "Rate limit exceeded. Please wait a moment and try again." (retried 3× with exponential backoff) |
| Insufficient balance | `402` | "Your Sarvam account has insufficient credits." |
| Other failures | `500` | Descriptive message from the API |

Errors are displayed as a red dismissable banner in the app UI.

---

## Building for Windows Standalone

Package the desktop app as a standalone `.msi` installer with **Tauri**.

### Prerequisites

1. **Visual Studio 2022 Build Tools** with "Desktop development with C++" workload:
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools
   # Then open "Visual Studio Installer" → Modify → add "Desktop development with C++"
   ```
2. **Rust** (already installed above)

### Build Steps

```bash
# 1. Build the Vite frontend
cd apps/desktop && npm run build

# 2. Build the Fastify server TypeScript
cd ../server && npx tsc

# 3. Bundle the server into a standalone .exe
npx pkg dist/index.js --target node22-win-x64 --output ../desktop/src-tauri/binaries/server-x86_64-pc-windows-msvc.exe

# 4. Build the .msi installer
cd ../desktop && npx tauri build
```

Output: `apps/desktop/src-tauri/target/release/bundle/msi/Personal Translator_0.1.0_x64_en-US.msi`

Double-click to install — no terminal or Node.js needed on the user's machine.

### Development Mode

```bash
# Terminal 1: Fastify backend (port 3001)
cd apps/server && npx tsx src/index.ts

# Terminal 2: Vite frontend (port 3002)
cd apps/desktop && npm run dev
```

---

## Building for Android

Package as a standalone APK with **Tauri v2's native Android support**. The app runs completely standalone on the device — an embedded Rust HTTP server serves the frontend and handles translation via Sarvam APIs.

### Architecture (Android)

```
Android APK
┌────────────────────────────────────────────┐
│  Tauri WebView (React Vite app)            │
│  ├── Mic recording (MediaRecorder)         │
│  ├── Settings modal for API key            │
│  ├── Tauri IPC → Rust translate_audio()    │
│  └── AudioContext playback                 │
└──────────────┬─────────────────────────────┘
               │ IPC
┌──────────────▼────────────────────────────┐
│  Embedded Rust Backend (Tauri command)     │
│  ├── STT: reqwest → sarvam.ai             │
│  ├── Translate: reqwest → sarvam.ai       │
│  ├── TTS: reqwest → base64 decode         │
│  └── API key: EncryptedSharedPreferences  │
└────────────────────────────────────────────┘
```

### Prerequisites

1. **Java JDK 17+** (Temurin recommended):
   ```powershell
   winget install EclipseAdoptium.Temurin.17.JDK
   ```

2. **Android SDK** (command-line tools):
   ```powershell
   # Download and extract command-line tools
   curl.exe -L -o "$env:TEMP\cmdline-tools.zip" "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
   Expand-Archive "$env:TEMP\cmdline-tools.zip" -DestinationPath "$env:USERPROFILE\Android\Sdk\cmdline-tools\latest\" -Force
   # Install platform + NDK
   $env:ANDROID_HOME\cmdline-tools\latest\bin\sdkmanager.bat "platforms;android-34" "ndk;27.0.12077973" "platform-tools"
   ```

3. **Rust Android targets**:
   ```powershell
   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android i686-linux-android
   ```

### Build APK

```powershell
# Set environment variables
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:USERPROFILE\Android\Sdk"

# Build the Vite frontend
cd apps/desktop
npm run build

# Build the Rust library for Android
cd src-tauri
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER = "aarch64-linux-android21-clang.cmd"
cargo build --target aarch64-linux-android --release --lib

# Copy the library to the Android project
Copy-Item "target/aarch64-linux-android/release/libapp_lib.so" "gen/android/app/src/main/jniLibs/arm64-v8a/libapp_lib.so" -Force

# Build the APK
cd gen/android
gradlew assembleArm64Release -x :app:rustBuildArm64Debug -x :app:rustBuildArmDebug -x :app:rustBuildArmRelease
```

Output: `apps/desktop/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk`

### Install on Device

```powershell
# Enable Developer Options and USB Debugging on your phone
# Connect via USB
$env:ANDROID_HOME\platform-tools\adb.exe install -r apps\desktop\src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk
```

The app appears as **"Personal Translator"** in your app drawer. On first launch:
1. Grant the **RECORD_AUDIO** permission prompt
2. Tap the gear icon (⚙) → enter your Sarvam API key → **Save**
3. Select source/target languages
4. Tap **Start Recording**, grant the browser mic prompt, speak
5. Translated audio plays back through your device speakers

---

## Built With

| Tool | Version | Purpose |
|------|---------|---------|
| Turborepo | 2.10.2 | Monorepo build orchestration |
| Vite | 6.4 | Frontend build tool |
| React | 19.1.0 | UI library |
| Redux Toolkit | 2.8+ | State management |
| Tailwind CSS | 4.1 | Utility-first CSS |
| Fastify | 5.3 | Backend HTTP framework |
| TypeScript | 5.8 | Type safety |
| Playwright | 1.61.1 | E2E testing |
| Tauri | 2.11 | Desktop + Android app wrapper |
| Axum (Rust) | 0.8 | Embedded HTTP server |
| reqwest (Rust) | 0.12 | HTTP client for Sarvam APIs |

---

## License

MIT

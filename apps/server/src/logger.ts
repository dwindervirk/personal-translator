const MAX_LOG_ENTRIES = 500;

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

const logs: LogEntry[] = [];

export function captureLog(level: string, message: string) {
  logs.push({ timestamp: new Date().toISOString(), level, message });
  if (logs.length > MAX_LOG_ENTRIES) logs.shift();
}

export function getLogs(): LogEntry[] {
  return [...logs];
}

const originalError = console.error;
console.error = (...args: unknown[]) => {
  captureLog("ERROR", args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
  originalError.apply(console, args);
};

const originalLog = console.log;
console.log = (...args: unknown[]) => {
  captureLog("LOG", args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "));
  originalLog.apply(console, args);
};

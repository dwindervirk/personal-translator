import { useState, useEffect, useRef, useCallback } from "react";

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export function LogPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const apiBase = (window as any).__API_PORT__
        ? `http://127.0.0.1:${(window as any).__API_PORT__}`
        : "";
      const res = await fetch(`${apiBase}/api/logs`);
      if (res.ok) setLogs(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [open, fetchLogs]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, open]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <button
        onClick={() => setOpen(!open)}
        className="mx-auto block rounded-t-lg border border-border border-b-0 bg-surface px-4 py-1.5 text-xs text-muted transition-colors duration-150 hover:text-ink"
      >
        {open ? "Hide Logs" : "Show Logs"}
      </button>
      {open && (
        <div className="h-48 overflow-y-auto border-t border-border bg-bg-alt px-3 py-2 font-mono text-xs leading-relaxed text-muted">
          {logs.length === 0 && (
            <div className="italic text-muted/50">No logs yet</div>
          )}
          {logs.map((entry, i) => (
            <div key={i} className={entry.level === "ERROR" ? "text-error" : ""}>
              <span className="mr-2 text-muted/40">{entry.timestamp.slice(11, 19)}</span>
              <span>{entry.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

type LogEntry = {
  id: number;
  source: "playwright" | "script";
  level: string;
  text: string;
  time: number;
};

type Props = {
  linkId: number;
  onDryRun: () => void;
  dryRunning: boolean;
};

const POLL_INTERVAL_MS = 500;

export default function ConsolePanel({ linkId, onDryRun, dryRunning }: Props) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showPlaywright, setShowPlaywright] = useState(true);
  const [showScript, setShowScript] = useState(true);
  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/v1/links/${linkId}/live-session/logs?since=${lastIdRef.current}`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const newLogs: LogEntry[] = data.response?.logs ?? [];
        if (newLogs.length) {
          lastIdRef.current = newLogs[newLogs.length - 1].id;
          setLogs((prev) => [...prev, ...newLogs].slice(-500));
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [linkId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [logs]);

  const visibleLogs = logs.filter(
    (log) =>
      (log.source === "playwright" && showPlaywright) ||
      (log.source === "script" && showScript)
  );

  return (
    <div className="flex flex-col h-full border-t border-neutral-content">
      <div className="flex justify-between items-center gap-3 p-2 border-b border-neutral-content bg-base-200">
        <div className="flex gap-3 items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={onDryRun}
            disabled={dryRunning}
          >
            {t("dry_run")}
          </Button>
          <label className="flex items-center gap-1 text-sm">
            <Checkbox
              checked={showPlaywright}
              onCheckedChange={(c) => setShowPlaywright(c === true)}
            />
            {t("console_filter_playwright")}
          </label>
          <label className="flex items-center gap-1 text-sm">
            <Checkbox
              checked={showScript}
              onCheckedChange={(c) => setShowScript(c === true)}
            />
            {t("console_filter_script")}
          </label>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="grow overflow-y-auto bg-black font-mono text-xs p-2"
      >
        {visibleLogs.map((log) => (
          <div
            key={log.id}
            className={
              log.level === "error"
                ? "text-red-400"
                : log.level === "warn" || log.level === "warning"
                  ? "text-yellow-400"
                  : "text-neutral-300"
            }
          >
            <span className="text-neutral-500">[{log.source}]</span>{" "}
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
}

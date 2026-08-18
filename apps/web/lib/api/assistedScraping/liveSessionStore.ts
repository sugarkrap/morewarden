import { Browser, BrowserContext, Page } from "playwright";
import {
  launchBrowser,
  getDefaultContextOptions,
} from "@linkwarden/lib/browser";
import protectPageRequests from "@linkwarden/lib/protectPageRequests";
import { assertUrlIsSafeForServerSideFetch } from "@linkwarden/lib/ssrf";

export type LogEntry = {
  id: number;
  source: "playwright" | "script";
  level: string;
  text: string;
  time: number;
};

type LiveSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  activePage: Page;
  logs: LogEntry[];
  nextLogId: number;
  lastActivity: number;
};

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_LOGS = 500;
const sessions = new Map<string, LiveSession>();

setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, sessionKey) => {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS)
      closeLiveSession(sessionKey);
  });
}, 60_000);

export function pushLog(
  session: LiveSession,
  source: LogEntry["source"],
  level: string,
  text: string
) {
  session.logs.push({ id: session.nextLogId++, source, level, text, time: Date.now() });
  if (session.logs.length > MAX_LOGS) {
    session.logs.splice(0, session.logs.length - MAX_LOGS);
  }
}

function attachConsoleCapture(session: LiveSession, page: Page) {
  page.on("console", (msg) => {
    pushLog(session, "playwright", msg.type(), msg.text());
  });
  page.on("pageerror", (err) => {
    pushLog(session, "playwright", "error", err.message);
  });
}

export async function getOrCreateLiveSession(
  sessionKey: string,
  url: string
) {
  const existing = sessions.get(sessionKey);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }

  await assertUrlIsSafeForServerSideFetch(url);

  const browser = await launchBrowser();
  const context = await browser.newContext(getDefaultContextOptions());

  let sessionAwaitingItsLogs: LiveSession | undefined;
  await protectPageRequests(context, (message) => {
    if (sessionAwaitingItsLogs) {
      pushLog(sessionAwaitingItsLogs, "playwright", "warning", message);
    }
  });

  const page = await context.newPage();

  const session: LiveSession = {
    browser,
    context,
    page,
    activePage: page,
    logs: [],
    nextLogId: 1,
    lastActivity: Date.now(),
  };

  sessionAwaitingItsLogs = session;

  attachConsoleCapture(session, page);
  context.on("page", (newPage) => {
    session.activePage = newPage;
    attachConsoleCapture(session, newPage);
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

  sessions.set(sessionKey, session);
  return session;
}

export function getLiveSession(sessionKey: string) {
  const session = sessions.get(sessionKey);
  if (session) session.lastActivity = Date.now();
  return session;
}

export async function closeLiveSession(sessionKey: string) {
  const session = sessions.get(sessionKey);
  if (!session) return;
  sessions.delete(sessionKey);
  await session.browser.close().catch(() => {});
}

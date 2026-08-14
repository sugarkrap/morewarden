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
const sessions = new Map<number, LiveSession>();

setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, linkId) => {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) closeLiveSession(linkId);
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

export async function getOrCreateLiveSession(linkId: number, url: string) {
  const existing = sessions.get(linkId);
  if (existing) {
    existing.lastActivity = Date.now();
    return existing;
  }

  await assertUrlIsSafeForServerSideFetch(url);

  const browser = await launchBrowser();
  const context = await browser.newContext(getDefaultContextOptions());
  await protectPageRequests(context);
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

  attachConsoleCapture(session, page);
  context.on("page", (newPage) => {
    session.activePage = newPage;
    attachConsoleCapture(session, newPage);
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

  sessions.set(linkId, session);
  return session;
}

export function getLiveSession(linkId: number) {
  const session = sessions.get(linkId);
  if (session) session.lastActivity = Date.now();
  return session;
}

export async function closeLiveSession(linkId: number) {
  const session = sessions.get(linkId);
  if (!session) return;
  sessions.delete(linkId);
  await session.browser.close().catch(() => {});
}

import { Browser, BrowserContext, Page } from "playwright";
import {
  launchBrowser,
  getDefaultContextOptions,
} from "@linkwarden/lib/browser";
import protectPageRequests from "@linkwarden/lib/protectPageRequests";
import { assertUrlIsSafeForServerSideFetch } from "@linkwarden/lib/ssrf";

type LiveSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  lastActivity: number;
};

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const sessions = new Map<number, LiveSession>();

setInterval(() => {
  const now = Date.now();
  sessions.forEach((session, linkId) => {
    if (now - session.lastActivity > IDLE_TIMEOUT_MS) closeLiveSession(linkId);
  });
}, 60_000);

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
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

  const session: LiveSession = {
    browser,
    context,
    page,
    lastActivity: Date.now(),
  };
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

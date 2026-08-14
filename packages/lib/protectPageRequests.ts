import { BrowserContext, Route } from "playwright";
import { UnsafeUrlError } from "@linkwarden/lib/ssrf";
import { safeFetch } from "@linkwarden/lib/safeFetch";

function isNonNetworkUrl(url: string) {
  return (
    url.startsWith("about:") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  );
}

export default async function protectPageRequests(context: BrowserContext) {
  await context.route("**/*", async (route: Route) => {
    const request = route.request();

    if (isNonNetworkUrl(request.url())) {
      await route.continue();
      return;
    }

    try {
      const headers = request.headers();
      delete headers["accept-encoding"];
      delete headers["content-length"];
      delete headers["host"];

      const response = await safeFetch(request.url(), {
        method: request.method(),
        headers,
        body: request.postDataBuffer() ?? undefined,
      });

      const responseHeaders = Object.fromEntries(response.headers.entries());
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];

      await route.fulfill({
        status: response.status,
        headers: responseHeaders,
        body: await response.buffer(),
      });
    } catch (error) {
      await route.abort(
        error instanceof UnsafeUrlError ? "blockedbyclient" : "failed"
      );
    }
  });
}

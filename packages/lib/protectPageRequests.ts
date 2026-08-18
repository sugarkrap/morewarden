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

function maxResourceBytesTheRendererCanAbsorb() {
  return (
    1024 * 1024 * Number(process.env.PAGE_RESOURCE_MAX_BUFFER_MB || 50)
  );
}

function describeOversizedResource(url: string, bytes: number) {
  return `Skipped a ${Math.round(
    bytes / (1024 * 1024)
  )}MB page resource that would have crashed the browser: ${url}`;
}

export default async function protectPageRequests(
  context: BrowserContext,
  onOversizedResourceSkipped?: (message: string) => void
) {
  const maxBytes = maxResourceBytesTheRendererCanAbsorb();

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

      const declaredLength = Number(response.headers.get("content-length"));
      if (declaredLength > maxBytes) {
        onOversizedResourceSkipped?.(
          describeOversizedResource(request.url(), declaredLength)
        );
        await route.abort("failed");
        return;
      }

      const body = await response.buffer();
      if (body.length > maxBytes) {
        onOversizedResourceSkipped?.(
          describeOversizedResource(request.url(), body.length)
        );
        await route.abort("failed");
        return;
      }

      const responseHeaders = Object.fromEntries(response.headers.entries());
      delete responseHeaders["content-encoding"];
      delete responseHeaders["content-length"];
      delete responseHeaders["transfer-encoding"];

      await route.fulfill({
        status: response.status,
        headers: responseHeaders,
        body,
      });
    } catch (error) {
      await route.abort(
        error instanceof UnsafeUrlError ? "blockedbyclient" : "failed"
      );
    }
  });
}

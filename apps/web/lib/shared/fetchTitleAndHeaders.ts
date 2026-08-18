import { safeFetch } from "@linkwarden/lib/safeFetch";

function charsetFromContentType(contentType: string | null): string | null {
  const match = contentType?.match(/charset=([^;]+)/i);
  return match?.[1]?.trim().toLowerCase().replace(/^["']|["']$/g, "") || null;
}

function charsetFromMetaTag(bytes: Buffer): string | null {
  const head = bytes.subarray(0, 2048).toString("latin1");
  const match = head.match(/<meta[^>]+charset=["']?\s*([^"'\s/>]+)/i);
  return match?.[1]?.toLowerCase() || null;
}

async function decodeHtmlResponse(response: any): Promise<string> {
  const bytes = Buffer.from(await response.arrayBuffer());
  const charset =
    charsetFromContentType(response.headers.get("content-type")) ||
    charsetFromMetaTag(bytes) ||
    "utf-8";

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export default async function fetchTitleAndHeaders(
  url: string,
  content?: string
) {
  if (!content && !url?.startsWith("http://") && !url?.startsWith("https://"))
    return { title: "", headers: null };

  try {
    const responsePromise = content ? Promise.resolve(null) : safeFetch(url);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Fetch title timeout"));
      }, 10 * 1000); // Stop after 10 seconds
    });

    const response = await Promise.race([responsePromise, timeoutPromise]);

    if ((response as any)?.status || content) {
      let text: string;

      if (content) {
        text = content;
      } else {
        text = await decodeHtmlResponse(response);
      }

      const headers = (response as Response | null)?.headers || null;

      // regular expression to find the <title> tag
      let match = text.match(/<title.*>([^<]*)<\/title>/);

      const title = match?.[1] || "";

      return { title, headers };
    } else {
      return { title: "", headers: null };
    }
  } catch (err) {
    console.log(err);
    return { title: "", headers: null };
  }
}

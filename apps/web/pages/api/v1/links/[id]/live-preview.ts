import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { prisma } from "@linkwarden/prisma";
import { UsersAndCollections } from "@linkwarden/prisma/client";
import getPermission from "@/lib/api/getPermission";
import verifyUser from "@/lib/api/verifyUser";
import { safeFetch } from "@linkwarden/lib/safeFetch";

const PICKER_SCRIPT = `
(function () {
  var picking = false;
  var overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;pointer-events:none;z-index:2147483647;" +
    "background:rgba(236,72,153,0.25);outline:2px solid rgb(236,72,153);display:none;";
  document.documentElement.appendChild(overlay);

  function cssPath(el) {
    if (el.id) return "#" + CSS.escape(el.id);
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      if (node.id) {
        parts.unshift("#" + CSS.escape(node.id));
        break;
      }
      var selector = node.tagName.toLowerCase();
      var sibling = node;
      var nth = 1;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === node.tagName) nth++;
      }
      selector += ":nth-of-type(" + nth + ")";
      parts.unshift(selector);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  document.addEventListener(
    "mouseover",
    function (e) {
      if (!picking) return;
      var rect = e.target.getBoundingClientRect();
      overlay.style.display = "block";
      overlay.style.left = rect.left + "px";
      overlay.style.top = rect.top + "px";
      overlay.style.width = rect.width + "px";
      overlay.style.height = rect.height + "px";
    },
    true
  );

  document.addEventListener(
    "click",
    function (e) {
      if (!picking) return;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage(
        { type: "morewarden:selector-picked", selector: cssPath(e.target) },
        "*"
      );
    },
    true
  );

  window.addEventListener("message", function (e) {
    var data = e.data || {};
    if (data.type === "morewarden:toggle-picker") {
      picking = !!data.enabled;
      if (!picking) overlay.style.display = "none";
    }
  });

  window.parent.postMessage({ type: "morewarden:ready" }, "*");
})();
`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const user = await verifyUser({ req, res });
  if (!user) return;

  const linkId = Number(req.query.id);
  if (!linkId) {
    return res.status(400).json({ response: "Invalid parameters." });
  }

  const collectionIsAccessible = await getPermission({
    userId: user.id,
    linkId,
  });
  const memberHasAccess = collectionIsAccessible?.members.some(
    (e: UsersAndCollections) => e.userId === user.id && e.canUpdate
  );

  if (
    !collectionIsAccessible ||
    !(collectionIsAccessible.ownerId === user.id || memberHasAccess)
  ) {
    return res.status(401).json({ response: "Collection is not accessible." });
  }

  const link = await prisma.link.findUnique({ where: { id: linkId } });
  if (!link?.url || !link.assistedScraping) {
    return res.status(400).json({
      response: "This link does not have assisted scraping enabled.",
    });
  }

  try {
    const upstream = await safeFetch(link.url);
    const html = await upstream.text();

    const dom = new JSDOM(html, { url: link.url });
    const { document } = dom.window;

    const base = document.createElement("base");
    base.setAttribute("href", link.url);
    document.head?.prepend(base);

    const script = document.createElement("script");
    script.textContent = PICKER_SCRIPT;
    document.body?.appendChild(script);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(dom.serialize());
  } catch (error: any) {
    return res.status(502).json({
      response: error?.message || "Failed to load the live page.",
    });
  }
}

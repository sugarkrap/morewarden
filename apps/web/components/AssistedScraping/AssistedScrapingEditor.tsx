import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import toast from "react-hot-toast";
import { useGetLink, useDeleteLink } from "@linkwarden/router/links";
import { Button } from "@/components/ui/button";
import LiveScreenPreview from "./LiveScreenPreview";

const STUB_SCRIPT = `async function before(context) {
  // Runs before the page is scraped. \`context\` is a Playwright
  // BrowserContext you can use to set cookies, headers, viewport, etc.
}

async function after(page, api) {
  // Runs after the page has been scraped. \`page\` is the Playwright Page.
  // \`api\` exposes our own helpers, e.g.:
  //   await api.addFileToArchive(buffer, "application/x-shockwave-flash");
}
`;

export default function AssistedScrapingEditor() {
  const router = useRouter();
  const { t } = useTranslation();
  const linkId = Number(router.query.id);

  const { data: link } = useGetLink({ id: linkId, enabled: router.isReady });
  const deleteLink = useDeleteLink({ toast, t });

  const [script, setScript] = useState(STUB_SCRIPT);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  const handleCancel = async () => {
    if (!linkId) return;
    await deleteLink.mutateAsync(linkId);
    router.push("/dashboard");
  };

  const handleSave = async () => {
    if (!linkId) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/links/${linkId}/assisted-scraping`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hookScript: script }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.response);

      toast.success(t("saved"));
      router.push(`/links/${linkId}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectorPicked = (selector: string) => {
    navigator.clipboard.writeText(selector);
    toast.success(t("selector_copied", { selector }));
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center gap-2 p-2 border-b border-neutral-content bg-base-200">
        <p className="truncate pl-2">
          {link?.name || link?.url || t("loading")}
        </p>

        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={handleCancel}>
            {t("cancel")}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {t("save")}
          </Button>
        </div>
      </div>

      <div className="grow grid grid-cols-2 min-h-0">
        <div className="border-r border-neutral-content">
          <Editor
            language="javascript"
            theme="vs-dark"
            value={script}
            onChange={(value) => setScript(value ?? "")}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex justify-end p-2 border-b border-neutral-content bg-base-200">
            <Button
              variant={picking ? "primary" : "ghost"}
              size="sm"
              onClick={() => setPicking(!picking)}
            >
              {picking ? t("selector_picker_on") : t("selector_picker_off")}
            </Button>
          </div>
          {link?.url ? (
            <LiveScreenPreview
              linkId={linkId}
              picking={picking}
              onSelectorPicked={handleSelectorPicked}
            />
          ) : (
            <div className="grow flex items-center justify-center bg-base-200 text-neutral">
              {t("loading")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import toast from "react-hot-toast";
import { useGetLink, useDeleteLink } from "@linkwarden/router/links";
import {
  useScripts,
  useCreateScript,
  useDeleteScript,
  HookScript,
} from "@linkwarden/router/scripts";
import { Button } from "@/components/ui/button";
import TextInput from "@/components/TextInput";
import LiveScreenPreview from "./LiveScreenPreview";
import ConsolePanel from "./ConsolePanel";
import ScriptStashDropdown from "./ScriptStashDropdown";

const STUB_SCRIPT = `async function before(context) {
  // Runs before the page is scraped. \`context\` is a Playwright
  // BrowserContext you can use to set cookies, headers, viewport, etc.
}

async function after(page, api) {
  // Runs after the page has been scraped. \`page\` is the Playwright Page.
  // \`api\` exposes our own helpers, e.g. to download a large file directly
  // (fetched server-side, not inside the page, so it's fast and safe even
  // for large files):
  //   const buffer = await api.fetchUrl(someUrl);
  //   await api.addFileToArchive(buffer, "application/x-shockwave-flash", "game.swf");
}
`;

type Props = {
  standalone?: boolean;
};

export default function AssistedScrapingEditor({ standalone }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const linkId = Number(router.query.id);

  const { data: link } = useGetLink({
    id: linkId,
    enabled: !standalone && router.isReady,
  });
  const deleteLink = useDeleteLink({ toast, t });

  const { data: scripts = [] } = useScripts();
  const createScript = useCreateScript();
  const deleteScript = useDeleteScript();

  const [script, setScript] = useState(STUB_SCRIPT);
  const [loadedScript, setLoadedScript] = useState<HookScript | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [activeUrl, setActiveUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const editorRef = useRef<any>(null);
  const scriptLoadedFromLinkRef = useRef(false);

  useEffect(() => {
    if (standalone) return;
    if (scriptLoadedFromLinkRef.current) return;
    if (!link) return;

    scriptLoadedFromLinkRef.current = true;
    if (link.hookScript) setScript(link.hookScript);
  }, [standalone, link]);

  const handleCancel = async () => {
    if (standalone) {
      router.push("/dashboard");
      return;
    }

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
      router.push(
        `/collections/${link?.collection.id}?openLinkId=${linkId}`
      );
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = async () => {
    const url = urlInput.trim() || activeUrl;
    if (!url) return;
    setAddingLink(true);
    try {
      const scriptId =
        loadedScript && loadedScript.content === script
          ? loadedScript.id
          : (await createScript.mutateAsync({ content: script })).id;

      router.push({
        pathname: "/dashboard",
        query: { newLinkUrl: url, newLinkScriptId: scriptId },
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAddingLink(false);
    }
  };

  const handleGo = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setActiveUrl(trimmed);
    setSessionId(crypto.randomUUID());
  };

  const handleDryRun = async () => {
    if (!previewSessionId) return;
    setDryRunning(true);
    try {
      await fetch(`/api/v1/links/${previewSessionId}/live-session/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script }),
      });
    } finally {
      setDryRunning(false);
    }
  };

  const handleSelectorPicked = (selector: string) => {
    const editorInstance = editorRef.current;
    const position = editorInstance?.getPosition();

    if (editorInstance && position) {
      editorInstance.executeEdits("selector-picker", [
        {
          range: {
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          },
          text: JSON.stringify(selector),
        },
      ]);
      editorInstance.focus();
    } else {
      navigator.clipboard.writeText(selector);
    }

    toast.success(t("selector_copied", { selector }));
  };

  const handleScriptSelected = (selected: HookScript) => {
    setScript(selected.content);
    setLoadedScript(selected);
  };

  const handleScriptCreated = async (name: string) => {
    try {
      const created = await createScript.mutateAsync({ name, content: script });
      setLoadedScript(created);
      toast.success(t("saved"));
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleScriptDeleted = async (id: number) => {
    try {
      await deleteScript.mutateAsync(id);
      if (loadedScript?.id === id) setLoadedScript(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const previewUrl = standalone ? activeUrl : link?.url;
  const previewSessionId = standalone ? sessionId : linkId ? String(linkId) : "";

  return (
    <div className="flex flex-col h-screen">
      <div className="flex justify-between items-center gap-2 p-2 border-b border-neutral-content bg-base-200">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <i className="bi-chevron-left text-lg text-neutral" />
          </Button>
          <p className="truncate">
            {standalone
              ? t("open_script_editor")
              : link?.name || link?.url || t("loading")}
          </p>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          <ScriptStashDropdown
            scripts={scripts}
            onSelect={handleScriptSelected}
            onCreate={handleScriptCreated}
            onDelete={handleScriptDeleted}
          />
          {standalone ? (
            <Button
              variant="primary"
              onClick={handleAddLink}
              disabled={addingLink || !(urlInput.trim() || activeUrl)}
            >
              {t("add_a_link")}
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {t("save")}
            </Button>
          )}
        </div>
      </div>

      <div className="grow grid grid-cols-2 min-h-0">
        <div className="border-r border-neutral-content">
          <Editor
            language="javascript"
            theme="vs-dark"
            value={script}
            onChange={(value) => setScript(value ?? "")}
            onMount={(editorInstance) => {
              editorRef.current = editorInstance;
            }}
            options={{ minimap: { enabled: false }, fontSize: 13 }}
          />
        </div>

        <div className="flex flex-col min-h-0">
          <div className="flex justify-between items-center gap-2 p-2 border-b border-neutral-content bg-base-200">
            {standalone ? (
              <div className="flex gap-2 grow">
                <TextInput
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleGo();
                  }}
                  placeholder={t("link_url_placeholder")}
                  className="bg-base-100"
                />
                <Button variant="default" size="sm" onClick={handleGo}>
                  {t("go")}
                </Button>
              </div>
            ) : (
              <div />
            )}
            <Button
              variant={picking ? "primary" : "ghost"}
              size="sm"
              onClick={() => setPicking(!picking)}
            >
              {picking ? t("selector_picker_on") : t("selector_picker_off")}
            </Button>
          </div>

          <div className="flex flex-col h-3/5 min-h-0">
            {previewUrl && previewSessionId ? (
              <LiveScreenPreview
                key={previewSessionId}
                sessionId={previewSessionId}
                url={previewUrl}
                picking={picking}
                onSelectorPicked={handleSelectorPicked}
                onPickingCancelled={() => setPicking(false)}
              />
            ) : (
              <div className="grow flex items-center justify-center bg-base-200 text-neutral">
                {standalone ? t("enter_a_url_to_preview") : t("loading")}
              </div>
            )}
          </div>

          <div className="h-2/5 min-h-0">
            {previewUrl && previewSessionId && (
              <ConsolePanel
                sessionId={previewSessionId}
                onDryRun={handleDryRun}
                dryRunning={dryRunning}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

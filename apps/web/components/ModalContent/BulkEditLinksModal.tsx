import React, { useMemo, useState } from "react";
import CollectionSelection from "@/components/InputSelect/CollectionSelection";
import TagSelection from "@/components/InputSelect/TagSelection";
import useLinkStore from "@/store/links";
import { LinkIncludingShortenedCollectionAndTags } from "@linkwarden/types/global";
import toast from "react-hot-toast";
import Modal from "../Modal";
import { useTranslation } from "next-i18next";
import { useBulkEditLinks } from "@linkwarden/router/links";
import { useConfig } from "@linkwarden/router/config";
import { useScripts } from "@linkwarden/router/scripts";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

const MIXED = "mixed";
const UNCHANGED = "unchanged";

type Props = {
  onClose: Function;
  links?: LinkIncludingShortenedCollectionAndTags[];
};

function sharedValueAcross<T>(values: T[]): T | typeof MIXED | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values;
  return rest.every((value) => value === first) ? first : MIXED;
}

export default function BulkEditLinksModal({ onClose, links = [] }: Props) {
  const { t } = useTranslation();
  const { selectedIds, clearSelected, selectionCount } = useLinkStore();
  const [submitLoader, setSubmitLoader] = useState(false);
  const [removePreviousTags, setRemovePreviousTags] = useState(false);
  const [updatedValues, setUpdatedValues] = useState<
    Pick<LinkIncludingShortenedCollectionAndTags, "tags" | "collectionId">
  >({ tags: [] });

  const { data: config } = useConfig();
  const { data: scripts = [] } = useScripts();

  const selectedLinks = useMemo(
    () => links.filter((link) => link.id && selectedIds[link.id]),
    [links, selectedIds]
  );

  const sharedAssistedScraping = useMemo(
    () => sharedValueAcross(selectedLinks.map((link) => link.assistedScraping)),
    [selectedLinks]
  );

  const sharedHookScript = useMemo(
    () => sharedValueAcross(selectedLinks.map((link) => link.hookScript)),
    [selectedLinks]
  );

  const [assistedScraping, setAssistedScraping] = useState<
    boolean | typeof MIXED | undefined
  >(undefined);
  const [hookScriptChoice, setHookScriptChoice] = useState<string>(UNCHANGED);

  const effectiveAssistedScraping =
    assistedScraping === undefined ? sharedAssistedScraping : assistedScraping;

  const scriptMatchingSharedContent =
    sharedHookScript && sharedHookScript !== MIXED
      ? scripts.find((script) => script.content === sharedHookScript)
      : undefined;

  const hookScriptSelectValue =
    hookScriptChoice !== UNCHANGED
      ? hookScriptChoice
      : sharedHookScript === MIXED
        ? MIXED
        : scriptMatchingSharedContent
          ? String(scriptMatchingSharedContent.id)
          : UNCHANGED;

  const updateLinks = useBulkEditLinks();
  const setCollection = (e: any) => {
    const collectionId = e?.value || null;
    setUpdatedValues((prevValues) => ({ ...prevValues, collectionId }));
  };

  const setTags = (e: any) => {
    const tags = e.map((tag: any) => ({ name: tag.label }));
    setUpdatedValues((prevValues) => ({ ...prevValues, tags }));
  };

  const submit = async () => {
    if (!submitLoader) {
      setSubmitLoader(true);

      const load = toast.loading(t("updating"));

      const links = Object.keys(selectedIds).map((k) => ({
        id: Number(k),
      }));

      const chosenScript =
        hookScriptChoice !== UNCHANGED && hookScriptChoice !== MIXED
          ? scripts.find((script) => String(script.id) === hookScriptChoice)
          : undefined;

      await updateLinks.mutateAsync(
        {
          links,
          newData: {
            ...updatedValues,
            ...(typeof assistedScraping === "boolean"
              ? { assistedScraping }
              : {}),
            ...(chosenScript ? { hookScript: chosenScript.content } : {}),
          },
          removePreviousTags,
        },
        {
          onSettled: (data, error) => {
            setSubmitLoader(false);
            toast.dismiss(load);

            if (error) {
              toast.error(error.message);
            } else {
              clearSelected();
              onClose();
              toast.success(t("updated"));
            }
          },
        }
      );
    }
  };

  return (
    <Modal toggleModal={onClose}>
      <p className="text-xl font-thin">
        {selectionCount === 1
          ? t("edit_link")
          : t("edit_links", { count: selectionCount })}
      </p>
      <Separator className="my-3" />

      <div className="mt-5">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="mb-2">{t("move_to_collection")}</p>
            <CollectionSelection
              showDefaultValue={false}
              onChange={setCollection}
              creatable={false}
            />
          </div>

          <div>
            <p className="mb-2">{t("add_tags")}</p>
            <TagSelection onChange={setTags} />
          </div>
        </div>
        <div className="sm:ml-auto w-1/2 p-3">
          <label className="flex items-center gap-2 ">
            <input
              type="checkbox"
              className="checkbox checkbox-primary"
              checked={removePreviousTags}
              onChange={(e) => setRemovePreviousTags(e.target.checked)}
            />
            {t("remove_previous_tags")}
          </label>
        </div>

        {config?.ASSISTED_SCRAPING_ENABLED && (
          <>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-assisted-scraping"
                checked={
                  effectiveAssistedScraping === MIXED
                    ? "indeterminate"
                    : effectiveAssistedScraping === true
                }
                onCheckedChange={(checked) =>
                  setAssistedScraping(checked === true)
                }
              />
              <label
                htmlFor="bulk-assisted-scraping"
                className="text-sm select-none"
              >
                {t("enable_assisted_scraping")}
              </label>
            </div>

            {effectiveAssistedScraping !== false && (
              <div className="mt-3">
                <p className="mb-2">{t("scraping_script")}</p>
                <select
                  value={hookScriptSelectValue}
                  onChange={(e) => setHookScriptChoice(e.target.value)}
                  className={`w-full rounded-md p-2 border-neutral-content bg-base-200 focus:border-primary border-solid border outline-none duration-100 ${
                    hookScriptSelectValue === MIXED ||
                    hookScriptSelectValue === UNCHANGED
                      ? "text-neutral"
                      : ""
                  }`}
                >
                  {hookScriptSelectValue === MIXED && (
                    <option value={MIXED}>{t("multiple_scripts")}</option>
                  )}
                  <option value={UNCHANGED}>{t("leave_unchanged")}</option>
                  {scripts.map((script) => (
                    <option key={script.id} value={script.id}>
                      {script.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-end items-center mt-5">
        <Button variant="primary" onClick={submit}>
          {t("save_changes")}
        </Button>
      </div>
    </Modal>
  );
}

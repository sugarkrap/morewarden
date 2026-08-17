import { useEffect } from "react";
import { useRouter } from "next/router";

export type NewLinkPrefill = {
  url?: string;
  assistedScraping?: boolean;
  hookScriptId?: number;
};

export default function useAutoOpenNewLinkModal(
  setNewLinkModal: (value: boolean) => void,
  setPrefill: (value: NewLinkPrefill | undefined) => void
) {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !router.query.newLinkUrl) return;

    setPrefill({
      url: router.query.newLinkUrl as string,
      assistedScraping: true,
      hookScriptId: router.query.newLinkScriptId
        ? Number(router.query.newLinkScriptId)
        : undefined,
    });
    setNewLinkModal(true);

    const { newLinkUrl, newLinkScriptId, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
    });
  }, [router.isReady, router.query.newLinkUrl, router.query.newLinkScriptId]);
}

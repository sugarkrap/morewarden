import { useEffect } from "react";
import { useRouter } from "next/router";

export default function useAutoOpenLinkModal(
  linkId: number | undefined,
  setLinkModal: (value: boolean) => void
) {
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !linkId) return;
    if (Number(router.query.openLinkId) !== linkId) return;

    setLinkModal(true);

    const { openLinkId, ...rest } = router.query;
    router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
    });
  }, [router.isReady, router.query.openLinkId, linkId]);
}

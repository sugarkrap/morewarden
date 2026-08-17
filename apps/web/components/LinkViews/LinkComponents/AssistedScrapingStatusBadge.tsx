import { useTranslation } from "next-i18next";
import {
  getAssistedScrapingStatus,
  AssistedScrapingStatus,
} from "@linkwarden/lib/formatStats";
import { LinkIncludingShortenedCollectionAndTags } from "@linkwarden/types/global";

const STATUS_ICON: Record<AssistedScrapingStatus, string> = {
  draft: "bi-pencil-fill",
  queued: "bi-hourglass-split",
  error: "bi-exclamation-triangle-fill",
  success: "bi-check-circle-fill",
};

const STATUS_COLOR: Record<AssistedScrapingStatus, string> = {
  draft: "text-neutral",
  queued: "text-warning",
  error: "text-error",
  success: "text-success",
};

export default function AssistedScrapingStatusBadge({
  link,
  positionClassName,
}: {
  link: LinkIncludingShortenedCollectionAndTags;
  positionClassName?: string;
}) {
  const { t } = useTranslation();
  const status = getAssistedScrapingStatus(link);
  if (!status) return null;

  return (
    <div
      className={`bg-base-200 bg-opacity-80 rounded-full p-1.5 flex items-center justify-center leading-none ${
        positionClassName || ""
      }`}
    >
      <i
        className={`${STATUS_ICON[status]} ${STATUS_COLOR[status]}`}
        title={t(`assisted_scraping_status_${status}`)}
      />
    </div>
  );
}

import { LinkFile } from "@linkwarden/prisma/client";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { FLASH_MIME_TYPE } from "@linkwarden/types/global";

type Props = {
  file: LinkFile;
  linkId: number;
};

export default function PreservedFileRow({ file, linkId }: Props) {
  const router = useRouter();
  const isPublic = router.pathname.startsWith("/public");

  const isPreviewable = file.mimeType === FLASH_MIME_TYPE;

  const handleDownload = () => {
    const anchorElement = document.createElement("a");
    anchorElement.href = `/api/v1/links/${linkId}/files/${file.id}?download=1`;
    anchorElement.download = file.name;
    anchorElement.click();
  };

  return (
    <div className="flex justify-between items-center gap-2">
      <div className="flex gap-2 items-center min-w-0">
        <i className="bi-file-earmark-play text-xl text-primary shrink-0" />
        <p className="truncate">{file.name}</p>
      </div>

      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" onClick={handleDownload}>
          <i className="bi-cloud-arrow-down text-xl text-neutral" />
        </Button>

        {isPreviewable && (
          <Button asChild variant="ghost" size="icon">
            <Link
              href={`${
                isPublic ? "/public" : ""
              }/preserved/files/${linkId}/${file.id}`}
              target="_blank"
            >
              <i className="bi-box-arrow-up-right text-lg text-neutral" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

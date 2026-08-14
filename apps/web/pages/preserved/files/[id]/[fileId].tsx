import getServerSideProps from "@/lib/client/getServerSideProps";
import FilePreviewContent from "@/components/Preservation/FilePreviewContent";

export default function Index() {
  return <FilePreviewContent />;
}

export { getServerSideProps };

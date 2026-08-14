import getServerSideProps from "@/lib/client/getServerSideProps";
import AssistedScrapingEditor from "@/components/AssistedScraping/AssistedScrapingEditor";

export default function Index() {
  return <AssistedScrapingEditor />;
}

export { getServerSideProps };

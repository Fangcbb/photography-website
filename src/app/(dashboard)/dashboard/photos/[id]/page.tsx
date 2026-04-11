import { Metadata } from "next";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { PhotoIdView } from "@/modules/photos/ui/views/photo-id-view";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;

  return {
    title: "Photo Details",
  };
}

const Page = async ({ params }: Props) => {
  const { id } = await params;

  return (
      <ErrorBoundary fallback={<p>Something went wrong</p>}>
        <Suspense fallback={<p>Loading...</p>}>
          <PhotoIdView id={id} />
        </Suspense>
      </ErrorBoundary>
  );
};

export default Page;

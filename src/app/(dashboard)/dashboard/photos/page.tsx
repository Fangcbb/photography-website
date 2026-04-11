import { Suspense } from "react";
import type { SearchParams } from "nuqs/server";
import { ErrorBoundary } from "react-error-boundary";
import { loadSearchParams } from "@/modules/photos/params";
import { PhotosListHeader } from "@/modules/photos/ui/components/photos-list-header";
import {
  DashboardPhotosView,
  ErrorStatus,
  LoadingStatus,
} from "@/modules/photos/ui/views/dashboard-photos-view";

export const metadata = {
  title: "Photo Collection",
  description: "Photo Collection",
};

type Props = {
  searchParams: Promise<SearchParams>;
};

const page = async ({ searchParams }: Props) => {
  await loadSearchParams(searchParams);

  return (
    <>
      <PhotosListHeader />
        <Suspense fallback={<LoadingStatus />}>
          <ErrorBoundary fallback={<ErrorStatus />}>
            <DashboardPhotosView />
          </ErrorBoundary>
        </Suspense>
    </>
  );
};

export default page;

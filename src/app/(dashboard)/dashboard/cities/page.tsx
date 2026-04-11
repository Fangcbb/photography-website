import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  CityListView,
  CityListLoadingView,
  CityListErrorView,
} from "@/modules/cities/ui/views/city-list-view";

export const metadata = {
  title: "City Collection",
  description: "City Collection",
};

const CityPage = async () => {
  return (
    <>
      <div className="py-4 px-4 md:px-8 flex flex-col gap-y-8">
        <div>
          <h1 className="text-2xl font-bold">City Collection</h1>
          <p className="text-muted-foreground ">
            Explore your photos organized by cities you&apos;ve visited
          </p>
        </div>
      </div>

        <ErrorBoundary FallbackComponent={CityListErrorView}>
          <Suspense fallback={<CityListLoadingView />}>
            <CityListView />
          </Suspense>
        </ErrorBoundary>
    </>
  );
};

export default CityPage;

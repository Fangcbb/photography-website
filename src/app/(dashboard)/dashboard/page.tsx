import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { MapView } from "@/modules/dashboard/ui/views/map-view";
import {
  ChartAreaView,
  ChartAreaLoading,
} from "@/modules/dashboard/ui/views/chart-area-view";
import {
  SectionCardsView,
  SectionCardsLoading,
} from "@/modules/dashboard/ui/views/section-cards-view";

const page = async () => {
  return (
    <div className="py-4 px-4 md:px-8 flex flex-col">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground ">
          See your photos, travel history, and more.
        </p>
      </div>
      <div className="@container/main flex flex-1 flex-col">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Suspense fallback={<SectionCardsLoading />}>
              <SectionCardsView />
            </Suspense>
            <Suspense fallback={<ChartAreaLoading />}>
              <ErrorBoundary fallback={<p>Error</p>}>
                <ChartAreaView />
              </ErrorBoundary>
            </Suspense>

            <MapView />
        </div>
      </div>
    </div>
  );
};

export default page;

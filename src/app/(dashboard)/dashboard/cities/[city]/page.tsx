import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  CityDetailView,
  CityDetailLoadingView,
  CityDetailErrorView,
} from "@/modules/cities/ui/views/city-detail-view";

type Props = {
  params: Promise<{
    city: string;
  }>;
};

const CityDetailPage = async ({ params }: Props) => {
  const { city } = await params;

  // Decode URL-encoded params
  const decodedCity = decodeURIComponent(city);

  return (
      <ErrorBoundary FallbackComponent={CityDetailErrorView}>
        <Suspense fallback={<CityDetailLoadingView />}>
          <CityDetailView city={decodedCity} />
        </Suspense>
      </ErrorBoundary>
  );
};

export default CityDetailPage;

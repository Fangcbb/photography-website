import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  TravelView,
  LoadingStatus,
} from "@/modules/travel/ui/views/travel-view";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Travel",
  description:
    "Browse travel photography by city. Explore beautiful destinations and discover photos from around the world.",
};

const page = () => {
  return (
    <Suspense fallback={<LoadingStatus />}>
      <ErrorBoundary fallback={<p>Error</p>}>
        <TravelView />
      </ErrorBoundary>
    </Suspense>
  );
};

export default page;

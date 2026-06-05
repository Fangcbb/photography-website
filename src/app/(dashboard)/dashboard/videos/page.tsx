import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  DashboardVideosView,
  ErrorStatus,
  LoadingStatus,
} from "@/modules/video/ui/views/dashboard-videos-view";

export const metadata = {
  title: "Videos",
  description: "Video Management",
};

const page = () => {
  return (
    <>
      <Suspense fallback={<LoadingStatus />}>
        <ErrorBoundary fallback={<ErrorStatus />}>
          <DashboardVideosView />
        </ErrorBoundary>
      </Suspense>
    </>
  );
};

export default page;

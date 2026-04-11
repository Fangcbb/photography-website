import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  DashboardMusicView,
  ErrorStatus,
  LoadingStatus,
} from "@/modules/music/ui/views/dashboard-music-view";

export const metadata = {
  title: "Music",
  description: "Music Management",
};

const page = () => {
  return (
    <>
      <Suspense fallback={<LoadingStatus />}>
        <ErrorBoundary fallback={<ErrorStatus />}>
          <DashboardMusicView />
        </ErrorBoundary>
      </Suspense>
    </>
  );
};

export default page;

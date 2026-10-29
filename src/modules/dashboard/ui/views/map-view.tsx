"use client";

import * as React from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import Mapbox from "@/modules/mapbox/ui/components/map";
import { AnalyticsView } from "./analytics-view";

export const MapView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.dashboard.getVisitedCountriesWithGeoJson.queryOptions()
  );

  return (
    <div className="w-full h-[600px] grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-xl overflow-hidden relative h-[400px] lg:h-full">
        <Mapbox
          id="dashboardMap"
          styleOverride="mapbox://styles/mapbox/streets-v12"
          showControls={false}
          scrollZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          initialViewState={{
            longitude: 0,
            latitude: 20,
            zoom: 0,
          }}
          geoJsonData={data?.geoJson || undefined}
        />
      </div>

      {/* GA4 analytics panel */}
      <div className="lg:col-span-1 h-full min-h-[400px]">
        <React.Suspense
          fallback={
            <div className="h-full min-h-[400px] rounded-xl bg-muted/40 animate-pulse" />
          }
        >
          <AnalyticsView />
        </React.Suspense>
      </div>
    </div>
  );
};

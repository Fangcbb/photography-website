export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { Suspense } from "react";
import { trpc } from "@/trpc/server";
import { getQueryClient } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { CityView } from "@/modules/travel/ui/views/city-view";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: id, // Will be overridden by client-side fetch
  };
}

const Page = async ({ params }: Props) => {
  const { id } = await params;

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.travel.getOne.queryOptions({ id }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ErrorBoundary fallback={<p>Something went wrong</p>}>
        <Suspense fallback={<p>Loading...</p>}>
          <CityView id={id} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
};

export default Page;

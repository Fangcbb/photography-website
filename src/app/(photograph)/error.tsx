"use client";

export default function PhotographError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-light tracking-wider">Something went wrong</h1>
        <p className="text-muted-foreground text-sm">
          An error occurred while loading this page.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

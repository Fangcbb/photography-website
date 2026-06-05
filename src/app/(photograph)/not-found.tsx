export default function PhotographNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-light tracking-wider">404</h1>
        <p className="text-muted-foreground text-sm">
          This photograph could not be found.
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
        >
          Back to gallery
        </a>
      </div>
    </div>
  );
}

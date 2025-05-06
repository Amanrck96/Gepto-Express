
'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    // console.error("GlobalError caught:", error);
  }, [error]);

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-var(--header-height,10rem))] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg text-center shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Oops! Something Went Wrong</CardTitle>
          <CardDescription className="mt-2 text-muted-foreground">
            We're sorry, but an unexpected error occurred. Please try again, or contact support if the problem persists.
            {error?.message && (
              <p className="mt-3 text-sm bg-muted p-2 rounded-md">
                <span className="font-semibold">Error:</span> {error.message}
              </p>
            )}
            {error?.digest && (
              <p className="mt-1 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col items-center justify-center gap-4 pt-6">
          <Button
            onClick={
              // Attempt to recover by trying to re-render the segment
              () => reset()
            }
            className="w-full sm:w-auto"
          >
            Try Again
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href="/">Go to Homepage</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

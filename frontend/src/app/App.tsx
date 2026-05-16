import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';

import { Providers } from '@/app/providers';
import { router } from '@/app/router';

function PageLoader(): JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <Providers>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
    </Providers>
  );
}

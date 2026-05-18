import { BASE_URL, setUnauthenticatedHandler } from '@/shared/api/client';
import { useAuthStore, type AuthUserWithProfile } from '@/shared/stores/auth.store';
import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import axios from 'axios';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

SplashScreen.preventAutoHideAsync();

// Wire TanStack Query focus detection to native AppState
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

// Wire TanStack Query online detection to native NetInfo
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout(): ReactNode {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Register the unauthenticated callback after store and navigation are mounted
    setUnauthenticatedHandler(() => {
      useAuthStore.getState().clearAuth();
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();
      if (refreshToken) {
        try {
          // Use raw axios to bypass apiClient interceptors during bootstrap.
          // /auth/refresh returns only { accessToken, refreshToken } — no user.
          const { data: tokenData } = await axios.post<{
            accessToken: string;
            refreshToken: string;
          }>(`${BASE_URL}/auth/refresh`, { refreshToken });
          // Fetch the user profile with the new access token.
          const { data: user } = await axios.get<AuthUserWithProfile>(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${tokenData.accessToken}` },
          });
          setAuth(tokenData.accessToken, tokenData.refreshToken, user);
        } catch {
          clearAuth();
        }
      }
      if (!cancelled) {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }

    // Subscribe BEFORE checking hasHydrated to avoid a race where hydration
    // completes between the check and the subscription registration.
    let bootstrapped = false;
    function runBootstrapOnce() {
      if (bootstrapped || cancelled) return;
      bootstrapped = true;
      bootstrap();
    }

    const unsub = useAuthStore.persist.onFinishHydration(runBootstrapOnce);

    // If already hydrated, fire immediately (callback won't fire again)
    if (useAuthStore.persist.hasHydrated()) {
      runBootstrapOnce();
    }

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </QueryClientProvider>
  );
}

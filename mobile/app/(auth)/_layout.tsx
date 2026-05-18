import { useAuthStore } from '@/shared/stores/auth.store';
import { Redirect, Stack } from 'expo-router';
import type { ReactNode } from 'react';

export default function AuthLayout(): ReactNode {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          title: 'My Content',
          headerStyle: { backgroundColor: '#3b82f6' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      />
    </Stack>
  );
}

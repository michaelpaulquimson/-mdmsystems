import { useAuthStore } from '@/shared/stores/auth.store';
import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';

export default function Index(): ReactNode {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={user ? '/(auth)' : '/login'} />;
}

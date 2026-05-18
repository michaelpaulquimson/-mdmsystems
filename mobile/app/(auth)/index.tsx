import { useRoles } from '@/features/roles/hooks/use-roles';
import { useUsers } from '@/features/users/hooks/use-users';
import { apiClient } from '@/shared/api/client';
import { useAuthStore, type AuthUserWithProfile } from '@/shared/stores/auth.store';
import type { ContentItem } from '@mdm/shared';
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLogout } from '@/features/auth/hooks/use-logout';
import { useAssignedContent } from '@/features/content/hooks/use-assigned-content';

type UserInfo = { name: string; roleName: string | null };

export default function AssignedContentScreen(): ReactNode {
  // All hooks must run before any conditional returns (Rules of Hooks)
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const { mutate: doLogout, isPending: isLoggingOut } = useLogout();
  const hasOrg = Boolean(user?.organizationId);
  const [isCheckingOrg, setIsCheckingOrg] = useState(false);

  const checkOrgAssignment = async () => {
    setIsCheckingOrg(true);
    try {
      const { data: freshUser } = await apiClient.get<AuthUserWithProfile>('/auth/me');
      if (accessToken && refreshToken) {
        setAuth(accessToken, refreshToken, freshUser);
      }
    } catch {
      // Silently ignore — user stays logged in, check again later
    } finally {
      setIsCheckingOrg(false);
    }
  };
  const { data, isLoading, error, refetch, isRefetching } = useAssignedContent(
    user?.id ?? '',
    hasOrg,
  );
  // /users and /roles are admin-only — skip the calls for non-admins to avoid 403s
  const isAdmin = user?.isAdmin ?? false;
  const { data: users } = useUsers(isAdmin);
  const { data: roles } = useRoles(isAdmin);
  const roleMap = new Map((roles ?? []).map((r) => [r.id, r.name]));
  // Map userId → { name, roleName }
  // Seed with the current user from the auth store so non-admins still see their own name on cards
  const userMap = new Map<string, UserInfo>([
    ...(user
      ? [[user.id, { name: user.name, roleName: user.roleName ?? null }] as [string, UserInfo]]
      : []),
    ...(users ?? []).map(
      (u) =>
        [u.id, { name: u.name, roleName: u.roleId ? (roleMap.get(u.roleId) ?? null) : null }] as [
          string,
          UserInfo,
        ],
    ),
  ]);

  // (auth)/_layout.tsx guarantees user is non-null; this guard satisfies TypeScript
  if (!user) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => doLogout()}
              disabled={isLoggingOut}
              style={styles.logoutBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text style={styles.logoutText}>{isLoggingOut ? '…' : 'Sign Out'}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {!hasOrg ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl refreshing={isCheckingOrg} onRefresh={checkOrgAssignment} />
          }
        >
          <Text style={styles.errorText}>
            No organization assigned to your account.{'\n'}Contact your administrator.
          </Text>
          <Text style={styles.hintText}>Pull down to check again.</Text>
        </ScrollView>
      ) : isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Failed to load content. Pull down to retry.</Text>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContentCard item={item} userMap={userMap} />}
          ListHeaderComponent={<ProfileCard user={user} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No content assigned to or created by you yet.</Text>
            </View>
          }
          contentContainerStyle={(data?.length ?? 0) === 0 ? styles.fillFlex : styles.listPadding}
        />
      )}
    </View>
  );
}

function ProfileCard({ user }: { user: AuthUserWithProfile }): ReactNode {
  const meta = [user.roleName, user.teamName, user.orgName].filter(Boolean).join(' · ');
  if (!meta) return null;
  return (
    <View style={styles.profileCard}>
      <Text style={styles.profileName}>{user.name}</Text>
      <Text style={styles.profileMeta}>{meta}</Text>
    </View>
  );
}

function ContentCard({
  item,
  userMap,
}: {
  item: ContentItem;
  userMap: Map<string, UserInfo>;
}): ReactNode {
  const date = new Date(item.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();

  const assignedInfo = item.assignedToUserId ? userMap.get(item.assignedToUserId) : null;
  const assignedLabel = assignedInfo
    ? assignedInfo.roleName
      ? `Assigned to: ${assignedInfo.name} · ${assignedInfo.roleName}`
      : `Assigned to: ${assignedInfo.name}`
    : 'Unassigned';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      {item.body !== '' && (
        <Text style={styles.cardBody} numberOfLines={3}>
          {item.body}
        </Text>
      )}
      <View style={styles.cardMeta}>
        <Text style={styles.cardAssigned}>{assignedLabel}</Text>
        {dateLabel !== '' && <Text style={styles.cardDate}>{dateLabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centered: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  hintText: { fontSize: 12, color: '#aaa', marginTop: 8, textAlign: 'center' },
  fillFlex: { flex: 1 },
  listPadding: { paddingVertical: 12 },
  logoutBtn: { marginRight: 4, paddingHorizontal: 4, paddingVertical: 2 },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  profileCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  profileName: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 2 },
  profileMeta: { fontSize: 12, color: '#555' },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 6 },
  cardBody: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 8 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  cardAssigned: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },
  cardDate: { fontSize: 12, color: '#999' },
  errorText: { fontSize: 15, color: '#ef4444', textAlign: 'center', paddingHorizontal: 24 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: '#888', textAlign: 'center' },
});

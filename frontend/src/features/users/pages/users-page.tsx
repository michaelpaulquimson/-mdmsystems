import type { User } from '@mdm/shared';
import { Permissions } from '@mdm/shared';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
import { useRoles } from '@/features/roles/hooks/use-roles';
import { useTeams } from '@/features/teams/hooks/use-teams';
import { Gate } from '@/shared/auth/gate';
import { ConfirmDialog } from '@/shared/components/confirm-dialog/confirm-dialog';
import { DataTable, type ColumnDef } from '@/shared/components/data-table/data-table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatDate } from '@/shared/lib/utils';

import { UserFormDialog } from '../components/user-form-dialog';
import { useDeleteUser } from '../hooks/use-delete-user';
import { useUsers } from '../hooks/use-users';

const PAGE_SIZE = 10;

export function UsersPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>(undefined);
  const [deleteUser, setDeleteUser] = useState<User | undefined>(undefined);

  const { data, isLoading, error } = useUsers({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const { data: orgsData } = useOrganizations({ limit: 200 });
  const orgMap = new Map((orgsData?.data ?? []).map((o) => [o.id, o.name]));

  const { data: teamsData } = useTeams({ limit: 200 });
  const teamMap = new Map((teamsData?.data ?? []).map((t) => [t.id, t.name]));

  const { data: rolesData } = useRoles({ limit: 200 });
  const roleMap = new Map((rolesData?.data ?? []).map((r) => [r.id, r.name]));

  const deleteMutation = useDeleteUser();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleDelete = async () => {
    if (!deleteUser) return;
    await deleteMutation.mutateAsync(deleteUser.id);
    setDeleteUser(undefined);
  };

  const columns: ColumnDef<User>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.email}</span>,
    },
    {
      key: 'organization',
      header: 'Organization',
      cell: (row): ReactNode =>
        row.organizationId ? (
          <span className="text-sm">{orgMap.get(row.organizationId) ?? '—'}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">None</span>
        ),
    },
    {
      key: 'team',
      header: 'Team',
      cell: (row): ReactNode =>
        row.teamId ? (
          <span className="text-sm">{teamMap.get(row.teamId) ?? '—'}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">None</span>
        ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row): ReactNode =>
        row.roleId ? (
          <span className="text-sm">{roleMap.get(row.roleId) ?? '—'}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">None</span>
        ),
    },
    {
      key: 'isAdmin',
      header: 'Admin',
      cell: (row): ReactNode =>
        row.isAdmin ? (
          <Badge variant="default" className="text-xs">
            Admin
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs">
            User
          </Badge>
        ),
    },
    {
      key: 'createdAt',
      header: 'Created At',
      cell: (row) => (
        <span className="text-muted-foreground text-sm">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24 text-right',
      cell: (row): ReactNode => (
        <div className="flex items-center justify-end gap-1">
          <Gate permission={Permissions.USER_UPDATE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditUser(row)}
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Gate>
          <Gate permission={Permissions.USER_DELETE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteUser(row)}
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Gate>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage user accounts across the platform.
          </p>
        </div>
        <Gate permission={Permissions.USER_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </Gate>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load users. Please try again.</span>
        </div>
      )}

      {/* Table */}
      {isLoading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          total={data?.pagination.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Create dialog */}
      <UserFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit dialog */}
      <UserFormDialog
        open={editUser !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditUser(undefined);
        }}
        user={editUser}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteUser !== undefined}
        title="Delete User"
        description={`Are you sure you want to delete "${deleteUser?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteUser(undefined)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

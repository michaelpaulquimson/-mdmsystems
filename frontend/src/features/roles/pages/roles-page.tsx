import type { Role } from '@mdm/shared';
import { Permissions } from '@mdm/shared';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { Gate } from '@/shared/auth/gate';
import { ConfirmDialog } from '@/shared/components/confirm-dialog/confirm-dialog';
import { DataTable, type ColumnDef } from '@/shared/components/data-table/data-table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatDate } from '@/shared/lib/utils';

import { RoleFormDialog } from '../components/role-form-dialog';
import { useDeleteRole } from '../hooks/use-delete-role';
import { useRoles } from '../hooks/use-roles';

const PAGE_SIZE = 10;

export function RolesPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | undefined>(undefined);
  const [deleteRole, setDeleteRole] = useState<Role | undefined>(undefined);

  const { data, isLoading, error } = useRoles({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const deleteMutation = useDeleteRole();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleDelete = async () => {
    if (!deleteRole) return;
    await deleteMutation.mutateAsync(deleteRole.id);
    setDeleteRole(undefined);
  };

  const columns: ColumnDef<Role>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'permissions',
      header: 'Permissions',
      cell: (row): ReactNode => (
        <div className="flex flex-wrap gap-1">
          {(row.permissions ?? []).length === 0 ? (
            <span className="text-muted-foreground italic text-sm">No permissions</span>
          ) : (
            (row.permissions ?? []).map((perm) => (
              <Badge key={perm} variant="secondary" className="font-mono text-xs">
                {perm}
              </Badge>
            ))
          )}
        </div>
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
          <Gate permission={Permissions.ROLE_UPDATE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditRole(row)}
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Gate>
          <Gate permission={Permissions.ROLE_DELETE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteRole(row)}
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
          <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage roles and their permission sets.
          </p>
        </div>
        <Gate permission={Permissions.ROLE_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Role
          </Button>
        </Gate>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search roles…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load roles. Please try again.</span>
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
      <RoleFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit dialog */}
      <RoleFormDialog
        open={editRole !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditRole(undefined);
        }}
        role={editRole}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteRole !== undefined}
        title="Delete Role"
        description={`Are you sure you want to delete "${deleteRole?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteRole(undefined)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

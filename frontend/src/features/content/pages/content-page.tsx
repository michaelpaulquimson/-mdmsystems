import type { ContentItem } from '@mdm/shared';
import { Permissions } from '@mdm/shared';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useRoles } from '@/features/roles/hooks/use-roles';
import { useUsers } from '@/features/users/hooks/use-users';
import { Gate } from '@/shared/auth/gate';
import { useAuth } from '@/shared/auth/use-auth';
import { ConfirmDialog } from '@/shared/components/confirm-dialog/confirm-dialog';
import { DataTable, type ColumnDef } from '@/shared/components/data-table/data-table';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatDate } from '@/shared/lib/utils';

import { ContentFormDialog } from '../components/content-form-dialog';
import { useContentList } from '../hooks/use-content-list';
import { useDeleteContent } from '../hooks/use-delete-content';

const PAGE_SIZE = 10;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function ContentPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<ContentItem | undefined>(undefined);

  const { data, isLoading, error } = useContentList({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const { isAdmin } = useAuth();
  const { data: usersData } = useUsers({ limit: 200 }, isAdmin);
  const { data: rolesData } = useRoles({ limit: 200 }, isAdmin);
  const roleMap = new Map((rolesData?.data ?? []).map((r) => [r.id, r.name]));
  const userMap = new Map(
    (usersData?.data ?? []).map((u) => [
      u.id,
      { name: u.name, roleName: u.roleId ? (roleMap.get(u.roleId) ?? null) : null },
    ]),
  );

  const deleteMutation = useDeleteContent();

  const handleDelete = async () => {
    if (!deleteItem) return;
    await deleteMutation.mutateAsync(deleteItem.id);
    setDeleteItem(undefined);
  };

  const columns: ColumnDef<ContentItem>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: 'body',
      header: 'Body',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{truncate(row.body, 60)}</span>
      ),
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      cell: (row): ReactNode => {
        const info = row.assignedToUserId ? userMap.get(row.assignedToUserId) : null;
        if (!info) return <span className="text-sm text-muted-foreground italic">Unassigned</span>;
        return (
          <span className="text-sm">
            {info.name}
            {info.roleName && <span className="ml-1 text-muted-foreground">· {info.roleName}</span>}
          </span>
        );
      },
    },
    {
      key: 'createdBy',
      header: 'Created By',
      cell: (row): ReactNode => {
        const info = row.createdByUserId ? userMap.get(row.createdByUserId) : null;
        if (!info) return <span className="text-sm text-muted-foreground italic">—</span>;
        return (
          <span className="text-sm">
            {info.name}
            {info.roleName && <span className="ml-1 text-muted-foreground">· {info.roleName}</span>}
          </span>
        );
      },
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
          <Gate permission={Permissions.CONTENT_UPDATE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditItem(row)}
              aria-label={`Edit ${row.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Gate>
          <Gate permission={Permissions.CONTENT_DELETE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteItem(row)}
              aria-label={`Delete ${row.title}`}
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
          <h1 className="text-2xl font-bold tracking-tight">Content</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage and assign content items.</p>
        </div>
        <Gate permission={Permissions.CONTENT_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Content
          </Button>
        </Gate>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load content. Please try again.</span>
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
      <ContentFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit dialog */}
      <ContentFormDialog
        open={editItem !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditItem(undefined);
        }}
        contentItem={editItem}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteItem !== undefined}
        title="Delete Content Item"
        description={`Are you sure you want to delete "${deleteItem?.title ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteItem(undefined)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

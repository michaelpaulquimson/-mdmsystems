import type { Team } from '@mdm/shared';
import { Permissions } from '@mdm/shared';
import { Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
import { Gate } from '@/shared/auth/gate';
import { ConfirmDialog } from '@/shared/components/confirm-dialog/confirm-dialog';
import { DataTable, type ColumnDef } from '@/shared/components/data-table/data-table';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { formatDate } from '@/shared/lib/utils';

import { TeamFormDialog } from '../components/team-form-dialog';
import { useDeleteTeam } from '../hooks/use-delete-team';
import { useTeams } from '../hooks/use-teams';

const PAGE_SIZE = 10;

export function TeamsPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | undefined>(undefined);
  const [deleteTeam, setDeleteTeam] = useState<Team | undefined>(undefined);

  const { data, isLoading, error } = useTeams({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    search: debouncedSearch || undefined,
  });

  const { data: orgsData } = useOrganizations({ limit: 200 });
  const orgMap = new Map((orgsData?.data ?? []).map((o) => [o.id, o.name]));

  const deleteMutation = useDeleteTeam();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  const handleDelete = async () => {
    if (!deleteTeam) return;
    await deleteMutation.mutateAsync(deleteTeam.id);
    setDeleteTeam(undefined);
  };

  const columns: ColumnDef<Team>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'organization',
      header: 'Organization',
      cell: (row): ReactNode => (
        <span className="text-sm">
          {orgMap.get(row.organizationId) ?? (
            <span className="text-muted-foreground italic">Unknown</span>
          )}
        </span>
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
          <Gate permission={Permissions.TEAM_UPDATE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditTeam(row)}
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </Gate>
          <Gate permission={Permissions.TEAM_DELETE}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setDeleteTeam(row)}
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
          <h1 className="text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage teams within organizations.</p>
        </div>
        <Gate permission={Permissions.TEAM_CREATE}>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Team
          </Button>
        </Gate>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search teams…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load teams. Please try again.</span>
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
      <TeamFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {/* Edit dialog */}
      <TeamFormDialog
        open={editTeam !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditTeam(undefined);
        }}
        team={editTeam}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTeam !== undefined}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleteTeam?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTeam(undefined)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

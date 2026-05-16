import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useUsers } from '@/features/users/hooks/use-users';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatDate } from '@/shared/lib/utils';

import type { AuditLogEntry } from '../api/audit.api';
import { useAuditLog } from '../hooks/use-audit-log';

const PAGE_SIZE = 20;

const ALL_ENTITY_TYPES = '__all__';

const ENTITY_TYPE_OPTIONS = [
  { label: 'All', value: ALL_ENTITY_TYPES },
  { label: 'Organization', value: 'Organization' },
  { label: 'Team', value: 'Team' },
  { label: 'User', value: 'User' },
  { label: 'Role', value: 'Role' },
  { label: 'Content Item', value: 'ContentItem' },
];

const ACTION_VARIANT_MAP: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default',
  update: 'secondary',
  delete: 'destructive',
};

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const key = action.toLowerCase().split(':').pop() ?? action.toLowerCase();
  return ACTION_VARIANT_MAP[key] ?? 'outline';
}

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  if (!data) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xs text-muted-foreground italic">null</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function AuditPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState(ALL_ENTITY_TYPES);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data, isLoading, error } = useAuditLog({
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    entityType: entityType === ALL_ENTITY_TYPES ? undefined : entityType,
    from: from || undefined,
    to: to || undefined,
  });

  const { data: usersData } = useUsers({ limit: 200 });
  const userMap = new Map((usersData?.data ?? []).map((u) => [u.id, u.name]));

  const entries: AuditLogEntry[] = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const handleFilterChange = () => {
    setPage(1);
    setExpandedRow(null);
  };

  const toggleRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View a tamper-evident record of all mutating actions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 min-w-[180px]">
          <Label htmlFor="audit-entity-type">Entity Type</Label>
          <Select
            value={entityType}
            onValueChange={(val) => {
              setEntityType(val);
              handleFilterChange();
            }}
          >
            <SelectTrigger id="audit-entity-type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            className="w-40"
            onChange={(e) => {
              setFrom(e.target.value);
              handleFilterChange();
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            className="w-40"
            onChange={(e) => {
              setTo(e.target.value);
              handleFilterChange();
            }}
          />
        </div>

        {(entityType !== ALL_ENTITY_TYPES || from || to) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEntityType(ALL_ENTITY_TYPES);
              setFrom('');
              setTo('');
              handleFilterChange();
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="text-sm">Failed to load audit log. Please try again.</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Occurred At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit events found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry): ReactNode => {
                const isExpanded = expandedRow === entry.id;
                return (
                  <React.Fragment key={entry.id}>
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleRow(entry.id)}
                    >
                      <TableCell className="w-8">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={actionVariant(entry.action)} className="text-xs font-mono">
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.entityType}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {entry.entityId ? entry.entityId.slice(0, 8) + '…' : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.actorUserId ? (
                          (userMap.get(entry.actorUserId) ?? entry.actorUserId.slice(0, 8) + '…')
                        ) : (
                          <span className="text-muted-foreground italic">System</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.occurredAt)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${entry.id}-detail`} className="bg-muted/30">
                        <TableCell colSpan={6} className="p-4">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <JsonBlock label="Before" data={entry.before} />
                            <JsonBlock label="After" data={entry.after} />
                          </div>
                          {(entry.ipAddress || entry.userAgent) && (
                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                              {entry.ipAddress && (
                                <span>
                                  <span className="font-semibold">IP:</span> {entry.ipAddress}
                                </span>
                              )}
                              {entry.userAgent && (
                                <span>
                                  <span className="font-semibold">UA:</span>{' '}
                                  {entry.userAgent.slice(0, 80)}
                                  {entry.userAgent.length > 80 ? '…' : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => {
              setPage((p) => p - 1);
              setExpandedRow(null);
            }}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => {
              setPage((p) => p + 1);
              setExpandedRow(null);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

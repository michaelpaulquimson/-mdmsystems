import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateContentSchema,
  UpdateContentSchema,
  type ContentItem,
  type CreateContentInput,
  type UpdateContentInput,
} from '@mdm/shared';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { useUsers } from '@/features/users/hooks/use-users';
import { FormDialog } from '@/shared/components/form-dialog/form-dialog';
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

import { useCreateContent } from '../hooks/use-create-content';
import { useUpdateContent } from '../hooks/use-update-content';

interface ContentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentItem?: ContentItem;
  onSuccess?: () => void;
}

export function ContentFormDialog({
  open,
  onOpenChange,
  contentItem,
  onSuccess,
}: ContentFormDialogProps): JSX.Element {
  const isEditMode = contentItem !== undefined;
  const schema = isEditMode ? UpdateContentSchema : CreateContentSchema;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateContentInput | UpdateContentInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: contentItem?.title ?? '',
      body: contentItem?.body ?? '',
      assignedToUserId: contentItem?.assignedToUserId ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        title: contentItem?.title ?? '',
        body: contentItem?.body ?? '',
        assignedToUserId: contentItem?.assignedToUserId ?? null,
      });
    }
  }, [open, contentItem, reset]);

  const { data: usersData, isLoading: usersLoading } = useUsers({ limit: 200 });
  const users = usersData?.data ?? [];

  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateContentInput | UpdateContentInput) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: contentItem.id, data: values });
    } else {
      await createMutation.mutateAsync(values as CreateContentInput);
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Content Item' : 'Create Content Item'}
      isSubmitting={isPending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="content-title">Title</Label>
          <Input
            id="content-title"
            placeholder="Q1 Onboarding Guide"
            disabled={isPending}
            {...register('title')}
            aria-invalid={errors.title !== undefined}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="content-body">Body</Label>
          <textarea
            id="content-body"
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Content body…"
            disabled={isPending}
            {...register('body')}
            aria-invalid={errors.body !== undefined}
          />
          {errors.body && <p className="text-sm text-destructive">{errors.body.message}</p>}
        </div>

        {/* Assigned To */}
        <div className="space-y-1.5">
          <Label htmlFor="content-assignee">Assigned To (optional)</Label>
          <Controller
            name="assignedToUserId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value === null ? '__none__' : (field.value as string | undefined)}
                onValueChange={(val) => {
                  field.onChange(val === '__none__' ? null : val);
                }}
                disabled={usersLoading || isPending}
              >
                <SelectTrigger id="content-assignee">
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.assignedToUserId && (
            <p className="text-sm text-destructive">{errors.assignedToUserId.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

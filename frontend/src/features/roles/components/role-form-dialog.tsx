import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  Permissions,
  type Role,
  type CreateRoleInput,
  type UpdateRoleInput,
} from '@mdm/shared';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { FormDialog } from '@/shared/components/form-dialog/form-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { useCreateRole } from '../hooks/use-create-role';
import { useUpdateRole } from '../hooks/use-update-role';

const ALL_PERMISSIONS = Object.entries(Permissions) as [string, string][];

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: Role;
  onSuccess?: () => void;
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSuccess,
}: RoleFormDialogProps): JSX.Element {
  const isEditMode = role !== undefined;
  const schema = isEditMode ? UpdateRoleSchema : CreateRoleSchema;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateRoleInput | UpdateRoleInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: role?.name ?? '',
      permissions: role?.permissions ?? [],
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: role?.name ?? '',
        permissions: role?.permissions ?? [],
      });
    }
  }, [open, role, reset]);

  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateRoleInput | UpdateRoleInput) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: role.id, data: values });
    } else {
      await createMutation.mutateAsync(values as CreateRoleInput);
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Role' : 'Create Role'}
      isSubmitting={isPending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Name</Label>
          <Input
            id="role-name"
            placeholder="Editor"
            {...register('name')}
            aria-invalid={errors.name !== undefined}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label>Permissions</Label>
          <Controller
            name="permissions"
            control={control}
            render={({ field }) => {
              const selected = (field.value as string[] | undefined) ?? [];

              const toggle = (value: string) => {
                const next = selected.includes(value)
                  ? selected.filter((p) => p !== value)
                  : [...selected, value];
                field.onChange(next);
              };

              return (
                <div className="grid grid-cols-1 gap-1 rounded-md border p-3 sm:grid-cols-2 max-h-64 overflow-y-auto">
                  {ALL_PERMISSIONS.map(([key, value]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 cursor-pointer rounded-sm px-1 py-0.5 hover:bg-accent text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-primary"
                        checked={selected.includes(value)}
                        onChange={() => toggle(value)}
                        disabled={isPending}
                      />
                      <span className="font-mono text-xs">{value}</span>
                    </label>
                  ))}
                </div>
              );
            }}
          />
          {errors.permissions && (
            <p className="text-sm text-destructive">{errors.permissions.message}</p>
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

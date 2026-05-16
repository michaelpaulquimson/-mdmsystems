import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  type Organization,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@mdm/shared';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { FormDialog } from '@/shared/components/form-dialog/form-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import { useCreateOrganization } from '../hooks/use-create-organization';
import { useUpdateOrganization } from '../hooks/use-update-organization';

interface OrganizationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization?: Organization;
  onSuccess?: () => void;
}

export function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
  onSuccess,
}: OrganizationFormDialogProps): JSX.Element {
  const isEditMode = organization !== undefined;
  const schema = isEditMode ? UpdateOrganizationSchema : CreateOrganizationSchema;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOrganizationInput | UpdateOrganizationInput>({
    resolver: zodResolver(schema),
    defaultValues: { name: organization?.name ?? '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: organization?.name ?? '' });
    }
  }, [open, organization, reset]);

  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateOrganizationInput | UpdateOrganizationInput) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: organization.id, data: values });
    } else {
      await createMutation.mutateAsync(values as CreateOrganizationInput);
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Organization' : 'Create Organization'}
      isSubmitting={isPending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Name</Label>
          <Input
            id="org-name"
            placeholder="Acme Corp"
            {...register('name')}
            aria-invalid={errors.name !== undefined}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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

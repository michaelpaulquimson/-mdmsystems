import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  type Team,
  type CreateTeamInput,
  type UpdateTeamInput,
} from '@mdm/shared';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
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

import { useCreateTeam } from '../hooks/use-create-team';
import { useUpdateTeam } from '../hooks/use-update-team';

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  onSuccess?: () => void;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  team,
  onSuccess,
}: TeamFormDialogProps): JSX.Element {
  const isEditMode = team !== undefined;
  const schema = isEditMode ? UpdateTeamSchema : CreateTeamSchema;

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateTeamInput | UpdateTeamInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: team?.name ?? '',
      organizationId: team?.organizationId ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: team?.name ?? '',
        organizationId: team?.organizationId ?? '',
      });
    }
  }, [open, team, reset]);

  const { data: orgsData, isLoading: orgsLoading } = useOrganizations({ limit: 200 });
  const organizations = orgsData?.data ?? [];

  const createMutation = useCreateTeam();
  const updateMutation = useUpdateTeam();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateTeamInput | UpdateTeamInput) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: team.id, data: values });
    } else {
      await createMutation.mutateAsync(values as CreateTeamInput);
    }
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit Team' : 'Create Team'}
      isSubmitting={isPending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="team-name">Name</Label>
          <Input
            id="team-name"
            placeholder="Engineering"
            {...register('name')}
            aria-invalid={errors.name !== undefined}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="team-org">Organization</Label>
          <Controller
            name="organizationId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value as string | undefined}
                onValueChange={field.onChange}
                disabled={orgsLoading || isPending}
              >
                <SelectTrigger id="team-org" aria-invalid={errors.organizationId !== undefined}>
                  <SelectValue placeholder="Select organization…" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.organizationId && (
            <p className="text-sm text-destructive">{errors.organizationId.message}</p>
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

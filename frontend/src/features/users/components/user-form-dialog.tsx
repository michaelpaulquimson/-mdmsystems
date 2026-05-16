import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateUserSchema,
  UpdateUserSchema,
  type User,
  type CreateUserInput,
  type UpdateUserInput,
} from '@mdm/shared';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';

import { useOrganizations } from '@/features/organizations/hooks/use-organizations';
import { useRoles } from '@/features/roles/hooks/use-roles';
import { useTeams } from '@/features/teams/hooks/use-teams';
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

import { useCreateUser } from '../hooks/use-create-user';
import { useUpdateUser } from '../hooks/use-update-user';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User;
  onSuccess?: () => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: UserFormDialogProps): JSX.Element {
  const isEditMode = user !== undefined;
  const schema = isEditMode ? UpdateUserSchema : CreateUserSchema;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateUserInput | UpdateUserInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      organizationId: user?.organizationId ?? undefined,
      teamId: user?.teamId ?? undefined,
      roleId: user?.roleId ?? undefined,
    },
  });

  const selectedOrgId = watch('organizationId') as string | null | undefined;

  useEffect(() => {
    if (open) {
      reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        organizationId: user?.organizationId ?? undefined,
        teamId: user?.teamId ?? undefined,
        roleId: user?.roleId ?? undefined,
      });
    }
  }, [open, user, reset]);

  const { data: orgsData, isLoading: orgsLoading } = useOrganizations({ limit: 200 });
  const organizations = orgsData?.data ?? [];

  const { data: teamsData, isLoading: teamsLoading } = useTeams({
    limit: 200,
    organizationId: selectedOrgId ?? undefined,
  });
  const teams = teamsData?.data ?? [];

  const { data: rolesData, isLoading: rolesLoading } = useRoles({ limit: 200 });
  const roles = rolesData?.data ?? [];

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (values: CreateUserInput | UpdateUserInput) => {
    if (isEditMode) {
      await updateMutation.mutateAsync({ id: user.id, data: values });
    } else {
      await createMutation.mutateAsync(values as CreateUserInput);
    }
    onOpenChange(false);
    onSuccess?.();
  };

  // Derive a clean value for Radix Select: null → sentinel, undefined → undefined (shows placeholder)
  function selectValue(v: string | null | undefined): string | undefined {
    if (v === null) return '__none__';
    return v ?? undefined;
  }

  const passwordError = (errors as { password?: { message?: string } }).password;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditMode ? 'Edit User' : 'Create User'}
      isSubmitting={isPending}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="user-name">Name</Label>
          <Input
            id="user-name"
            placeholder="Jane Doe"
            disabled={isPending}
            {...register('name')}
            aria-invalid={errors.name !== undefined}
          />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            placeholder="jane@mdm.local"
            disabled={isPending}
            {...register('email')}
            aria-invalid={errors.email !== undefined}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        {/* Password — required on create, optional on edit */}
        <div className="space-y-1.5">
          <Label htmlFor="user-password">
            Password
            {isEditMode && (
              <span className="ml-1 text-muted-foreground">(leave blank to keep unchanged)</span>
            )}
          </Label>
          <Input
            id="user-password"
            type="password"
            placeholder={isEditMode ? '••••••••' : 'Secur3Pass'}
            disabled={isPending}
            {...register('password')}
            aria-invalid={passwordError !== undefined}
          />
          {passwordError && <p className="text-sm text-destructive">{passwordError.message}</p>}
        </div>

        {/* Organization */}
        <div className="space-y-1.5">
          <Label htmlFor="user-org">Organization</Label>
          <Controller
            name="organizationId"
            control={control}
            render={({ field }) => (
              <Select
                value={selectValue(field.value as string | null | undefined)}
                onValueChange={(val) => {
                  field.onChange(val === '__none__' ? null : val);
                  // Reset team when org changes — a team from another org is invalid
                  setValue('teamId', undefined);
                }}
                disabled={orgsLoading || isPending}
              >
                <SelectTrigger id="user-org" aria-invalid={errors.organizationId !== undefined}>
                  <SelectValue placeholder="Select organization…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
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

        {/* Team */}
        <div className="space-y-1.5">
          <Label htmlFor="user-team">Team</Label>
          <Controller
            name="teamId"
            control={control}
            render={({ field }) => (
              <Select
                value={selectValue(field.value as string | null | undefined)}
                onValueChange={(val) => {
                  field.onChange(val === '__none__' ? null : val);
                }}
                disabled={teamsLoading || isPending}
              >
                <SelectTrigger id="user-team" aria-invalid={errors.teamId !== undefined}>
                  <SelectValue placeholder="Select team…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.teamId && <p className="text-sm text-destructive">{errors.teamId.message}</p>}
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label htmlFor="user-role">Role</Label>
          <Controller
            name="roleId"
            control={control}
            render={({ field }) => (
              <Select
                value={selectValue(field.value as string | null | undefined)}
                onValueChange={(val) => {
                  field.onChange(val === '__none__' ? null : val);
                }}
                disabled={rolesLoading || isPending}
              >
                <SelectTrigger id="user-role" aria-invalid={errors.roleId !== undefined}>
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.roleId && <p className="text-sm text-destructive">{errors.roleId.message}</p>}
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

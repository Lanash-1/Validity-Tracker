import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useItem, useUpdateItem } from '@/lib/queries';
import { ItemForm } from '@/components/item-form';
import { ErrorBox, Loading, Screen } from '@/components/ui';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const item = useItem(id);
  const update = useUpdateItem(id);
  if (item.isPending) return <Loading />;
  if (item.isError) return <ErrorBox message={item.error.message} onRetry={() => item.refetch()} />;
  return (
    <Screen>
      <ItemForm
        item={item.data}
        submitLabel="Save changes"
        submitting={update.isPending}
        onSubmit={async (values) => {
          const { spaceId: _ignored, ...patch } = values;
          await update.mutateAsync(patch);
          router.back();
        }}
      />
    </Screen>
  );
}

import React from 'react';
import { useRouter } from 'expo-router';
import { useCreateItem } from '@/lib/queries';
import { ItemForm } from '@/components/item-form';
import { Screen } from '@/components/ui';

export default function NewItemScreen() {
  const router = useRouter();
  const create = useCreateItem();
  return (
    <Screen>
      <ItemForm
        submitLabel="Add item"
        submitting={create.isPending}
        onSubmit={async (values) => {
          const item = await create.mutateAsync(values);
          router.replace(`/items/${item.id}`);
        }}
      />
    </Screen>
  );
}

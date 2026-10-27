import {
  type Category,
  type CreateItemInput,
  type Item,
  type ListItemsQuery,
  type Space,
  type UpdateItemInput,
} from '@vt/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { today } from './today';

export const keys = {
  me: ['me'] as const,
  spaces: ['spaces'] as const,
  members: (id: string) => ['spaces', id, 'members'] as const,
  categories: (spaceId?: string) => ['categories', spaceId ?? 'all'] as const,
  items: (q: Record<string, unknown>) => ['items', q] as const,
  item: (id: string) => ['item', id] as const,
  calendar: (spaceId: string | undefined, month: string) => ['calendar', spaceId ?? 'all', month] as const,
  devices: ['devices'] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.getMe() });
}

export function useSpaces() {
  return useQuery<Space[]>({ queryKey: keys.spaces, queryFn: () => api.listSpaces() });
}

export function useMembers(spaceId: string) {
  return useQuery({ queryKey: keys.members(spaceId), queryFn: () => api.listMembers(spaceId) });
}

export function useCategories(spaceId?: string) {
  return useQuery<Category[]>({
    queryKey: keys.categories(spaceId),
    queryFn: () => api.listCategories(spaceId),
    staleTime: 5 * 60_000,
  });
}

export type ItemsFilter = Omit<Partial<ListItemsQuery>, 'cursor' | 'limit'>;

/** Infinite list of items. `spaceId` undefined means all spaces. */
export function useItems(filter: ItemsFilter) {
  const t = today();
  return useInfiniteQuery({
    queryKey: keys.items({ ...filter, today: t }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listItems({ ...filter, limit: 50, cursor: pageParam, ...( { today: t } as object) }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Show the persisted cache instantly but always refresh lists on mount.
    staleTime: 0,
  });
}

export function useItem(id: string) {
  return useQuery<Item>({ queryKey: keys.item(id), queryFn: () => api.getItem(id) });
}

export function useCalendar(spaceId: string | undefined, month: string) {
  return useQuery({
    queryKey: keys.calendar(spaceId, month),
    queryFn: () => api.calendar({ spaceId, month }),
    staleTime: 0,
  });
}

function useInvalidateItems() {
  const qc = useQueryClient();
  return (item?: Item) => {
    void qc.invalidateQueries({ queryKey: ['items'] });
    void qc.invalidateQueries({ queryKey: ['calendar'] });
    if (item) qc.setQueryData(keys.item(item.id), item);
  };
}

export function useCreateItem() {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: (input: CreateItemInput) => api.createItem(input),
    onSuccess: (item) => inv(item),
  });
}

export function useUpdateItem(id: string) {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: (input: UpdateItemInput) => api.updateItem(id, input),
    onSuccess: (item) => inv(item),
  });
}

export function useConsumeItem() {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity?: number }) =>
      api.consumeItem(id, quantity ? { quantity } : {}),
    onSuccess: (item) => inv(item),
  });
}

export function useRestoreItem() {
  const inv = useInvalidateItems();
  return useMutation({ mutationFn: (id: string) => api.restoreItem(id), onSuccess: (item) => inv(item) });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: (_d, id) => {
      qc.removeQueries({ queryKey: keys.item(id) });
      void qc.invalidateQueries({ queryKey: ['items'] });
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

export function useUploadPhoto(id: string) {
  const inv = useInvalidateItems();
  return useMutation({
    mutationFn: (file: Blob | { uri: string; name: string; type: string }) => api.uploadItemPhoto(id, file),
    onSuccess: (item) => inv(item),
  });
}

export function useRemovePhoto(id: string) {
  const inv = useInvalidateItems();
  return useMutation({ mutationFn: () => api.deleteItemPhoto(id), onSuccess: (item) => inv(item) });
}

export function useSpaceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: keys.spaces });
    void qc.invalidateQueries({ queryKey: ['items'] });
    void qc.invalidateQueries({ queryKey: ['categories'] });
  };
  return {
    create: useMutation({ mutationFn: (name: string) => api.createSpace({ name }), onSuccess: invalidate }),
    join: useMutation({ mutationFn: (code: string) => api.joinSpace({ inviteCode: code }), onSuccess: invalidate }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: string; name: string }) => api.updateSpace(id, { name }),
      onSuccess: invalidate,
    }),
    rotate: useMutation({ mutationFn: (id: string) => api.rotateInvite(id), onSuccess: invalidate }),
    leave: useMutation({
      mutationFn: ({ id, userId }: { id: string; userId: string }) => api.leaveSpace(id, userId),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.deleteSpace(id), onSuccess: invalidate }),
  };
}

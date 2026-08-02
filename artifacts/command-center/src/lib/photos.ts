// Photo extraction helpers for the lead activity timeline. Activities store
// damage photo paths in metadata.photoPaths; only object-storage paths are
// shown. Mirrors artifacts/mobile-crm/lib/photos.ts — keep behavior in sync.

export function extractPhotoPaths(metadata: Record<string, unknown> | undefined | null): string[] {
  const raw = metadata?.['photoPaths'];
  return Array.isArray(raw)
    ? raw.filter((p): p is string => typeof p === 'string' && p.startsWith('/objects/'))
    : [];
}

export function photoUrl(path: string): string {
  return `/api/v1/storage${path}`;
}

/**
 * Flatten photo paths across activities, preserving the activities' order
 * (timeline order) and each activity's own photo order.
 */
export function flattenPhotoPaths(
  activities: ReadonlyArray<{ metadata?: Record<string, unknown> | null }>,
): string[] {
  return activities.flatMap((a) => extractPhotoPaths(a.metadata));
}

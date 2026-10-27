import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Photo storage behind a tiny interface so the API can run without Catalyst.
 * @typedef {{ put(buffer: Buffer, mime: string): Promise<{fileId: string}>, get(fileId: string): Promise<{stream: import('stream').Readable, mime: string}|null>, remove(fileId: string): Promise<void> }} PhotoStore
 */

/** @returns {PhotoStore} */
export function createMemoryPhotoStore() {
  const files = new Map();
  return {
    async put(buffer, mime) {
      const fileId = randomUUID();
      files.set(fileId, { buffer, mime });
      return { fileId };
    },
    async get(fileId) {
      const f = files.get(fileId);
      if (!f) return null;
      const { Readable } = await import('node:stream');
      return { stream: Readable.from(f.buffer), mime: f.mime };
    },
    async remove(fileId) {
      files.delete(fileId);
    },
  };
}

/**
 * Catalyst File Store implementation. Files live in the folder configured by
 * PHOTO_FOLDER_ID. The SDK upload takes a ReadStream, so we spool to a temp
 * file first. The mime type is encoded in the file name for retrieval.
 * @returns {PhotoStore}
 */
export function createCatalystPhotoStore(app, folderId) {
  const folder = () => app.filestore().folder(folderId);
  const extFor = (mime) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');
  const mimeFor = (name) =>
    name.endsWith('.png') ? 'image/png' : name.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  return {
    async put(buffer, mime) {
      if (!folderId) throw new Error('PHOTO_FOLDER_ID is not configured');
      const name = `${randomUUID()}.${extFor(mime)}`;
      const tmp = join(tmpdir(), name);
      await fs.writeFile(tmp, buffer);
      try {
        const res = await folder().uploadFile({ code: createReadStream(tmp), name });
        return { fileId: `${res.id}:${name}` };
      } finally {
        await fs.unlink(tmp).catch(() => {});
      }
    },
    async get(fileId) {
      const [id, name = 'photo.jpg'] = String(fileId).split(':');
      try {
        const stream = await folder().getFileStream(id);
        return { stream, mime: mimeFor(name) };
      } catch {
        return null;
      }
    },
    async remove(fileId) {
      const [id] = String(fileId).split(':');
      await folder().deleteFile(id).catch(() => {});
    },
  };
}

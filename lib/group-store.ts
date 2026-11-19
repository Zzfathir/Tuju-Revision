import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { day, type Group } from "./group-arrival";

type Versioned = { group: Group; version: string };
type Store = {
  read: (id: string) => Promise<Versioned | null>;
  write: (id: string, group: Group, version?: string) => Promise<boolean>;
};

type LocalState = { records: Map<string, Versioned>; revision: number };
// Keep local test rooms across Next.js development recompiles.
const development = globalThis as typeof globalThis & { jalanPulangGroups?: LocalState };
const localState = development.jalanPulangGroups ??= { records: new Map(), revision: 0 };
const memory = localState.records;
const local: Store = {
  async read(id) {
    const saved = memory.get(id);
    if (!saved || saved.group.expiresAt > Date.now()) return saved ?? null;
    memory.delete(id);
    return null;
  },
  async write(id, group, version) {
    for (const [key, saved] of memory) {
      if (saved.group.expiresAt <= Date.now()) memory.delete(key);
    }
    if (version !== memory.get(id)?.version) return false;
    memory.set(id, { group, version: String(++localState.revision) });
    return true;
  },
};

const pathFor = (id: string) => "group-arrival/" + id + ".json";
const blob: Store = {
  async read(id) {
    const result = await get(pathFor(id), { access: "private", useCache: false, abortSignal: AbortSignal.timeout(5000) });
    if (!result?.stream) return null;
    return { group: await new Response(result.stream).json() as Group, version: result.blob.etag };
  },
  async write(id, group, version) {
    try {
      await put(pathFor(id), JSON.stringify(group), {
        access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: version != null,
        ifMatch: version, ttlDays: Math.max(1, Math.ceil((group.expiresAt - Date.now()) / day)),
        abortSignal: AbortSignal.timeout(5000),
      });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      throw error;
    }
  },
};

export function groupStore(): Store {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return blob;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") throw new Error("Group Arrival storage is unavailable");
  return local;
}

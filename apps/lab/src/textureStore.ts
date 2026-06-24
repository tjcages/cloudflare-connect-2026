const DB_NAME = "stripes-engine-lab";
const STORE = "textures";

interface StoredTexture {
  data: ArrayBuffer;
  type: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = op(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function putTextureBlob(id: string, blob: Blob, type: string): Promise<void> {
  const data = await blob.arrayBuffer();
  const record: StoredTexture = { data, type };
  await run<IDBValidKey>("readwrite", (store) => store.put(record, id));
}

export function getTextureBlob(id: string): Promise<{ blob: Blob; type: string } | undefined> {
  return run<StoredTexture | undefined>(
    "readonly",
    (store) => store.get(id) as IDBRequest<StoredTexture | undefined>,
  ).then((rec) => (rec ? { blob: new Blob([rec.data], { type: rec.type }), type: rec.type } : undefined));
}

export function deleteTextureBlob(id: string): Promise<void> {
  return run<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>).then(() => undefined);
}

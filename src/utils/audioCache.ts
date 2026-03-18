/**
 * IndexedDB-based audio cache for TTS output.
 *
 * Stores complete WAV blobs keyed by a deterministic cache key
 * (hash of text + voice settings) so re-playing a message doesn't
 * require re-synthesising audio on the GPU.
 */

const DB_NAME = 'manju-audio-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve a cached audio Blob by cache key. Returns null on miss. */
export async function getCachedAudio(cacheKey: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Store a WAV Blob in the cache. */
export async function setCachedAudio(cacheKey: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, cacheKey);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Caching failure is non-fatal
    console.warn('Failed to cache audio:', cacheKey);
  }
}

// ---------------------------------------------------------------------------
// WAV concatenation
// ---------------------------------------------------------------------------

/**
 * Concatenate multiple WAV blobs (each with 44-byte PCM header) into a
 * single WAV blob.  Assumes all blobs share the same sample rate, bit
 * depth and channel count (which they will since they come from the
 * same TTS model).
 */
export async function concatenateWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) return new Blob();
  if (blobs.length === 1) return blobs[0];

  // Read all blobs into ArrayBuffers
  const buffers = await Promise.all(blobs.map(b => b.arrayBuffer()));

  // Use header from first file
  const firstHeader = new Uint8Array(buffers[0].slice(0, 44));

  // Collect PCM data (skip 44-byte header from each)
  let totalPCMLength = 0;
  const pcmParts: Uint8Array[] = [];
  for (const buf of buffers) {
    const pcm = new Uint8Array(buf.slice(44));
    pcmParts.push(pcm);
    totalPCMLength += pcm.byteLength;
  }

  // Build new header with correct sizes
  const header = new Uint8Array(firstHeader);
  const view = new DataView(header.buffer);
  // Offset 4: RIFF chunk size = 36 + data length
  view.setUint32(4, 36 + totalPCMLength, true);
  // Offset 40: data sub-chunk size
  view.setUint32(40, totalPCMLength, true);

  // Assemble final buffer
  const result = new Uint8Array(44 + totalPCMLength);
  result.set(header, 0);
  let offset = 44;
  for (const pcm of pcmParts) {
    result.set(pcm, offset);
    offset += pcm.byteLength;
  }

  return new Blob([result], { type: 'audio/wav' });
}

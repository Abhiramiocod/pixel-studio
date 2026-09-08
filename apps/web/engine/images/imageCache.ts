/**
 * Image loading for the renderer.
 *
 * The renderer is synchronous, so images are cached by source and drawn on the
 * next frame once decoded. Subscribers are notified when that happens, which is
 * how the canvas knows to repaint.
 */

type Listener = () => void;

const cache = new Map<string, HTMLImageElement>();
const failed = new Set<string>();
const listeners = new Set<Listener>();

/** Notified whenever an image finishes loading. */
export function onImageLoaded(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Returns a decoded image, or null while it loads. Safe to call on every frame:
 * loading starts only once per source.
 */
export function getImage(src: string): HTMLImageElement | null {
  if (typeof window === "undefined" || src.length === 0) return null;

  const cached = cache.get(src);
  if (cached) return cached.complete && cached.naturalWidth > 0 ? cached : null;
  if (failed.has(src)) return null;

  const image = new Image();
  cache.set(src, image);
  image.onload = notify;
  image.onerror = () => {
    cache.delete(src);
    failed.add(src);
  };
  image.src = src;
  return null;
}

/** Reads an uploaded file as a data URL plus its natural size. */
export async function readImageFile(file: File): Promise<{
  src: string;
  width: number;
  height: number;
}> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file"));
    reader.readAsDataURL(file);
  });

  const size = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Could not decode the image"));
      image.src = src;
    },
  );

  cache.set(src, Object.assign(new Image(), { src }));
  return { src, ...size };
}

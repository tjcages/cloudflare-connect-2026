const IMAGE_PROXY = "https://blog.cloudflare.com/_image";
const SOURCE_WIDTH = 400;

const pending = new Map<string, Promise<string | null>>();

function encode(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary);
}

async function inline(src: string): Promise<string | null> {
  const proxied = `${IMAGE_PROXY}?href=${encodeURIComponent(src)}&w=${SOURCE_WIDTH}&f=webp`;

  try {
    const response = await fetch(proxied);

    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "image/webp";
    const bytes = new Uint8Array(await response.arrayBuffer());

    return `data:${type};base64,${encode(bytes)}`;
  } catch {
    return null;
  }
}

export function coverSource(src: string): Promise<string | null> {
  if (!src.startsWith("https://")) return Promise.resolve(null);

  let request = pending.get(src);

  if (!request) {
    request = inline(src).then((result) => {
      if (!result) pending.delete(src);
      return result;
    });
    pending.set(src, request);
  }

  return request;
}

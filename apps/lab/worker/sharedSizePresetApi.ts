import {
  validateSharedSizePresetInput,
  type SharedSizePreset,
  type SharedSizePresetInput,
} from "../src/sharedSizePresets";

export interface SharedSizePresetStore {
  list(): Promise<SharedSizePreset[]>;
  create(id: string, input: SharedSizePresetInput): Promise<SharedSizePreset>;
  delete(id: string): Promise<boolean>;
}

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_REQUEST_BODY_BYTES = 16_384;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

async function readJsonBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body.");

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function handleSharedSizePresetApi(
  request: Request,
  store: SharedSizePresetStore,
  presetId: string | null = null,
): Promise<Response> {
  if (presetId !== null) {
    if (request.method !== "DELETE") return json({ error: "Method not allowed." }, 405);
    if (!/^[0-9a-f-]{36}$/i.test(presetId)) return json({ error: "Invalid shared size ID." }, 400);
    const deleted = await store.delete(presetId);
    return deleted
      ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } })
      : json({ error: "Shared size not found." }, 404);
  }

  if (request.method === "GET") {
    return json({ presets: await store.list() });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return json({ error: "Request body is too large." }, 413);
  }

  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    return json({ error: "Request body must be valid JSON." }, 400);
  }
  const validated = validateSharedSizePresetInput(body);
  if (!validated.ok) return json({ error: validated.message }, 400);

  try {
    const preset = await store.create(crypto.randomUUID(), validated.value);
    return json({ preset }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) {
      return json({ error: "A shared size with that name already exists." }, 409);
    }
    throw error;
  }
}

export const SHARED_PRESET_KINDS = ["size", "layout", "style", "color"] as const;

export type SharedPresetKind = (typeof SHARED_PRESET_KINDS)[number];

export interface SharedPreset {
  id: string;
  kind: SharedPresetKind;
  name: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface SharedPresetCreateInput {
  kind: SharedPresetKind;
  name: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
}

export interface SharedPresetUpdateInput {
  name: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
  expectedRevision: number;
}

export type MutationResult = { status: "ok"; preset: SharedPreset } | { status: "not_found" } | { status: "conflict" };

export type DeleteResult = "deleted" | "not_found" | "conflict";

export interface SharedPresetStore {
  list(kind: SharedPresetKind | null): Promise<SharedPreset[]>;
  get(id: string): Promise<SharedPreset | null>;
  create(id: string, input: SharedPresetCreateInput): Promise<SharedPreset>;
  update(id: string, input: SharedPresetUpdateInput): Promise<MutationResult>;
  delete(id: string, expectedRevision: number): Promise<DeleteResult>;
}

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
} as const;

const MAX_SHARED_PRESET_PAYLOAD_BYTES = 262_144;
export const MAX_SHARED_PRESET_BODY_BYTES = MAX_SHARED_PRESET_PAYLOAD_BYTES + 16_384;
const MAX_NAME_LENGTH = 80;
const MAX_PAYLOAD_DEPTH = 16;
const MAX_PAYLOAD_NODES = 10_000;
const MAX_PAYLOAD_KEY_LENGTH = 128;
const MAX_PAYLOAD_STRING_LENGTH = MAX_SHARED_PRESET_PAYLOAD_BYTES;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: JSON_HEADERS });
}

function methodNotAllowed(allowed: string): Response {
  const response = json({ error: "Method not allowed." }, 405);
  response.headers.set("allow", allowed);
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function validatePayloadValue(value: unknown): string | null {
  let nodeCount = 0;

  function visit(current: unknown, depth: number): string | null {
    nodeCount += 1;
    if (nodeCount > MAX_PAYLOAD_NODES) return "Preset payload is too complex.";
    if (depth > MAX_PAYLOAD_DEPTH) return "Preset payload is nested too deeply.";
    if (current === null || typeof current === "boolean") return null;
    if (typeof current === "number") return Number.isFinite(current) ? null : "Preset payload has an invalid number.";
    if (typeof current === "string") {
      return current.length <= MAX_PAYLOAD_STRING_LENGTH ? null : "Preset payload contains a string that is too long.";
    }
    if (Array.isArray(current)) {
      for (const item of current) {
        const error = visit(item, depth + 1);
        if (error) return error;
      }
      return null;
    }
    if (!isRecord(current)) return "Preset payload must contain only JSON values.";
    for (const [key, child] of Object.entries(current)) {
      if (key.length > MAX_PAYLOAD_KEY_LENGTH || FORBIDDEN_KEYS.has(key))
        return "Preset payload contains an invalid key.";
      const error = visit(child, depth + 1);
      if (error) return error;
    }
    return null;
  }

  return visit(value, 0);
}

function validateName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") return { ok: false, error: "Preset name must be a string." };
  if (/\p{Cc}/u.test(value)) return { ok: false, error: "Preset name contains invalid characters." };
  const name = value.trim().replace(/\s+/gu, " ");
  if (!name) return { ok: false, error: "Preset name is required." };
  if (name.length > MAX_NAME_LENGTH)
    return { ok: false, error: `Preset name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  return { ok: true, value: name };
}

function expectedSchemaVersion(kind: SharedPresetKind): number {
  return kind === "layout" ? 2 : 1;
}

function validateSchemaVersion(kind: SharedPresetKind, value: unknown): value is number {
  return value === expectedSchemaVersion(kind);
}

function validateExpectedRevision(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= Number.MAX_SAFE_INTEGER;
}

function validateSizePayload(payload: Record<string, unknown>): string | null {
  if (!hasOnlyKeys(payload, ["unit", "width", "height", "ppi"])) return "Size payload contains unsupported fields.";
  if (payload.unit !== "pixels" && payload.unit !== "inches") return "Size unit must be pixels or inches.";
  const maximumDimension = payload.unit === "pixels" ? 8_192 : 1_000;
  if (
    typeof payload.width !== "number" ||
    !Number.isFinite(payload.width) ||
    payload.width <= 0 ||
    payload.width > maximumDimension
  ) {
    return `Size width must be greater than zero and no more than ${maximumDimension}.`;
  }
  if (
    typeof payload.height !== "number" ||
    !Number.isFinite(payload.height) ||
    payload.height <= 0 ||
    payload.height > maximumDimension
  ) {
    return `Size height must be greater than zero and no more than ${maximumDimension}.`;
  }
  if (!Number.isInteger(payload.ppi) || Number(payload.ppi) < 1 || Number(payload.ppi) > 1_200) {
    return "Size PPI must be a whole number from 1 to 1200.";
  }
  return null;
}

function validateConfigPayload(payload: Record<string, unknown>, kind: "layout" | "style"): string | null {
  if (!hasOnlyKeys(payload, ["config", "lab"]) || !Object.hasOwn(payload, "config")) {
    return `${kind === "layout" ? "Layout" : "Style"} payload must contain config and may contain lab.`;
  }
  if (!isRecord(payload.config)) return "Preset config must be an object.";
  const lab = payload.lab;
  if (Object.hasOwn(payload, "lab") && !isRecord(lab)) return "Preset lab settings must be an object.";
  if (kind === "style" && isRecord(lab)) {
    const localUiKeys = ["drawerOpen", "previewZoom", "textureSidebarOpen", "shaderSidebarOpen"];
    if (localUiKeys.some((key) => Object.hasOwn(lab, key))) {
      return "Style payload cannot contain local interface settings.";
    }
  }
  return null;
}

function validateColorPayload(payload: Record<string, unknown>): string | null {
  if (!hasOnlyKeys(payload, ["stripePalette", "twizzler", "backgroundColor"])) {
    return "Color payload contains unsupported fields.";
  }
  if (payload.stripePalette !== null && typeof payload.stripePalette !== "string") {
    return "Color stripe palette must be a string or null.";
  }
  const twizzler = payload.twizzler;
  if (!isRecord(twizzler)) return "Color twizzler settings are required.";
  const twizzlerKeys = ["color", "colorFar", "colorNear", "colorEdge"] as const;
  if (!hasOnlyKeys(twizzler, twizzlerKeys) || !twizzlerKeys.every((key) => Object.hasOwn(twizzler, key))) {
    return "Color twizzler settings must contain all four colors.";
  }
  if (
    !twizzlerKeys.every((key) => {
      const value = twizzler[key];
      return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
    })
  ) {
    return "Twizzler colors must use #RRGGBB hex values.";
  }
  if (
    Object.hasOwn(payload, "backgroundColor") &&
    payload.backgroundColor !== null &&
    (!Number.isInteger(payload.backgroundColor) ||
      Number(payload.backgroundColor) < 0 ||
      Number(payload.backgroundColor) > 0xffffff)
  ) {
    return "Background color must be an RGB integer from 0 to 16777215 or null.";
  }
  return null;
}

function validatePayload(
  kind: SharedPresetKind,
  value: unknown,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "Preset payload must be an object." };
  const payloadError = validatePayloadValue(value);
  if (payloadError) return { ok: false, error: payloadError };
  const serializedBytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (serializedBytes > MAX_SHARED_PRESET_PAYLOAD_BYTES) return { ok: false, error: "Preset payload is too large." };
  const kindError =
    kind === "size"
      ? validateSizePayload(value)
      : kind === "layout" || kind === "style"
        ? validateConfigPayload(value, kind)
        : validateColorPayload(value);
  if (kindError) return { ok: false, error: kindError };
  return { ok: true, value };
}

function validateCreateInput(
  value: unknown,
): { ok: true; value: SharedPresetCreateInput } | { ok: false; error: string } {
  if (!isRecord(value) || !hasOnlyKeys(value, ["kind", "name", "payload", "schemaVersion"])) {
    return { ok: false, error: "Request body contains unsupported fields." };
  }
  if (!SHARED_PRESET_KINDS.includes(value.kind as SharedPresetKind)) {
    return { ok: false, error: "Preset kind must be size, layout, style, or color." };
  }
  const kind = value.kind as SharedPresetKind;
  const name = validateName(value.name);
  if (!name.ok) return name;
  if (!validateSchemaVersion(kind, value.schemaVersion)) {
    return { ok: false, error: `Schema version for ${kind} presets must be ${expectedSchemaVersion(kind)}.` };
  }
  const payload = validatePayload(kind, value.payload);
  if (!payload.ok) return payload;
  return { ok: true, value: { kind, name: name.value, payload: payload.value, schemaVersion: value.schemaVersion } };
}

function validateUpdateInput(
  value: unknown,
  kind: SharedPresetKind,
): { ok: true; value: SharedPresetUpdateInput } | { ok: false; error: string } {
  if (!isRecord(value) || !hasOnlyKeys(value, ["name", "payload", "schemaVersion", "expectedRevision"])) {
    return { ok: false, error: "Request body contains unsupported fields." };
  }
  const name = validateName(value.name);
  if (!name.ok) return name;
  if (!validateSchemaVersion(kind, value.schemaVersion)) {
    return { ok: false, error: `Schema version for ${kind} presets must be ${expectedSchemaVersion(kind)}.` };
  }
  if (!validateExpectedRevision(value.expectedRevision)) {
    return { ok: false, error: "Expected revision must be a positive whole number." };
  }
  const payload = validatePayload(kind, value.payload);
  if (!payload.ok) return payload;
  return {
    ok: true,
    value: {
      name: name.value,
      payload: payload.value,
      schemaVersion: value.schemaVersion,
      expectedRevision: value.expectedRevision,
    },
  };
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
    if (byteLength > MAX_SHARED_PRESET_BODY_BYTES) {
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

async function parseBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_SHARED_PRESET_BODY_BYTES) {
    return { ok: false, response: json({ error: "Request body is too large." }, 413) };
  }
  try {
    return { ok: true, value: await readJsonBody(request) };
  } catch (error) {
    if (error instanceof RangeError) return { ok: false, response: json({ error: error.message }, 413) };
    return { ok: false, response: json({ error: "Request body must be valid JSON." }, 400) };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

export async function handleSharedPresetApi(
  request: Request,
  store: SharedPresetStore,
  presetId: string | null = null,
): Promise<Response> {
  if (presetId !== null) {
    if (!UUID_PATTERN.test(presetId)) return json({ error: "Invalid shared preset ID." }, 400);

    if (request.method === "DELETE") {
      const expectedRevision = Number(new URL(request.url).searchParams.get("expectedRevision"));
      if (!validateExpectedRevision(expectedRevision)) {
        return json({ error: "Expected revision must be a positive whole number." }, 400);
      }
      const result = await store.delete(presetId, expectedRevision);
      if (result === "deleted") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
      if (result === "conflict") return json({ error: "Preset changed since it was loaded." }, 409);
      return json({ error: "Shared preset not found." }, 404);
    }

    if (request.method !== "PUT") return methodNotAllowed("PUT, DELETE");
    const existing = await store.get(presetId);
    if (!existing) return json({ error: "Shared preset not found." }, 404);
    const body = await parseBody(request);
    if (!body.ok) return body.response;
    const validated = validateUpdateInput(body.value, existing.kind);
    if (!validated.ok) return json({ error: validated.error }, 400);
    try {
      const result = await store.update(presetId, validated.value);
      if (result.status === "ok") return json({ preset: result.preset });
      if (result.status === "conflict") return json({ error: "Preset changed since it was loaded." }, 409);
      return json({ error: "Shared preset not found." }, 404);
    } catch (error) {
      if (isUniqueConstraintError(error))
        return json({ error: "A shared preset with that name and kind already exists." }, 409);
      throw error;
    }
  }

  if (request.method === "GET") {
    const kindParam = new URL(request.url).searchParams.get("kind");
    if (kindParam !== null && !SHARED_PRESET_KINDS.includes(kindParam as SharedPresetKind)) {
      return json({ error: "Preset kind must be size, layout, style, or color." }, 400);
    }
    return json({ presets: await store.list(kindParam as SharedPresetKind | null) });
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST");

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const validated = validateCreateInput(body.value);
  if (!validated.ok) return json({ error: validated.error }, 400);
  try {
    const preset = await store.create(crypto.randomUUID(), validated.value);
    return json({ preset }, 201);
  } catch (error) {
    if (isUniqueConstraintError(error))
      return json({ error: "A shared preset with that name and kind already exists." }, 409);
    throw error;
  }
}

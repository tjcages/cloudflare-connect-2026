import { D1SharedSizePresetStore } from "./d1SharedSizePresetStore";
import { handleSharedSizePresetApi } from "./sharedSizePresetApi";

function apiError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" } },
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const presetPathMatch = url.pathname.match(/^\/api\/size-presets\/([^/]+)$/);
    if (url.pathname === "/api/size-presets" || presetPathMatch) {
      let presetId: string | null = null;
      if (presetPathMatch) {
        try {
          presetId = decodeURIComponent(presetPathMatch[1]);
        } catch {
          return apiError("Invalid shared size ID.", 400);
        }
      }
      const database = url.hostname === env.PRODUCTION_HOST ? env.DB : env.PREVIEW_DB;
      try {
        return await handleSharedSizePresetApi(request, new D1SharedSizePresetStore(database), presetId);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "shared_size_preset_api_error",
            method: request.method,
            pathname: url.pathname,
            message: error instanceof Error ? error.message : "Unknown error",
          }),
        );
        return apiError("The shared size service is temporarily unavailable.", 500);
      }
    }
    if (url.pathname.startsWith("/api/")) return apiError("Not found.", 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { putTextureBlob, getTextureBlob, deleteTextureBlob, clearTextureBlobs } from "./textureStore";

describe("textureStore", () => {
  it("stores and retrieves bytes by id", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await putTextureBlob("upload-a", blob, "image/png");
    const got = await getTextureBlob("upload-a");
    expect(got?.type).toBe("image/png");
    expect(new Uint8Array(await got!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("returns undefined for a missing id", async () => {
    expect(await getTextureBlob("missing")).toBeUndefined();
  });

  it("deletes a stored blob", async () => {
    const blob = new Blob(["x"], { type: "video/mp4" });
    await putTextureBlob("upload-b", blob, "video/mp4");
    await deleteTextureBlob("upload-b");
    expect(await getTextureBlob("upload-b")).toBeUndefined();
  });

  it("clears all stored blobs", async () => {
    await putTextureBlob("upload-c", new Blob(["c"], { type: "image/png" }), "image/png");
    await putTextureBlob("upload-d", new Blob(["d"], { type: "image/png" }), "image/png");
    await clearTextureBlobs();
    expect(await getTextureBlob("upload-c")).toBeUndefined();
    expect(await getTextureBlob("upload-d")).toBeUndefined();
  });
});

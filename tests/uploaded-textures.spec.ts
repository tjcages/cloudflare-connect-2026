import { test, expect, type Page } from "@playwright/test";

const PNG_1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function clearLabStorage(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        localStorage.clear();
        const req = indexedDB.deleteDatabase("stripes-engine-lab");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
}

test("uploaded texture persists across reload and can be deleted", async ({ page }) => {
  await page.goto("/lab.html");
  await clearLabStorage(page);
  await page.reload();

  await page.locator('input[type="file"]').setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_1x1, "base64"),
  });

  // handleFileChange persists, then reloads. Wait for the manifest to appear.
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("stripes-engine-lab-uploads");
    return !!raw && JSON.parse(raw).length === 1;
  });

  const state = await page.evaluate(() => ({
    manifest: JSON.parse(localStorage.getItem("stripes-engine-lab-uploads") || "[]"),
    selected: localStorage.getItem("stripes-engine-lab-texture"),
  }));
  expect(state.manifest).toHaveLength(1);
  expect(state.manifest[0].label).toBe("fixture.png");
  expect(state.manifest[0].kind).toBe("image");
  expect(state.selected).toBe(state.manifest[0].id);

  const id = state.manifest[0].id as string;

  // Bytes are in IndexedDB.
  const hasBlob = await page.evaluate(
    (textureId) =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open("stripes-engine-lab", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const getReq = db.transaction("textures", "readonly").objectStore("textures").get(textureId);
          getReq.onsuccess = () => {
            db.close();
            resolve(!!getReq.result);
          };
          getReq.onerror = () => {
            db.close();
            reject(getReq.error);
          };
        };
      }),
    id,
  );
  expect(hasBlob).toBe(true);

  // Survives a fresh reload: still the selected texture.
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("stripes-engine-lab-texture"))).toBe(id);

  // Delete it → falls back to the default built-in, manifest empties.
  await page.getByRole("button", { name: "Delete texture" }).click();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("stripes-engine-lab-uploads");
    return !raw || JSON.parse(raw).length === 0;
  });
  expect(await page.evaluate(() => localStorage.getItem("stripes-engine-lab-texture"))).toBe("cloudflare-footer");
});

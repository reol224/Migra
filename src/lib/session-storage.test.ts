import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "./session-storage";

const session = {
  files: [{ name: "products.csv", rowCount: 2, headers: ["Title"], rows: [{ Title: "Hat" }, { Title: "Shirt" }], previewRows: [{ Title: "Hat" }] }],
  fileTypes: ["product"],
  activeFileIndex: 0,
  mappingsPerFile: [[{ sourceColumn: "Title", targetField: { key: "Title" } }]],
  variantConfigPerFile: [null],
};

describe("local migration session storage", () => {
  beforeEach(async () => clearLocalSession());
  afterEach(async () => clearLocalSession());

  it("restores the full working session after a new app instance", async () => {
    await saveLocalSession(session);

    // Reading again simulates the app mounting after a browser refresh.
    await expect(loadLocalSession<typeof session>()).resolves.toEqual(session);
  });

  it("removes the saved session when the user discards it", async () => {
    await saveLocalSession(session);
    await clearLocalSession();

    await expect(loadLocalSession<typeof session>()).resolves.toBeNull();
  });
});

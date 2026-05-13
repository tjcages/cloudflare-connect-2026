import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { resetAppStoreDocumentToDefault } from "../store";

beforeEach(() => {
  localStorage.clear();
  resetAppStoreDocumentToDefault();
});

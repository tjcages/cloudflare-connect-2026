/// <reference types="vite/client" />

declare module "*?raw" {
  const content: string;
  export default content;
}

declare global {
  interface Window {
    /** Populated in dev only — see `src/devExposeBuilderStorage.ts` and `.cursor/rules/builder-local-storage.mdc`. */
    __SECTION_GRID_BUILDER_DEV__?: import("./devExposeBuilderStorage").SectionGridBuilderDevApi;
  }
}

export {};

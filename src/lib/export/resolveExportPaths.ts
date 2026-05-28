export type ExportConvention = "auto" | "folderIndex" | "namedFile";
export type FolderNaming = "kebab" | "pascal";

const COMPONENT_FOLDER_KEBAB = "ascii-video";
const COMPONENT_FOLDER_PASCAL = "AsciiVideo";

export type ResolvedExportPaths = {
  /** Directory path without trailing slash, e.g. `src/components/ascii-video`. */
  directory: string;
  /** Entry file basename: `index.tsx` or `AsciiVideo.tsx`. */
  entryFileName: string;
  files: {
    shaders: string;
    types: string;
    entry: string;
  };
};

function normalizeTargetDir(targetDir: string): string {
  return targetDir.trim().replace(/^\/+/, "").replace(/\/+$/, "").replace(/\\/g, "/");
}

function endsWithComponentFolder(dir: string): boolean {
  const lower = dir.toLowerCase();
  return lower.endsWith(COMPONENT_FOLDER_KEBAB) || lower.endsWith(COMPONENT_FOLDER_PASCAL.toLowerCase());
}

function joinPath(base: string, segment: string): string {
  if (!base) {
    return segment;
  }
  return `${base}/${segment}`;
}

export function resolveComponentFolderName(folderNaming: FolderNaming): string {
  return folderNaming === "pascal" ? COMPONENT_FOLDER_PASCAL : COMPONENT_FOLDER_KEBAB;
}

export function resolveEntryFileName(convention: ExportConvention): string {
  if (convention === "namedFile") {
    return "AsciiVideo.tsx";
  }
  if (convention === "folderIndex") {
    return "index.tsx";
  }
  return "index.tsx";
}

export function resolveExportPaths(options: {
  targetDir: string;
  convention?: ExportConvention;
  folderNaming?: FolderNaming;
}): ResolvedExportPaths {
  const convention = options.convention ?? "folderIndex";
  const folderNaming = options.folderNaming ?? "kebab";
  const normalized = normalizeTargetDir(options.targetDir);

  if (!normalized) {
    throw new Error("Target directory is required.");
  }

  const componentFolder = resolveComponentFolderName(folderNaming);
  const directory = endsWithComponentFolder(normalized) ? normalized : joinPath(normalized, componentFolder);
  const entryFileName = resolveEntryFileName(convention);

  return {
    directory,
    entryFileName,
    files: {
      shaders: `${directory}/shaders.ts`,
      types: `${directory}/types.ts`,
      entry: `${directory}/${entryFileName}`,
    },
  };
}

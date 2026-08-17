import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";

export interface FileInfo {
  path: string;
  relativePath: string;
}

export async function getFilesRecursively(
  dir: string,
  baseDir: string,
  extensions: string[],
  excludeDirs: string[] = []
): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      if (excludeDirs.includes(fullPath)) {
        continue;
      }

      const stats = await stat(fullPath);

      if (stats.isDirectory()) {
        const subFiles = await getFilesRecursively(
          fullPath,
          baseDir,
          extensions,
          excludeDirs
        );
        files.push(...subFiles);
      } else if (stats.isFile()) {
        const ext = entry.split(".").pop()?.toLowerCase();

        if (ext && extensions.includes(ext)) {
          files.push({
            path: fullPath,
            relativePath: relative(baseDir, fullPath),
          });
        }
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return files;
}

export async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const METADATA_FILE = "dev/commands/compressor/.compressor-metadata.json";

interface FileMetadata {
  [filePath: string]: {
    hash: string;
    timestamp: number;
  };
}

async function loadMetadata(): Promise<FileMetadata> {
  try {
    const data = await readFile(METADATA_FILE, "utf-8");

    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveMetadata(metadata: FileMetadata): Promise<void> {
  await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2), "utf-8");
}

async function getFileHash(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    const hash = createHash("sha256");
    hash.update(content);

    return hash.digest("hex");
  } catch {
    return "";
  }
}

export async function markFileAsProcessed(filePath: string): Promise<void> {
  try {
    const metadata = await loadMetadata();
    const hash = await getFileHash(filePath);

    metadata[filePath] = {
      hash,
      timestamp: Date.now(),
    };

    await saveMetadata(metadata);
  } catch {
    console.warn(`Warning: Could not mark file as processed: ${filePath}`);
  }
}

export async function checkIfFileIsProcessed(
  filePath: string
): Promise<boolean> {
  try {
    const metadata = await loadMetadata();
    const entry = metadata[filePath];

    if (!entry) {
      return false;
    }

    const currentHash = await getFileHash(filePath);

    return currentHash === entry.hash && currentHash !== "";
  } catch {
    return false;
  }
}

export async function unmarkFileAsProcessed(filePath: string): Promise<void> {
  try {
    const metadata = await loadMetadata();
    delete metadata[filePath];
    await saveMetadata(metadata);
  } catch {
    // Ignore errors if metadata doesn't exist
  }
}

export async function hasProcessedRecordFor(
  filePaths: string[]
): Promise<boolean> {
  const metadata = await loadMetadata();

  return filePaths.some((filePath) => filePath in metadata);
}

export async function doesFileExist(filePath: string): Promise<boolean> {
  try {
    await access(filePath);

    return true;
  } catch {
    return false;
  }
}

import { spawn } from "node:child_process";
import { stat, unlink } from "node:fs/promises";
import { join, parse } from "node:path";

import {
  checkIfFileIsProcessed,
  doesFileExist,
  ensureDirectoryExists,
  formatFileSize,
  getFilesRecursively,
  hasProcessedRecordFor,
  markFileAsProcessed,
  unmarkFileAsProcessed,
} from "./utils";

const CONFIG = {
  sourceDir: "public/raw-assets",
  outputBaseDir: "public",
  extensions: ["mp4", "mov", "avi", "webm", "mkv"],
  removeAudio: true,
  formats: [{ format: "mp4", codec: "libx264", quality: 22, scale: 1.0 }],
};

interface CompressionResult {
  compressedSize: number;
  format: string;
  inputPath: string;
  originalSize: number;
  outputPath: string;
}

function buildOutputFileName(baseName: string, format: string): string {
  const name = baseName;

  return `${name}.${format}`;
}

function getOutputPath(
  relativePath: string,
  format: (typeof CONFIG.formats)[number]
): string {
  const { dir, name } = parse(relativePath);
  const outputFileName = buildOutputFileName(name, format.format);

  return join(CONFIG.outputBaseDir, dir, outputFileName);
}

function getCandidateOriginalPaths(relativePath: string): string[] {
  const { dir, name } = parse(relativePath);

  return CONFIG.extensions.map((ext) =>
    join(CONFIG.sourceDir, dir, `${name}.${ext}`)
  );
}

async function shouldSkipProcessing(
  inputPath: string,
  relativePath: string,
  formats: typeof CONFIG.formats
): Promise<boolean> {
  const isMarked = await checkIfFileIsProcessed(inputPath);

  if (!isMarked) {
    return false;
  }

  // Check if all output files exist
  for (const formatConfig of formats) {
    const outputPath = getOutputPath(relativePath, formatConfig);
    const exists = await doesFileExist(outputPath);

    if (!exists) {
      return false;
    }
  }

  // File is marked AND all outputs exist - skip
  return true;
}

async function compressVideo(
  inputPath: string,
  relativePath: string,
  format: (typeof CONFIG.formats)[number]
): Promise<CompressionResult> {
  const outputPath = getOutputPath(relativePath, format);

  await ensureDirectoryExists(outputPath);

  return new Promise((resolve, reject) => {
    const args: string[] = ["-i", inputPath, "-progress", "pipe:2"];

    if (CONFIG.removeAudio) {
      args.push("-an");
    }

    const filters: string[] = [];

    filters.push(
      "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1"
    );

    if (format.scale !== 1.0) {
      // Force dimensions to be divisible by 2 (required by libx264)
      filters.push(
        `scale=trunc(iw*${format.scale}/2)*2:trunc(ih*${format.scale}/2)*2:flags=lanczos`
      );
    }

    if (filters.length > 0) {
      args.push("-vf", filters.join(","));
    }

    args.push("-c:v", format.codec);

    if (format.format === "mp4") {
      args.push(
        "-crf",
        format.quality.toString(),
        "-preset",
        "veryslow",
        "-tune",
        "film",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p"
      );

      if (!CONFIG.removeAudio) {
        args.push("-c:a", "aac", "-b:a", "128k");
      }
    }

    args.push("-y", outputPath);

    const ffmpegProcess = spawn("ffmpeg", args);
    let stderrOutput = "";
    let duration: number | null = null;
    let lastProgressUpdate = 0;

    process.stderr.write(`    → Encoding ${format.format}: Starting...`);

    ffmpegProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      stderrOutput += chunk;

      if (!duration) {
        const durationMatch = chunk.match(
          /Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/
        );

        if (durationMatch) {
          const hours = Number.parseInt(durationMatch[1], 10);
          const minutes = Number.parseInt(durationMatch[2], 10);
          const seconds = Number.parseFloat(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }

      const timeMatch = chunk.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);

      if (timeMatch) {
        const hours = Number.parseInt(timeMatch[1], 10);
        const minutes = Number.parseInt(timeMatch[2], 10);
        const seconds = Number.parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;

        const now = Date.now();

        if (now - lastProgressUpdate > 500) {
          lastProgressUpdate = now;

          let progressStr = `    → Encoding ${format.format}: `;

          if (duration && duration > 0) {
            const progress = Math.min((currentTime / duration) * 100, 100);
            progressStr += `${progress.toFixed(1)}% | `;
          }

          progressStr += `${formatTime(currentTime)}`;

          if (duration) {
            progressStr += ` / ${formatTime(duration)}`;
          }

          process.stderr.write(`\r${progressStr}`);
        }
      }
    });

    ffmpegProcess.on("error", (error) => {
      process.stderr.write("\r\x1b[K");
      reject(new Error(`FFmpeg process error: ${error.message}`));
    });

    ffmpegProcess.on("close", async (code) => {
      process.stderr.write("\r\x1b[K");

      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}\n${stderrOutput}`));

        return;
      }

      try {
        const [inputStats, outputStats] = await Promise.all([
          stat(inputPath),
          stat(outputPath),
        ]);

        resolve({
          inputPath,
          outputPath,
          originalSize: inputStats.size,
          compressedSize: outputStats.size,
          format: format.format,
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

async function cleanupOrphanedFiles(dryRun: boolean): Promise<number> {
  console.log("🧹 Checking for orphaned files in assets directory...\n");

  const outputFiles = await getFilesRecursively(
    CONFIG.outputBaseDir,
    CONFIG.outputBaseDir,
    CONFIG.extensions,
    [CONFIG.sourceDir]
  );

  let deletedCount = 0;

  for (const outputFile of outputFiles) {
    const candidateOriginalPaths = getCandidateOriginalPaths(
      outputFile.relativePath
    );

    let hasOriginal = false;

    for (const originalPath of candidateOriginalPaths) {
      if (await doesFileExist(originalPath)) {
        hasOriginal = true;
        break;
      }
    }

    if (hasOriginal) {
      continue;
    }

    // Only delete files this tool is recorded as having produced — production assets with no raw source must survive.
    const isKnownOutput = await hasProcessedRecordFor(candidateOriginalPaths);

    if (!isKnownOutput) {
      continue;
    }

    if (dryRun) {
      console.log(`  ✗ Would delete orphaned file: ${outputFile.relativePath}`);
    } else {
      console.log(`  ✗ Deleting orphaned file: ${outputFile.relativePath}`);
      await unlink(outputFile.path);

      for (const originalPath of candidateOriginalPaths) {
        await unmarkFileAsProcessed(originalPath);
      }
    }

    deletedCount++;
  }

  if (deletedCount === 0) {
    console.log("  ✓ No orphaned files found\n");
  } else {
    console.log(
      `\n  ${dryRun ? "Would delete" : "Deleted"} ${deletedCount} orphaned file(s)\n`
    );
  }

  return deletedCount;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log(
    `🎬 Starting video compression${dryRun ? " (dry run)" : ""}...\n`
  );

  const files = await getFilesRecursively(
    CONFIG.sourceDir,
    CONFIG.sourceDir,
    CONFIG.extensions
  );

  if (files.length === 0) {
    console.log("No video files found to compress.");
  } else {
    console.log(`Found ${files.length} video(s) to process\n`);
  }

  const results: CompressionResult[] = [];
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const shouldSkip = await shouldSkipProcessing(
      file.path,
      file.relativePath,
      CONFIG.formats
    );

    if (shouldSkip) {
      skipped++;
      continue;
    }

    console.log(`Processing: ${file.relativePath}`);

    if (dryRun) {
      for (const formatConfig of CONFIG.formats) {
        const outputPath = getOutputPath(file.relativePath, formatConfig);
        console.log(`  → Would compress ${formatConfig.format}: ${outputPath}`);
      }

      processed++;
      console.log("");
      continue;
    }

    let hasError = false;

    for (const formatConfig of CONFIG.formats) {
      try {
        const result = await compressVideo(
          file.path,
          file.relativePath,
          formatConfig
        );
        results.push(result);

        const savings = (
          (1 - result.compressedSize / result.originalSize) *
          100
        ).toFixed(1);
        const scaleInfo =
          formatConfig.scale === 1.0 ? "" : ` @${formatConfig.scale}x`;
        console.log(
          `  ✓ ${formatConfig.format} (${formatConfig.codec}${scaleInfo}): ${formatFileSize(result.compressedSize)} (${savings}% savings)`
        );
      } catch (error) {
        console.error(
          `  ✗ Failed to compress as ${formatConfig.format}:`,
          error
        );
        hasError = true;
      }
    }

    if (hasError) {
      failed++;
    } else {
      await markFileAsProcessed(file.path);
    }

    processed++;
    console.log("");
  }

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalCompressed = results.reduce((sum, r) => sum + r.compressedSize, 0);
  const totalSavings =
    totalOriginal > 0
      ? ((1 - totalCompressed / totalOriginal) * 100).toFixed(1)
      : "0.0";

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Compression complete!");
  console.log(`   Processed: ${processed} video(s)`);
  console.log(`   Skipped: ${skipped} video(s)`);
  console.log(`   Failed: ${failed} video(s)`);
  console.log(`   Generated: ${results.length} file(s)`);
  console.log(`   Original size: ${formatFileSize(totalOriginal)}`);
  console.log(`   Compressed size: ${formatFileSize(totalCompressed)}`);
  console.log(`   Total savings: ${totalSavings}%`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await cleanupOrphanedFiles(dryRun);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

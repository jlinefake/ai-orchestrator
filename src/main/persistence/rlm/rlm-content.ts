/**
 * RLM Content Module
 *
 * Content file management (save, load, delete).
 */

import * as path from 'path';
import * as fs from 'fs';
import { INLINE_THRESHOLD } from './rlm-types';

/**
 * Get the content file path for a section.
 * Distributes files across subdirectories to avoid filesystem limits.
 */
export function getContentPath(contentDir: string, sectionId: string): string {
  const prefix = sectionId.substring(0, 2);
  const dir = path.join(contentDir, prefix);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${sectionId}.txt`);
}

/**
 * Save content to a file.
 */
export function saveContent(contentDir: string, sectionId: string, content: string): string {
  const filePath = getContentPath(contentDir, sectionId);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Load content from a file.
 */
export function loadContent(contentDir: string, sectionId: string): string | null {
  const filePath = getContentPath(contentDir, sectionId);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
}

/**
 * Delete content file.
 */
export function deleteContent(contentDir: string, sectionId: string): void {
  const filePath = getContentPath(contentDir, sectionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * Check if content should be stored inline.
 */
export function shouldStoreInline(content: string): boolean {
  return Buffer.byteLength(content, 'utf-8') <= INLINE_THRESHOLD;
}

/**
 * Copy a directory recursively.
 */
export function copyDirectoryRecursive(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get the total size of a directory.
 */
export function getDirectorySize(dirPath: string): number {
  let size = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += getDirectorySize(entryPath);
    } else {
      size += fs.statSync(entryPath).size;
    }
  }

  return size;
}

/**
 * Ensure directories exist.
 */
export function ensureDirectories(dbPath: string, contentDir: string): void {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(contentDir)) {
    fs.mkdirSync(contentDir, { recursive: true });
  }
}

import * as path from 'path';
import { app } from 'electron';

const ALLOWED_ROOTS: string[] = [];

export function initializePathValidator(): void {
  ALLOWED_ROOTS.push(
    app.getPath('userData'),
    app.getPath('temp'),
    process.cwd()
  );
}

export function addAllowedRoot(dir: string): void {
  const resolved = path.resolve(dir);
  if (!ALLOWED_ROOTS.includes(resolved)) {
    ALLOWED_ROOTS.push(resolved);
  }
}

export function validatePath(filePath: string): { valid: boolean; resolved: string; error?: string } {
  const resolved = path.resolve(filePath);

  // Block null bytes (path traversal attack)
  if (filePath.includes('\0')) {
    return { valid: false, resolved, error: 'Path contains null byte' };
  }

  // Check against allowed roots
  const isAllowed = ALLOWED_ROOTS.some(root => resolved.startsWith(root + path.sep) || resolved === root);
  if (!isAllowed && ALLOWED_ROOTS.length > 0) {
    return { valid: false, resolved, error: `Path outside allowed directories: ${resolved}` };
  }

  return { valid: true, resolved };
}

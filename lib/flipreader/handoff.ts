/**
 * Files handed from another part of Pacewise (for example the search bar's upload button) to the flip reader.
 * They live in memory only for the moment between the two screens.
 */
let pending: File[] = [];

export function setPendingFiles(files: File[]): void {
    pending = files;
}

export function takePendingFiles(): File[] {
    const files = pending;
    pending = [];
    return files;
}

export function hasPendingFiles(): boolean {
  return pending.length > 0;
}

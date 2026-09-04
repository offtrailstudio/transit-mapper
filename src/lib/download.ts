/**
 * Triggers a browser download of a Blob under the given filename.
 *
 * Two details that look like ceremony but aren't: the anchor is put in the
 * document before it's clicked (a detached anchor is ignored outright by
 * Firefox), and the object URL is revoked on a later task rather than on the
 * next line. Revoking synchronously after `click()` is a race — the browser may
 * not have started reading the blob yet, and the download silently does nothing.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 30_000);
}

import { toBlob } from "html-to-image";

/**
 * Renders `node` to a PNG and hands it off — via the Web Share sheet (so "download" and
 * "send to someone" are the same tap on a phone) when the browser supports sharing files,
 * falling back to a plain download otherwise (desktop browsers, or a share sheet that
 * exists but won't take files). pixelRatio 2 keeps small grid text legible when the image
 * is viewed at native size rather than shrunk to the screen it was captured from.
 *
 * backgroundColor is passed explicitly because the captured node itself is usually
 * transparent (only the page body sets a background) — without it, dark-mode captures
 * come out with a transparent/black backdrop instead of matching what was on screen.
 */
export async function shareOrDownloadImage(
  node: HTMLElement,
  filename: string,
  backgroundColor: string,
): Promise<void> {
  const blob = await toBlob(node, { pixelRatio: 2, backgroundColor });
  if (!blob) throw new Error("Couldn't generate an image from that view.");

  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

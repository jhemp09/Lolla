import { toBlob } from "html-to-image";

/**
 * Renders `node` to a PNG blob, including whatever's scrolled out of view inside a
 * horizontally-scrollable `.grid-wrap` (the itinerary grid, on a phone screen narrower
 * than the full 4-day-wide layout) — capturing at the node's own on-screen size alone
 * would cut off however many stage columns don't fit without scrolling.
 *
 * html-to-image bakes each element's *current* computed style into the clone, so simply
 * requesting a wider output image doesn't help: a child with overflow-x:auto keeps
 * clipping to its original on-screen width regardless of how wide the canvas around it
 * is. Temporarily switching it to overflow:visible on the live node — right before
 * capture, restored immediately after — lets its full content render unclipped instead,
 * which is what the wider requested width is then actually large enough to fit.
 *
 * That switch has a side effect worth guarding against: the grid's column headers are
 * position:sticky, which needs an ancestor with a non-visible overflow to stick *within*
 * — remove that (as we just did) and the header falls back to sticking to the
 * *viewport* instead, landing wherever the page happens to be scrolled to rather than at
 * the top of the grid. Meaningless for a static image regardless, so headers are forced
 * to position:static for the same brief window, guaranteeing they render in their normal
 * in-flow position no matter where the live page was scrolled when the button was tapped.
 *
 * backgroundColor is passed explicitly because the captured node itself is usually
 * transparent (only the page body sets a background) — without it, dark-mode captures
 * come out with a transparent/black backdrop instead of matching what was on screen.
 * pixelRatio 2 keeps small grid text legible when the image is viewed at native size
 * rather than shrunk to the screen it was captured from.
 */
export async function captureElementAsPng(node: HTMLElement, backgroundColor: string): Promise<Blob> {
  const scrollers = Array.from(node.querySelectorAll<HTMLElement>(".grid-wrap"));
  const stickies = Array.from(node.querySelectorAll<HTMLElement>(".grid-header-cell"));
  const previousOverflow = scrollers.map((el) => el.style.overflow);
  const previousPosition = stickies.map((el) => el.style.position);
  for (const el of scrollers) el.style.overflow = "visible";
  for (const el of stickies) el.style.position = "static";

  try {
    let width = node.scrollWidth;
    for (const el of scrollers) width = Math.max(width, el.scrollWidth);

    const blob = await toBlob(node, { pixelRatio: 2, backgroundColor, width, height: node.scrollHeight });
    if (!blob) throw new Error("Couldn't generate an image from that view.");
    return blob;
  } finally {
    scrollers.forEach((el, i) => {
      el.style.overflow = previousOverflow[i];
    });
    stickies.forEach((el, i) => {
      el.style.position = previousPosition[i];
    });
  }
}

/** Whether the Web Share API can share this blob as a file (mainly phones/tablets — most
 * desktop browsers support navigator.share for links/text but not files). */
export function canShareBlob(blob: Blob, filename: string): boolean {
  if (!navigator.canShare) return false;
  return navigator.canShare({ files: [new File([blob], filename, { type: blob.type })] });
}

export async function shareBlob(blob: Blob, filename: string): Promise<void> {
  await navigator.share({ files: [new File([blob], filename, { type: blob.type })] });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { useState } from "react";
import { captureElementAsPng } from "../lib/exportImage";
import { openImagePreview } from "../state/useImagePreview";

/** Button that renders whatever DOM node `targetRef` points at into a PNG and opens it
 * in a full-screen preview (with Download/Share) — captures a schedule view exactly as
 * it looks on screen at the moment of the tap. */
export function ExportImageButton({
  targetRef,
  filename,
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const node = targetRef.current;
    if (!node) return;
    setBusy(true);
    try {
      // The app's actual background comes from :root (--bg on <html>), not <body> —
      // body itself is transparent, so reading its computed color gives a transparent
      // fill instead of the real page background, and the resulting PNG's "background"
      // ends up genuinely transparent: fine-looking wherever something happens to
      // composite it over white, wrong wherever black (a full-screen photo viewer, or
      // this app's own dark preview backdrop).
      const backgroundColor = getComputedStyle(document.documentElement).backgroundColor;
      const blob = await captureElementAsPng(node, backgroundColor);
      openImagePreview(blob, filename);
    } catch {
      alert("Couldn't create an image of the schedule — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="secondary-btn" onClick={handleClick} disabled={busy}>
      {busy ? "…" : "Share image"}
    </button>
  );
}

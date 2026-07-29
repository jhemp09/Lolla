import { useState } from "react";
import { shareOrDownloadImage } from "../lib/exportImage";

/** Button that renders whatever DOM node `targetRef` points at into a PNG and shares or
 * downloads it — used to capture a schedule view exactly as it looks on screen at the
 * moment of the tap. */
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
      const backgroundColor = getComputedStyle(document.body).backgroundColor;
      await shareOrDownloadImage(node, filename, backgroundColor);
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

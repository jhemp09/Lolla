import { useImagePreview, closeImagePreview } from "../state/useImagePreview";
import { canShareBlob, shareBlob, downloadBlob } from "../lib/exportImage";

/** Full-screen preview of a just-captured schedule image, with Download/Share in the
 * corner — shown instead of jumping straight to the OS share sheet, so there's a chance
 * to actually look at the image first. */
export function ImagePreviewOverlay() {
  const preview = useImagePreview();
  if (!preview) return null;

  const canShare = canShareBlob(preview.blob, preview.filename);

  return (
    <div className="image-preview-overlay">
      <div className="image-preview-actions">
        <button className="image-preview-btn" onClick={() => downloadBlob(preview.blob, preview.filename)}>
          Download
        </button>
        {canShare && (
          <button className="image-preview-btn" onClick={() => shareBlob(preview.blob, preview.filename)}>
            Share
          </button>
        )}
        <button className="image-preview-btn image-preview-close" onClick={closeImagePreview} aria-label="Close">
          ✕
        </button>
      </div>
      <img src={preview.url} alt="Schedule" className="image-preview-img" />
    </div>
  );
}

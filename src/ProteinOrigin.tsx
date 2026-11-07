import { useState } from "react";
import origins from "./data/proteins/origins.json";
import { useChemLanguage } from "./chem-language";
export function ProteinOrigin({
  pdb,
  compact = false,
}: {
  pdb: string;
  compact?: boolean;
}) {
  const { localize } = useChemLanguage();
  const [failed, setFailed] = useState(false);
  const photo = origins[pdb as keyof typeof origins];
  if (!photo) return null;
  return localize(
    <figure
      className={`protein-origin ${compact ? "protein-origin-compact" : ""}`}
    >
      {failed ? (
        <div className="protein-origin-fallback">来源图片暂时不可用</div>
      ) : (
        <img
          src={photo.src}
          alt={photo.caption}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption>
        <span className="protein-origin-label">来源示意</span>
        <p>{photo.caption}</p>
        {!compact && (
          <small>
            <a href={photo.source} target="_blank" rel="noreferrer">
              图片出处 ↗
            </a>{" "}
            · {photo.author} · {photo.license}
            {photo.licenseUrl && (
              <>
                {" "}
                ·{" "}
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                  许可 ↗
                </a>
              </>
            )}
          </small>
        )}
      </figcaption>
    </figure>,
  );
}

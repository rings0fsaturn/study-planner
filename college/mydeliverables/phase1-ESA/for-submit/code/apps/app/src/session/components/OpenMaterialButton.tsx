interface OpenMaterialButtonProps {
  url: string;
}

export function OpenMaterialButton({ url }: OpenMaterialButtonProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn-secondary btn-block session-open-material"
    >
      <svg className="icon" viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      Open material
    </a>
  );
}

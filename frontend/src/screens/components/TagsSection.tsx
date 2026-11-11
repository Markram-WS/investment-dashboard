import React from "react";

interface TagsSectionProps {
  tags: Record<string, boolean> | null;
}

const TagsSection: React.FC<TagsSectionProps> = ({ tags }) => {
  const entries = tags ? Object.keys(tags) : [];
  if (entries.length === 0) return null;
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-hairline)" }}>
      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate)", margin: 0, marginBottom: 12 }}>
        Metadata tags
      </p>
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        {entries.map((tag) => (
          <span
            key={tag}
            className="rounded-full"
            style={{
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--color-ink)",
              background: "var(--color-surface-soft)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TagsSection;

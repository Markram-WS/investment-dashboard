import React from "react";

interface TagsSectionProps {
  tags: Record<string, boolean> | null;
}

const TagsSection: React.FC<TagsSectionProps> = ({ tags }) => {
  const entries = tags ? Object.keys(tags) : [];
  if (entries.length === 0) return null;
  return (
    <div className="mt-6 pt-6 border-t border-hairline">
      <p className="text-[11px] font-bold text-slate mb-3 uppercase tracking-widest">Metadata Tags</p>
      <div className="flex flex-wrap gap-2">
        {entries.map((tag) => (
          <span key={tag} className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-surface text-slate rounded-full border border-hairline">{tag}</span>
        ))}
      </div>
    </div>
  );
};

export default TagsSection;

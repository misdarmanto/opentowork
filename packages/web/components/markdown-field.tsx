"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

/**
 * A GitHub-style Write/Preview toggle over a plain textarea - skill
 * instructions are stored as plain text (schema/skill.ts's `instructions` is
 * just a string appended verbatim into the system prompt), but authors
 * often want to format them with markdown, so this lets them check the
 * rendered result without leaving the field.
 */
export function MarkdownField({
  id,
  value,
  onChange,
  placeholder,
  rows = 6,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [tab, setTab] = useState<"write" | "preview">("write");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={cn(
            "border-b-2 px-2 pb-1.5 text-sm font-medium",
            tab === "write" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
          )}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={cn(
            "border-b-2 px-2 pb-1.5 text-sm font-medium",
            tab === "preview" ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
          )}
        >
          Preview
        </button>
      </div>

      {tab === "write" ? (
        <Textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
      ) : (
        <div
          className="markdown-body rounded-md border border-input px-3 py-2 text-sm"
          style={{ minHeight: `${rows * 1.6}em` }}
        >
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <span className="text-muted-foreground">Nothing to preview yet.</span>
          )}
        </div>
      )}
    </div>
  );
}

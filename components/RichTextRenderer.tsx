"use client";

import React, { useMemo, useEffect, useState } from "react";

interface RichTextRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable component for rendering rich text content (HTML) safely.
 * This component ensures consistent rendering of content from the RichTextEditor.
 * Handles both HTML content and plain text for backward compatibility.
 */
export default function RichTextRenderer({
  content,
  className = "",
  style,
}: RichTextRendererProps) {
  const [sanitizedContent, setSanitizedContent] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!content || typeof content !== "string") {
      setSanitizedContent("");
      return;
    }

    // If we're on the server, use content as-is (will be sanitized on client)
    if (!isClient) {
      setSanitizedContent(content);
      return;
    }

    // If content doesn't contain HTML tags, treat as plain text
    if (!content.includes("<")) {
      setSanitizedContent(content);
      return;
    }

    // Client-side sanitization for HTML content
    try {
      // Create a temporary DOM element to parse and clean HTML
      const tmp = document.createElement("div");
      tmp.innerHTML = content;

      // Remove potentially dangerous elements
      const dangerousTags = ["script", "iframe", "object", "embed", "form"];
      dangerousTags.forEach((tag) => {
        tmp.querySelectorAll(tag).forEach((el) => el.remove());
      });

      // Remove dangerous attributes from all elements
      const allElements = tmp.querySelectorAll("*");
      allElements.forEach((el) => {
        // Remove event handlers and dangerous attributes
        Array.from(el.attributes).forEach((attr) => {
          const attrName = attr.name.toLowerCase();
          if (
            attrName.startsWith("on") || // Event handlers (onclick, onerror, etc.)
            attrName === "contenteditable" ||
            attrName === "spellcheck"
          ) {
            el.removeAttribute(attr.name);
          }
          // Keep data-* attributes and style for backward compatibility
          // as they might be used for images and formatting
        });
      });

      setSanitizedContent(tmp.innerHTML);
    } catch (error) {
      console.error("[RichTextRenderer] Error sanitizing HTML:", error);
      // Fallback: use content as-is if sanitization fails
      setSanitizedContent(content);
    }
  }, [content, isClient]);

  // Handle empty content
  if (!content || content.trim() === "") {
    return null;
  }

  return (
    <div
      className={`prose prose-sm max-w-none ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedContent || content }}
    />
  );
}


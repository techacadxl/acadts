"use client";

import React, { useEffect, useState, useRef } from "react";
import { processLatexInText, initLatexRendering } from "@/lib/utils/latexRenderer";

interface RichTextRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable component for rendering rich text content (HTML) safely.
 * This component ensures consistent rendering of content from the RichTextEditor.
 * Handles both HTML content and plain text for backward compatibility.
 * Also processes and renders LaTeX code (both inline $...$ and block $$...$$).
 */
export default function RichTextRenderer({
  content,
  className = "",
  style,
}: RichTextRendererProps) {
  const [processedContent, setProcessedContent] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
    // Preload KaTeX
    initLatexRendering().catch(console.error);
  }, []);

  useEffect(() => {
    if (!content || typeof content !== "string") {
      setProcessedContent("");
      return;
    }

    // If we're on the server, use content as-is (will be processed on client)
    if (!isClient) {
      setProcessedContent(content);
      return;
    }

    // Process LaTeX and sanitize HTML
    const processContent = async () => {
      setIsProcessing(true);
      try {
        console.log("[RichTextRenderer] Starting processing, content length:", content.length);
        console.log("[RichTextRenderer] Content sample:", content.substring(0, 500));
        
        // Decode HTML entities first (in case content is double-encoded)
        let decodedContent = content;
        if (typeof document !== "undefined") {
          const tempDecode = document.createElement("div");
          tempDecode.innerHTML = content;
          // Get the innerHTML which will have decoded entities
          decodedContent = tempDecode.innerHTML;
          
          // Also manually decode common entities
          decodedContent = decodedContent
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ");
        }
        
        console.log("[RichTextRenderer] After decoding, length:", decodedContent.length);
        console.log("[RichTextRenderer] Decoded sample:", decodedContent.substring(0, 500));
        
        // First, process LaTeX in the decoded content (before HTML sanitization)
        // This ensures LaTeX is processed even if it's inside HTML
        let processed = await processLatexInText(decodedContent);
        
        console.log("[RichTextRenderer] After LaTeX processing, length:", processed.length);
        console.log("[RichTextRenderer] Processed sample:", processed.substring(0, 500));
        console.log("[RichTextRenderer] Contains katex:", processed.includes("katex"));
        
        // Then sanitize HTML content if needed
        if (processed.includes("<")) {
          // Create a temporary DOM element to parse and clean HTML
          const tmp = document.createElement("div");
          tmp.innerHTML = processed;

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
            });
          });

          processed = tmp.innerHTML;
          
          // Process LaTeX again in case any was missed during HTML processing
          processed = await processLatexInText(processed);
        }

        setProcessedContent(processed);
      } catch (error) {
        console.error("[RichTextRenderer] Error processing content:", error);
        // Fallback: use content as-is if processing fails
        setProcessedContent(content);
      } finally {
        setIsProcessing(false);
      }
    };

    processContent();
  }, [content, isClient]);

  // Re-process LaTeX when KaTeX loads (in case it wasn't ready initially)
  useEffect(() => {
    if (!isClient || !processedContent || !containerRef.current) {
      return;
    }

    // Check if KaTeX is loaded and if content has unprocessed LaTeX
    const checkAndReprocess = () => {
      if ((window as any).katex) {
        // Check if there are unprocessed LaTeX markers
        const hasUnprocessedLatex = processedContent.includes("$$") || 
          (processedContent.includes("$") && !processedContent.includes("katex"));
        
        if (hasUnprocessedLatex) {
          // Re-process LaTeX
          processLatexInText(processedContent)
            .then((reprocessed) => {
              if (reprocessed !== processedContent && reprocessed.includes("katex")) {
                setProcessedContent(reprocessed);
              }
            })
            .catch((error) => {
              console.error("[RichTextRenderer] Error re-processing LaTeX:", error);
            });
        }
      } else {
        // KaTeX not loaded yet, wait and retry
        setTimeout(checkAndReprocess, 200);
      }
    };

    // Initial check after a small delay
    const timer = setTimeout(checkAndReprocess, 100);
    return () => clearTimeout(timer);
  }, [isClient, processedContent]);

  // Handle empty content
  if (!content || content.trim() === "") {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`prose prose-sm max-w-none ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: processedContent || content }}
    />
  );
}


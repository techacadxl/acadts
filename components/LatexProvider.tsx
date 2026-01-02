"use client";

import { useEffect } from "react";
import { initLatexRendering } from "@/lib/utils/latexRenderer";

/**
 * Provider component that initializes LaTeX rendering early
 * This ensures KaTeX is loaded and ready when needed
 */
export default function LatexProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Preload KaTeX as soon as the component mounts
    initLatexRendering().catch((error) => {
      console.error("[LatexProvider] Failed to initialize LaTeX:", error);
    });
  }, []);

  return <>{children}</>;
}




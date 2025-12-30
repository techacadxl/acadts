/**
 * Comprehensive LaTeX rendering utility using KaTeX
 * Processes LaTeX code in text and HTML content and converts it to rendered HTML
 */

// Load KaTeX CSS and JS dynamically
let katexLoaded = false;
let katexLoadPromise: Promise<void> | null = null;

function loadKaTeX(): Promise<void> {
  if (katexLoaded) {
    return Promise.resolve();
  }

  if (katexLoadPromise) {
    return katexLoadPromise;
  }

  katexLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    // Check if KaTeX CSS is already loaded
    const existingCSS = document.querySelector('link[href*="katex.min.css"]');
    if (!existingCSS) {
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      cssLink.crossOrigin = "anonymous";
      document.head.appendChild(cssLink);
    }

    // Check if KaTeX JS is already loaded
    if ((window as any).katex) {
      katexLoaded = true;
      resolve();
      return;
    }

    // Load KaTeX JS
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.crossOrigin = "anonymous";
    script.async = false; // Load synchronously to ensure it's ready
    script.onload = () => {
      katexLoaded = true;
      // Wait a bit to ensure KaTeX is fully initialized
      setTimeout(() => resolve(), 100);
    };
    script.onerror = () => {
      console.error("[LaTeX Renderer] Failed to load KaTeX");
      reject(new Error("Failed to load KaTeX"));
    };
    document.head.appendChild(script);
  });

  return katexLoadPromise;
}

/**
 * Renders LaTeX code to HTML using KaTeX
 * @param latex - LaTeX code string
 * @param displayMode - Whether to render in display mode (block) or inline mode
 * @returns HTML string with rendered math
 */
function renderLatex(latex: string, displayMode: boolean = false): string {
  if (typeof window === "undefined") {
    return displayMode
      ? `<div class="latex-placeholder">$$${latex}$$</div>`
      : `<span class="latex-placeholder">$${latex}$</span>`;
  }

  const katex = (window as any).katex;
  if (!katex) {
    console.warn("[LaTeX Renderer] KaTeX not loaded yet");
    return displayMode
      ? `<div class="latex-placeholder" data-latex="${latex.replace(/"/g, '&quot;')}">$$${latex}$$</div>`
      : `<span class="latex-placeholder" data-latex="${latex.replace(/"/g, '&quot;')}">$${latex}$</span>`;
  }

  try {
    const rendered = katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      strict: false,
      trust: true,
    });
    console.log("[LaTeX Renderer] Successfully rendered:", latex.substring(0, 50) + "...");
    return rendered;
  } catch (error) {
    console.error("[LaTeX Renderer] Error rendering LaTeX:", error, latex);
    return displayMode
      ? `<div class="latex-error">$$${latex}$$</div>`
      : `<span class="latex-error">$${latex}$</span>`;
  }
}

/**
 * Processes text content and converts LaTeX code to rendered HTML
 * This function handles both plain text and HTML content
 * 
 * @param content - Text content that may contain LaTeX code
 * @returns Processed HTML with LaTeX rendered
 */
export async function processLatexInText(content: string): Promise<string> {
  if (!content || typeof content !== "string") {
    return content;
  }

  console.log("[processLatexInText] Processing content, length:", content.length);
  console.log("[processLatexInText] Content preview:", content.substring(0, 400));

  // Ensure KaTeX is loaded
  await loadKaTeX();
  
  // Check if KaTeX is actually available
  if (typeof window !== "undefined" && (window as any).katex) {
    console.log("[processLatexInText] ✓ KaTeX is loaded and ready");
  } else {
    console.error("[processLatexInText] ✗ KaTeX is NOT loaded!");
  }

  // ALWAYS process LaTeX first, regardless of HTML
  // This ensures LaTeX is found and processed
  let processed = processPlainTextLatex(content);
  
  console.log("[processLatexInText] After LaTeX processing, has katex:", processed.includes("katex"));
  console.log("[processLatexInText] Processed preview:", processed.substring(0, 400));

  // If content contains HTML, also process HTML structure to handle LaTeX in text nodes
  if (content.includes("<")) {
    processed = processHTMLLatex(processed);
    console.log("[processLatexInText] After HTML processing");
  }

  return processed;
}

/**
 * Processes LaTeX in plain text (no HTML)
 * Supports multiple LaTeX delimiter styles:
 * - Block: $$...$$, \[...\]
 * - Inline: $...$, \(...\)
 */
function processPlainTextLatex(content: string): string {
  // First, decode HTML entities to ensure we're working with actual LaTeX syntax
  let processed = content
    .replace(/&amp;/g, "&") // Decode ampersands FIRST (critical for matrices)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
  
  // Decode HTML entities first (amp; -> &, etc.)
  processed = processed
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  // Process LaTeX environments like \begin{enumerate}...\end{enumerate}
  // These need special handling as they're not in \[...\] blocks
  const envPattern = /\\begin\{([^}]+)\}([\s\S]*?)\\end\{[^}]+\}/g;
  processed = processed.replace(envPattern, (match, envName, envContent) => {
    // Skip if already rendered
    if (match.includes("katex")) {
      return match;
    }
    
    // Clean the environment content
    let cleaned = envContent
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    
    // For enumerate and itemize, render as HTML list
    if (envName === "enumerate" || envName === "itemize") {
      // Extract items - handle \item commands
      const itemPattern = /\\item\s*(.*?)(?=\\item|$)/gs;
      const items: string[] = [];
      let itemMatch;
      while ((itemMatch = itemPattern.exec(cleaned)) !== null) {
        if (itemMatch[1] && itemMatch[1].trim()) {
          items.push(itemMatch[1].trim());
        }
      }
      
      // If no items found with regex, try simple split
      if (items.length === 0) {
        items.push(...cleaned.split(/\\item/).filter(item => item.trim()));
      }
      
      const renderedItems = items.map((item) => {
        const trimmed = item.trim();
        if (trimmed) {
          // Process any LaTeX in the item (but avoid recursion)
          let itemProcessed = trimmed;
          // Process inline LaTeX in items
          itemProcessed = itemProcessed.replace(/\$([^$\n]+?)\$/g, (m, latex) => {
            try {
              return renderLatex(latex.trim(), false);
            } catch (e) {
              return m;
            }
          });
          return itemProcessed;
        }
        return "";
      }).filter(Boolean);
      
      if (renderedItems.length > 0) {
        const tag = envName === "enumerate" ? "ol" : "ul";
        return `<${tag}>${renderedItems.map(item => `<li>${item}</li>`).join("")}</${tag}>`;
      }
    }
    
    // For matrix environments, try to render
    if (envName.includes("matrix") || envName.includes("pmatrix") || envName.includes("vmatrix") || 
        envName.includes("bmatrix") || envName.includes("Bmatrix") || envName.includes("Vmatrix")) {
      try {
        // Reconstruct the full environment for KaTeX
        const fullLatex = `\\begin{${envName}}${cleaned}\\end{${envName}}`;
        return renderLatex(fullLatex, true);
      } catch (e) {
        console.warn("[LaTeX] Failed to render matrix environment:", envName, e);
        return match;
      }
    }
    
    return match;
  });
  
  // Process standalone matrix/determinant patterns that might not be in environments
  // Look for patterns like: | a & b \\ c & d | or ( a & b \\ c & d ) or A = 1 & 2 \\ 3 & 4
  const matrixPatterns = [
    // Determinant pattern: | ... | (vertical bars)
    /\|\s*([^|]+?)\s*\|/g,
    // Matrix pattern in parentheses: ( ... )
    /\(\s*([^()]+?)\s*\)/g,
    // Matrix pattern in square brackets: [ ... ]
    /\[\s*([^\[\]]+?)\s*\]/g,
  ];
  
  for (const pattern of matrixPatterns) {
    processed = processed.replace(pattern, (match, content) => {
      // Skip if already rendered
      if (match.includes("katex") || match.includes("class=\"katex\"")) {
        return match;
      }
      
      // Check if it looks like a matrix (contains & and \\ or multiple &)
      // Also check for HTML-encoded ampersands (amp;)
      const hasAmpersands = content.includes("&") || content.includes("amp;");
      const hasRowBreaks = content.includes("\\\\") || content.includes("\\");
      const multipleAmpersands = (content.match(/&|amp;/g) || []).length >= 2;
      
      if (hasAmpersands && (hasRowBreaks || multipleAmpersands)) {
        try {
          // Determine matrix type based on delimiters
          let envType = "pmatrix"; // default
          if (match.trim().startsWith("|") && match.trim().endsWith("|")) {
            envType = "vmatrix"; // determinant
          } else if (match.trim().startsWith("[") && match.trim().endsWith("]")) {
            envType = "bmatrix"; // square brackets
          }
          
          // Clean the content - decode HTML entities FIRST, then remove HTML tags
          let cleaned = content
            .replace(/&amp;/g, "&") // Decode HTML entities FIRST
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/<[^>]*>/g, " ") // Remove HTML tags AFTER decoding
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
          
          // Ensure proper LaTeX row separation
          cleaned = cleaned.replace(/\\\s*\\/g, " \\\\ "); // Normalize \\ to proper LaTeX
          cleaned = cleaned.replace(/\s*\\\\\s*/g, " \\\\ "); // Ensure proper spacing around \\
          
          // Construct proper LaTeX matrix
          const matrixLatex = `\\begin{${envType}}${cleaned}\\end{${envType}}`;
          const rendered = renderLatex(matrixLatex, true);
          console.log(`[LaTeX] ✓ Rendered standalone ${envType}:`, cleaned.substring(0, 60));
          return rendered;
        } catch (error) {
          console.warn("[LaTeX] ✗ Failed to render matrix pattern:", error);
          return match;
        }
      }
      return match;
    });
  }
  
  // Also handle matrix patterns without delimiters: "1 & 2 \\ 3 & 4" or "A = 1 & 2 \\ 3 & 4"
  // Also handle HTML-encoded: "1 amp; 2 \\\\ 3 amp; 4"
  // This catches matrices written inline without brackets
  const inlineMatrixPattern = /([A-Za-z]+\s*=\s*)?([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:\\\\|\\\\)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?)(?:\s*(?:\\\\|\\\\)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?))?/g;
  processed = processed.replace(inlineMatrixPattern, (match, prefix, ...cells) => {
    // Skip if already rendered or part of LaTeX block
    if (match.includes("katex") || match.includes("\\begin") || match.includes("\\[") || 
        match.includes("class=\"katex\"") || match.includes("|") || match.includes("(") || match.includes("[")) {
      return match;
    }
    
    // Only process if it has the structure of a matrix (multiple rows with &)
    const hasMultipleRows = match.includes("\\\\") || match.includes("\\");
    const validCells = cells.filter(c => c && c.trim() && c.trim().length > 0);
    
    if (hasMultipleRows && validCells.length >= 4) {
      try {
        // Reconstruct as a matrix - group cells into rows
        const rows: string[] = [];
        if (cells[0] && cells[1]) {
          rows.push(`${cells[0].trim()} & ${cells[1].trim()}`);
        }
        if (cells[2] && cells[3]) {
          rows.push(`${cells[2].trim()} & ${cells[3].trim()}`);
        }
        if (cells[4] && cells[5]) {
          rows.push(`${cells[4].trim()} & ${cells[5].trim()}`);
        }
        
        if (rows.length >= 2) {
          const matrixLatex = `\\begin{pmatrix}${rows.join(" \\\\ ")}\\end{pmatrix}`;
          const rendered = renderLatex(matrixLatex, true);
          const prefixText = prefix ? prefix.trim() : "";
          console.log("[LaTeX] ✓ Rendered inline matrix pattern");
          return prefixText ? `${prefixText} ${rendered}` : rendered;
        }
      } catch (error) {
        // Not a valid matrix, return original
        return match;
      }
    }
    return match;
  });
  
  // Handle matrix content that might be in the format: "1 amp; a amp; a^2 \\ 1 amp; b amp; b^2"
  // This handles HTML-encoded ampersands in matrix content
  // Also handle matrices with 3+ columns (like determinants)
  const htmlEncodedMatrixPattern = /([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)?\s*([a-zA-Z0-9\s^_\-\+\.]*?)\s*(?:\\\\|\\\\)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)?\s*([a-zA-Z0-9\s^_\-\+\.]*?)(?:\s*(?:\\\\|\\\\)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)\s*([a-zA-Z0-9\s^_\-\+\.]+?)\s*(?:&|amp;)?\s*([a-zA-Z0-9\s^_\-\+\.]*?))?/g;
  processed = processed.replace(htmlEncodedMatrixPattern, (match, ...cells) => {
    // Skip if already rendered
    if (match.includes("katex") || match.includes("class=\"katex\"")) {
      return match;
    }
    
    // Check if it looks like a matrix (has multiple rows)
    const hasMultipleRows = match.includes("\\\\") || match.includes("\\");
    const validCells = cells.filter(c => c && c.trim() && c.trim().length > 0);
    
    if (hasMultipleRows && validCells.length >= 4) {
      try {
        // Reconstruct as a matrix - handle both 2-column and 3+ column matrices
        const rows: string[] = [];
        
        // First row
        if (cells[0] && cells[1]) {
          const row1 = [cells[0].trim(), cells[1].trim()];
          if (cells[2] && cells[2].trim()) {
            row1.push(cells[2].trim());
          }
          rows.push(row1.join(" & "));
        }
        
        // Second row
        if (cells[3] && cells[4]) {
          const row2 = [cells[3].trim(), cells[4].trim()];
          if (cells[5] && cells[5].trim()) {
            row2.push(cells[5].trim());
          }
          rows.push(row2.join(" & "));
        }
        
        // Third row (if exists)
        if (cells[6] && cells[7]) {
          const row3 = [cells[6].trim(), cells[7].trim()];
          if (cells[8] && cells[8].trim()) {
            row3.push(cells[8].trim());
          }
          rows.push(row3.join(" & "));
        }
        
        if (rows.length >= 2) {
          // Use vmatrix for determinants (3x3 or when context suggests), pmatrix for others
          const isDeterminant = rows.length === 3 || rows[0].split("&").length === 3;
          const envType = isDeterminant ? "vmatrix" : "pmatrix";
          const matrixLatex = `\\begin{${envType}}${rows.join(" \\\\ ")}\\end{${envType}}`;
          const rendered = renderLatex(matrixLatex, true);
          console.log(`[LaTeX] ✓ Rendered HTML-encoded ${envType} (${rows.length}x${rows[0].split("&").length})`);
          return rendered;
        }
      } catch (error) {
        console.warn("[LaTeX] Failed to render HTML-encoded matrix:", error);
        return match;
      }
    }
    return match;
  });
  
  // Also handle raw matrix content that might be split by HTML tags
  // Pattern: content with & or amp; and \\ that forms a matrix structure
  // This is a more aggressive pattern to catch matrices in various formats
  const aggressiveMatrixPattern = /([^\s&|()\[\]{}]+(?:\s*(?:&|amp;)\s*[^\s&|()\[\]{}]+){1,}(?:\s*(?:\\\\|\\\\)\s*[^\s&|()\[\]{}]+(?:\s*(?:&|amp;)\s*[^\s&|()\[\]{}]+){1,}){1,})/g;
  processed = processed.replace(aggressiveMatrixPattern, (match) => {
    // Skip if already rendered or part of LaTeX block
    if (match.includes("katex") || match.includes("\\begin") || match.includes("\\[") || 
        match.includes("class=\"katex\"") || match.length < 10) {
      return match;
    }
    
    // Check if it has matrix structure
    const rows = match.split(/\\\\|\\/).filter(r => r.trim() && r.length > 0);
    if (rows.length >= 2) {
      // Check if rows have consistent column count
      const firstRowCols = (rows[0].match(/(?:&|amp;)/g) || []).length;
      if (firstRowCols >= 1) {
        const allRowsHaveCols = rows.every(row => {
          const rowCols = (row.match(/(?:&|amp;)/g) || []).length;
          return rowCols === firstRowCols || rowCols === firstRowCols - 1; // Allow slight variation
        });
        
        if (allRowsHaveCols) {
          try {
            // Clean and reconstruct
            const cleanedRows = rows.map(row => {
              return row
                .replace(/amp;/g, "&")
                .replace(/<[^>]*>/g, " ")
                .trim();
            });
            
            // Determine matrix type - use vmatrix for 3x3 (likely determinant)
            const isDeterminant = rows.length === 3 && firstRowCols === 2;
            const envType = isDeterminant ? "vmatrix" : "pmatrix";
            const matrixLatex = `\\begin{${envType}}${cleanedRows.join(" \\\\ ")}\\end{${envType}}`;
            const rendered = renderLatex(matrixLatex, true);
            console.log(`[LaTeX] ✓ Rendered aggressive matrix pattern (${rows.length}x${firstRowCols + 1})`);
            return rendered;
          } catch (error) {
            // Not a valid matrix, return original
            return match;
          }
        }
      }
    }
    return match;
  });

  // Process block LaTeX \[...\] (most common in academic writing)
  // Match \[...\] - handle multiline and various whitespace, even across <br> tags
  // Try multiple patterns to catch all variations
  const blockPatterns = [
    /\\\[([\s\S]*?)\\\]/g,  // Standard \[...\]
    /\\?\[([\s\S]*?)\\?\]/g, // With optional backslashes (but only if it looks like LaTeX)
  ];
  
  let totalBlockMatches = 0;
  
  for (const blockPattern of blockPatterns) {
    let blockMatches = 0;
    
    processed = processed.replace(blockPattern, (match, latex, offset) => {
      // Skip if already rendered
      if (match.includes("katex-display") || match.includes("class=\"katex\"") || match.includes("katex")) {
        return match;
      }
      
      // Only process if it looks like LaTeX (contains LaTeX commands or backslashes)
      // Also check for matrix patterns (contains & and \\)
      const hasLatexCommands = /\\[a-zA-Z]+|\\[^a-zA-Z\s]|frac|sqrt|int|sum|lim|vec|hat|begin|end|matrix|pmatrix|vmatrix|enumerate|item|sin|cos|tan|log|ln|pi|alpha|beta|gamma|delta/.test(latex);
      const hasMatrixPattern = (latex.includes("&") || latex.includes("amp;")) && (latex.includes("\\\\") || latex.includes("\\"));
      
      if (!hasLatexCommands && !latex.includes("\\") && !hasMatrixPattern) {
        return match; // Not LaTeX, probably just brackets
      }
      
      blockMatches++;
      totalBlockMatches++;
      
      // Clean up the LaTeX - decode HTML entities FIRST, then remove HTML tags
      let cleaned = latex
        .replace(/&amp;/g, "&") // Decode HTML entities FIRST
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/<[^>]*>/g, " ") // Remove HTML tags AFTER decoding
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
      
      // If it looks like a matrix but isn't in a matrix environment, wrap it
      if (hasMatrixPattern && !cleaned.includes("\\begin{matrix") && !cleaned.includes("\\begin{pmatrix") && !cleaned.includes("\\begin{vmatrix")) {
        // Try to detect if it's a determinant (vertical bars context) or matrix
        const isDeterminant = cleaned.match(/\|/g) || match.includes("determinant") || cleaned.split("\\\\").length === 3;
        const envType = isDeterminant ? "vmatrix" : "pmatrix";
        cleaned = `\\begin{${envType}}${cleaned}\\end{${envType}}`;
        console.log(`[LaTeX] Wrapped matrix in ${envType} environment`);
      }
      
      if (cleaned && cleaned.length > 0) {
        try {
          const rendered = renderLatex(cleaned, true);
          console.log(`[LaTeX] ✓ Rendered block #${totalBlockMatches}`);
          return rendered;
        } catch (error) {
          console.warn(`[LaTeX] ✗ Failed block #${totalBlockMatches}:`, cleaned.substring(0, 50), error);
          return match;
        }
      }
      return match;
    });
    
    if (blockMatches > 0) {
      console.log(`[LaTeX] Pattern found ${blockMatches} block matches`);
    }
  }
  
  if (totalBlockMatches > 0) {
    console.log(`[LaTeX] Total: Processed ${totalBlockMatches} \\[\\] blocks`);
  } else {
    console.warn("[LaTeX] No block LaTeX patterns found in content!");
  }

  // Process block LaTeX $$...$$ 
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex, offset) => {
    // Skip if already rendered
    if (match.includes("katex-display") || match.includes("class=\"katex\"")) {
      return match;
    }
    
    // Skip if it's actually part of a larger $$$ sequence
    const beforeChar = offset > 0 ? processed[offset - 1] : '';
    const afterMatch = offset + match.length < processed.length ? processed[offset + match.length] : '';
    if (beforeChar === '$' || afterMatch === '$') {
      return match;
    }
    
    const trimmed = latex.trim();
    if (trimmed && trimmed.length > 0) {
      try {
        return renderLatex(trimmed, true);
      } catch (error) {
        console.warn("[LaTeX Renderer] Failed to render block LaTeX $$:", trimmed, error);
        return match;
      }
    }
    return match;
  });

  // Process inline LaTeX \(...\)
  processed = processed.replace(/\\\(([^\\]+?)\\\)/g, (match, latex, offset) => {
    // Skip if already rendered
    if (match.includes("class=\"katex\"") || match.includes("katex")) {
      return match;
    }
    
    // Skip if inside HTML tags
    const beforeMatch = processed.substring(0, offset);
    const lastOpenTag = beforeMatch.lastIndexOf("<");
    const lastCloseTag = beforeMatch.lastIndexOf(">");
    if (lastOpenTag > lastCloseTag) {
      return match;
    }
    
    const trimmed = latex.trim();
    if (trimmed && trimmed.length > 0) {
      try {
        return renderLatex(trimmed, false);
      } catch (error) {
        console.warn("[LaTeX Renderer] Failed to render inline LaTeX \\(\\):", trimmed, error);
        return match;
      }
    }
    return match;
  });

  // Process inline LaTeX ($...$)
  processed = processed.replace(/(?<!\$)\$([^$\n\r\\]+?)\$(?!\$)/g, (match, latex, offset) => {
    // Skip if already rendered
    if (match.includes("class=\"katex\"") || match.includes("katex")) {
      return match;
    }
    
    // Skip if inside HTML tags
    const beforeMatch = processed.substring(0, offset);
    const lastOpenTag = beforeMatch.lastIndexOf("<");
    const lastCloseTag = beforeMatch.lastIndexOf(">");
    if (lastOpenTag > lastCloseTag) {
      return match;
    }
    
    // Skip if contains HTML entities or tags
    if (latex.includes("<") || latex.includes(">") || latex.includes("&lt;") || latex.includes("&gt;")) {
      return match;
    }
    
    const trimmed = latex.trim();
    if (trimmed && trimmed.length > 0) {
      try {
        return renderLatex(trimmed, false);
      } catch (error) {
        console.warn("[LaTeX Renderer] Failed to render inline LaTeX $:", trimmed, error);
        return match;
      }
    }
    return match;
  });

  return processed;
}

/**
 * Processes LaTeX in HTML content by walking through text nodes
 */
function processHTMLLatex(html: string): string {
  // First, try to process LaTeX that might span across HTML tags
  // by temporarily removing HTML tags, processing LaTeX, then restoring structure
  let processed = html;
  
  // Extract and temporarily replace LaTeX blocks with placeholders
  const latexBlocks: string[] = [];
  const placeholderPrefix = "___LATEX_BLOCK_";
  
  // Find all \[...\] blocks, even if they contain HTML
  const blockPattern = /\\\[([\s\S]*?)\\\]/g;
  let blockIndex = 0;
  
  processed = processed.replace(blockPattern, (match) => {
    const placeholder = `${placeholderPrefix}${blockIndex}___`;
    // Clean the LaTeX content - remove HTML tags
    const cleaned = match
      .replace(/<[^>]*>/g, " ") // Remove HTML tags
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    
    latexBlocks[blockIndex] = cleaned;
    blockIndex++;
    return placeholder;
  });
  
  // Now process the HTML structure
  if (typeof window !== "undefined" && document) {
    try {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = processed;
      
      // Process all text nodes recursively
      processNodeRecursive(tempDiv);
      
      processed = tempDiv.innerHTML;
    } catch (error) {
      console.error("[LaTeX Renderer] Error processing HTML structure:", error);
    }
  }
  
  // Restore and render LaTeX blocks
  for (let i = 0; i < latexBlocks.length; i++) {
    const placeholder = `${placeholderPrefix}${i}___`;
    const latexContent = latexBlocks[i];
    
    if (latexContent && latexContent.includes("\\[")) {
      // Extract just the LaTeX content
      const match = latexContent.match(/\\\[([\s\S]*?)\\\]/);
      if (match && match[1]) {
        try {
          const rendered = renderLatex(match[1].trim(), true);
          processed = processed.replace(placeholder, rendered);
        } catch (error) {
          console.warn("[LaTeX Renderer] Failed to render extracted block:", error);
          processed = processed.replace(placeholder, latexContent);
        }
      } else {
        processed = processed.replace(placeholder, latexContent);
      }
    } else if (latexContent) {
      try {
        const rendered = renderLatex(latexContent.trim(), true);
        processed = processed.replace(placeholder, rendered);
      } catch (error) {
        processed = processed.replace(placeholder, latexContent);
      }
    }
  }
  
  // Final pass to catch any remaining LaTeX
  processed = processPlainTextLatex(processed);
  
  return processed;
}

/**
 * Recursively processes a DOM node and its children
 */
function processNodeRecursive(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    // Process text node - check for both $ and \[ patterns
    const textContent = node.textContent || "";
    if (textContent && (textContent.includes("$") || textContent.includes("\\["))) {
      const processed = processPlainTextLatex(textContent);
      
      // If LaTeX was found and processed, replace the text node
      if (processed !== textContent && (processed.includes("katex") || processed.includes("class=\"katex\""))) {
        const parent = node.parentNode;
        if (parent) {
          // Create a temporary container to parse the processed HTML
          const tempContainer = document.createElement("div");
          tempContainer.innerHTML = processed;
          
          // Insert all processed nodes before the current text node
          const fragment = document.createDocumentFragment();
          while (tempContainer.firstChild) {
            fragment.appendChild(tempContainer.firstChild);
          }
          
          // Replace the text node with the processed content
          parent.replaceChild(fragment, node);
        }
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    
    // Skip processing inside certain elements (like script, style, code, pre, katex)
    const tagName = element.tagName.toLowerCase();
    if (["script", "style", "code", "pre"].includes(tagName)) {
      return;
    }
    
    // Skip if already contains rendered KaTeX
    if (element.classList.contains("katex") || element.classList.contains("katex-display")) {
      return;
    }
    
    // Process children (create a copy of the array to avoid issues during modification)
    const children = Array.from(node.childNodes);
    children.forEach((child) => {
      processNodeRecursive(child);
    });
  }
}

/**
 * Synchronous version that processes LaTeX if KaTeX is already loaded
 * Falls back to returning content with LaTeX markers if not loaded
 */
export function processLatexInTextSync(content: string): string {
  if (!content || typeof content !== "string") {
    return content;
  }

  if (typeof window === "undefined" || !(window as any).katex) {
    // Return as-is if KaTeX not loaded (will be processed on client)
    return content;
  }

  // Always process LaTeX first
  let processed = processPlainTextLatex(content);

  // If content contains HTML, also process HTML structure
  if (content.includes("<")) {
    processed = processHTMLLatex(processed);
  }

  return processed;
}

/**
 * Initialize LaTeX rendering - call this early to preload KaTeX
 */
export async function initLatexRendering(): Promise<void> {
  if (typeof window !== "undefined") {
    await loadKaTeX();
  }
}

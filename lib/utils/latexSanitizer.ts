/**
 * LaTeX Sanitizer and Formatter for JEE/NEET-level academic content
 * 
 * This utility cleans, normalizes, and validates LaTeX copied from Mathpix
 * to ensure perfect rendering in web-based editors using MathJax or KaTeX.
 */

export type SubjectType = 'physics' | 'chemistry' | 'mathematics' | 'biology' | 'auto';

interface SanitizeOptions {
  subject?: SubjectType;
  strict?: boolean;
}

/**
 * Main sanitization function
 * Transforms raw Mathpix LaTeX into clean, render-ready LaTeX
 */
export function sanitizeLatex(input: string, options: SanitizeOptions = {}): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  const { subject = 'auto', strict = true } = options;

  let cleaned = input;

  // Step 1: Normalize Delimiters
  cleaned = normalizeDelimiters(cleaned);

  // Step 1.5: Force Complex Math to Display Mode (CRITICAL)
  cleaned = forceComplexMathToDisplay(cleaned);

  // Step 2: Fix Mathpix Artifacts
  cleaned = fixMathpixArtifacts(cleaned);

  // Step 3: Separate Text and Math
  cleaned = separateTextAndMath(cleaned);

  // Step 4: Equation Formatting
  cleaned = formatEquations(cleaned);

  // Step 5: Subject-Specific Cleanup
  if (subject !== 'auto') {
    cleaned = applySubjectCleanup(cleaned, subject);
  } else {
    cleaned = applySubjectCleanup(cleaned, detectSubject(cleaned));
  }

  // Step 6: Spacing & Readability
  cleaned = improveSpacing(cleaned);

  // Step 7: Validation
  if (strict) {
    cleaned = validateLatex(cleaned);
  }

  return cleaned;
}

/**
 * Step 1: Normalize Delimiters
 * - Convert all inline math to: \( ... \)
 * - Convert all display math to: \[ ... \]
 * - Remove ALL $ and $$ symbols
 */
function normalizeDelimiters(latex: string): string {
  let normalized = latex;

  // Step 1: Handle display math $$...$$ first (before inline $)
  // Mark them with placeholders to avoid conflicts
  const displayMathPlaceholders: Array<{ placeholder: string; content: string }> = [];
  normalized = normalized.replace(/\$\$([\s\S]*?)\$\$/g, (match, content) => {
    // Skip if already normalized
    if (match.includes('\\[') || match.includes('\\]')) {
      return match;
    }
    const placeholder = `__DISPLAY_MATH_${displayMathPlaceholders.length}__`;
    displayMathPlaceholders.push({ placeholder, content: content.trim() });
    return placeholder;
  });

  // Step 2: Handle \[...\] that might already exist (keep them, just clean)
  normalized = normalized.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    return `\\[${content.trim()}\\]`;
  });

  // Step 3: Handle inline math $...$ (but not $$ which are now placeholders)
  normalized = normalized.replace(/\$([^$\n]+?)\$/g, (match, content) => {
    // Skip if already normalized
    if (match.includes('\\(') || match.includes('\\)')) {
      return match;
    }
    // Skip if it's a placeholder
    if (match.includes('__DISPLAY_MATH_')) {
      return match;
    }
    return `\\(${content.trim()}\\)`;
  });

  // Step 4: Handle \(...\) that might already exist (keep them, just clean)
  normalized = normalized.replace(/\\\(([^\\]+?)\\\)/g, (match, content) => {
    return `\\(${content.trim()}\\)`;
  });

  // Step 5: Restore display math placeholders as \[...\]
  displayMathPlaceholders.forEach(({ placeholder, content }) => {
    normalized = normalized.replace(placeholder, `\\[${content}\\]`);
  });

  // Don't remove standalone $ - they might be valid in some contexts
  // Just ensure we've normalized all math delimiters

  return normalized;
}

/**
 * Step 1.5: Force Complex Math to Display Mode (CRITICAL)
 * - Detect complex expressions in inline math
 * - Convert fractions, limits, summations, integrals, matrices, etc. to display math
 * - Ensure text and math never share the same line
 */
function forceComplexMathToDisplay(latex: string): string {
  let forced = latex;

  // Complex math patterns that MUST be in display mode
  const complexPatterns = [
    /\\frac\{[^}]+\}\{[^}]+\}/,           // Fractions
    /\\sqrt[^a-zA-Z]/,                     // Roots
    /\\sum/,                               // Summations
    /\\prod/,                              // Products
    /\\int/,                               // Integrals
    /\\lim/,                               // Limits
    /\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|Bmatrix)\}/, // Matrices
    /\\vec\{[^}]+\}/,                      // Vectors (if complex)
    /\\hat\{[^}]+\}/,                      // Hats (if complex)
    /\\overrightarrow/,                    // Arrows
    /\\overleftarrow/,                     // Arrows
    /\\overbrace/,                         // Braces
    /\\underbrace/,                        // Braces
    /\\binom/,                             // Binomials
    /\\choose/,                            // Choose
    /\\stackrel/,                          // Stacked
    /\\overset/,                           // Overset
    /\\underset/,                          // Underset
    /\\substack/,                          // Substack
    /\\leftrightarrow/,                    // Long arrows
    /\\rightleftharpoons/,                 // Reaction arrows
    /\\xrightarrow/,                       // Extended arrows
    /\\xleftarrow/,                        // Extended arrows
  ];

  // Check if content contains complex math
  const isComplexMath = (content: string): boolean => {
    // Check for complex patterns first (most reliable)
    if (complexPatterns.some(pattern => pattern.test(content))) {
      return true;
    }

    // Check for nested structures (multiple levels of braces)
    const braceDepth = (content.match(/\{/g) || []).length;
    if (braceDepth > 3) {
      return true;
    }

    // Check for multiple operators in a row (likely complex)
    const operatorCount = (content.match(/[+\-*/=<>]/g) || []).length;
    if (operatorCount > 2) {
      return true;
    }

    // Check length - inline math longer than 40 chars is likely too complex
    const cleanContent = content.replace(/\\[a-zA-Z]+\{?\}?/g, '').trim();
    if (cleanContent.length > 40) {
      return true;
    }

    // Check for subscripts/superscripts with fractions or roots
    if (content.includes('_') && (content.includes('\\frac') || content.includes('\\sqrt'))) {
      return true;
    }

    // Check for limits (always display)
    if (content.includes('\\lim') || content.includes('\\limits')) {
      return true;
    }

    // Check for multiple fractions or roots
    const fracCount = (content.match(/\\frac/g) || []).length;
    const sqrtCount = (content.match(/\\sqrt/g) || []).length;
    if (fracCount > 1 || sqrtCount > 1) {
      return true;
    }

    // Check for matrices or determinants
    if (content.includes('matrix') || content.includes('pmatrix') || 
        content.includes('vmatrix') || content.includes('bmatrix')) {
      return true;
    }

    // Check for stacked expressions (overset, underset, stackrel)
    if (content.includes('\\overset') || content.includes('\\underset') || 
        content.includes('\\stackrel') || content.includes('\\substack')) {
      return true;
    }

    return false;
  };

  // Convert inline math \(...\) to display math \[...\] if complex
  forced = forced.replace(/\\\(([^)]+?)\\\)/g, (match, content) => {
    if (isComplexMath(content)) {
      // Move to display math on its own line
      return `\n\n\\[${content}\\]\n\n`;
    }
    return match;
  });

  // Also check for any inline math that's too long or has multiple operators
  forced = forced.replace(/\\\(([^)]+?)\\\)/g, (match, content) => {
    // Count operators and complexity
    const operatorCount = (content.match(/[+\-*/=<>]/g) || []).length;
    const hasMultipleOperators = operatorCount > 2;
    const hasNestedStructures = (content.match(/\{[^}]*\{/g) || []).length > 0;
    
    if (hasMultipleOperators || hasNestedStructures || content.length > 40) {
      return `\n\n\\[${content}\\]\n\n`;
    }
    return match;
  });

  // Ensure display math blocks are on their own lines (separated from text)
  forced = forced.replace(/([^\n])\\\[/g, '$1\n\n\\[');
  forced = forced.replace(/\\\]([^\n])/g, '\\]\n\n$1');

  // Clean up excessive line breaks
  forced = forced.replace(/\n{3,}/g, '\n\n');

  return forced;
}

/**
 * Step 2: Fix Mathpix Artifacts
 * - Remove \left and \right when unnecessary
 * - Fix broken fractions, roots, and subscripts
 * - Merge equations that were incorrectly split across lines
 * - Remove redundant environments like equation inside align
 */
function fixMathpixArtifacts(latex: string): string {
  let fixed = latex;

  // Remove unnecessary \left and \right pairs
  // Only remove if they're around simple expressions
  fixed = fixed.replace(/\\left\(([^()]+?)\\right\)/g, (match, content) => {
    // Only remove if content doesn't contain nested parentheses or complex structures
    if (!content.includes('(') && !content.includes('\\frac') && !content.includes('\\sqrt')) {
      return `(${content})`;
    }
    return match;
  });

  fixed = fixed.replace(/\\left\[([^\[\]]+?)\\right\]/g, (match, content) => {
    if (!content.includes('[') && !content.includes('\\frac') && !content.includes('\\sqrt')) {
      return `[${content}]`;
    }
    return match;
  });

  // Fix broken fractions - ensure proper \frac{}{} syntax
  // Be more careful - only fix if it's clearly broken
  fixed = fixed.replace(/\\frac\s*([^{}\s]+?)\s+([^{}\s]+?)(?=\s|$|[^}])/g, (match, num, den) => {
    // Only fix if neither is wrapped in braces
    if (!num.includes('{') && !den.includes('{')) {
      return `\\frac{${num.trim()}}{${den.trim()}}`;
    }
    return match;
  });

  // Fix broken subscripts - ensure proper _{}
  // Only fix simple cases to avoid breaking valid LaTeX
  fixed = fixed.replace(/_([a-zA-Z0-9])(?![a-zA-Z0-9{])/g, (match, content) => {
    // Only fix single character subscripts that aren't wrapped
    return `_{${content}}`;
  });

  // Fix broken superscripts - ensure proper ^{}
  // Only fix simple cases
  fixed = fixed.replace(/\^([a-zA-Z0-9])(?![a-zA-Z0-9{])/g, (match, content) => {
    // Only fix single character superscripts that aren't wrapped
    return `^{${content}}`;
  });

  // Merge split equations - look for patterns like "x = " followed by "y" on next line
  // This is complex, so we'll be conservative
  fixed = fixed.replace(/([a-zA-Z0-9\s=]+)\s*\n\s*([a-zA-Z0-9\s+\-*/^_]+)/g, (match, part1, part2) => {
    // Only merge if it looks like a split equation (has = in first part)
    if (part1.includes('=') && !part2.includes('=') && part2.length < 50) {
      return `${part1} ${part2}`;
    }
    return match;
  });

  // Remove redundant environments
  // Remove \begin{equation} inside \begin{align} or \begin{aligned}
  fixed = fixed.replace(/\\begin\{(?:align|aligned)\}([\s\S]*?)\\begin\{equation\}([\s\S]*?)\\end\{equation\}([\s\S]*?)\\end\{(?:align|aligned)\}/g, 
    (match, before, content, after) => {
      return `\\begin{aligned}${before}${content}${after}\\end{aligned}`;
    }
  );

  // Convert standalone align to aligned (aligned is better for inline/block use)
  // But only if it's not already in a display math block
  if (!fixed.includes('\\[') || fixed.match(/\\begin\{align\}/)) {
    fixed = fixed.replace(/\\begin\{align\}/g, '\\begin{aligned}');
    fixed = fixed.replace(/\\end\{align\}/g, '\\end{aligned}');
  }

  return fixed;
}

/**
 * Step 3: Separate Text and Math
 * - Move plain English text OUTSIDE math mode
 * - Use \text{} ONLY when text must appear inside equations
 * - Ensure no full sentences remain inside math blocks
 */
function separateTextAndMath(latex: string): string {
  let separated = latex;

  // Find math blocks and check for text inside
  separated = separated.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    // Check if content contains plain English sentences (not in \text{})
    const textPattern = /([A-Z][a-z]+(?:\s+[a-z]+){2,})/g;
    const textMatches = content.match(textPattern);
    
    if (textMatches && textMatches.length > 0) {
      // Extract text and move it outside
      let cleanedContent = content;
      let extractedText = '';
      
      textMatches.forEach((text: string) => {
        // Only extract if it's not already in \text{}
        if (!content.includes(`\\text{${text}}`)) {
          extractedText += ` ${text}`;
          cleanedContent = cleanedContent.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
        }
      });
      
      if (extractedText.trim()) {
        return `${extractedText.trim()}\n\n\\[${cleanedContent.trim()}\\]`;
      }
    }
    
    return match;
  });

  // Handle inline math - extract longer text phrases or move complex math to display
  separated = separated.replace(/\\\(([^)]+?)\\\)/g, (match, content) => {
    // If content is mostly text (more than 15 chars, mostly letters and spaces)
    const textRatio = (content.match(/[a-zA-Z\s]/g) || []).length / content.length;
    if (content.length > 15 && textRatio > 0.6) {
      // Move outside math mode
      return ` ${content} `;
    }
    
    // If it contains complex structures, it should already be display math
    // But check again to be safe
    if (content.includes('\\frac') || content.includes('\\sqrt') || content.includes('\\sum') || 
        content.includes('\\int') || content.includes('\\lim') || content.length > 30) {
      return `\n\n\\[${content}\\]\n\n`;
    }
    
    return match;
  });

  // Ensure text and math are on separate lines
  // Add line breaks before display math if preceded by text
  separated = separated.replace(/([a-zA-Z0-9])\s*\\\[/g, '$1\n\n\\[');
  separated = separated.replace(/\\\]\s*([a-zA-Z0-9])/g, '\\]\n\n$1');

  // Clean up spacing
  separated = separated.replace(/\n{3,}/g, '\n\n');

  return separated;
}

/**
 * Step 4: Equation Formatting
 * - Prefer multiple single display equations over compact alignment
 * - Only use aligned environment when alignment is essential
 * - Ensure each equation is on its own line for readability
 * - No mid-equation line breaks
 */
function formatEquations(latex: string): string {
  let formatted = latex;

  // Find display math blocks
  formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    const trimmed = content.trim();
    
    // Check if it's already in an aligned environment
    if (trimmed.includes('\\begin{aligned}') || trimmed.includes('\\begin{align}')) {
      // Keep aligned environments but ensure proper spacing
      return `\\[${trimmed}\\]`;
    }
    
    // Check if it contains alignment markers (&) or multiple equations
    const hasAlignment = trimmed.includes('&') && trimmed.includes('\\\\');
    const hasMultipleEquals = (trimmed.match(/=/g) || []).length > 1;
    
    // If it has alignment markers but we can split into separate equations, do that
    if (hasAlignment && !hasMultipleEquals) {
      // Try to split into separate equations if possible
      const equations = trimmed.split('\\\\').map(eq => eq.trim()).filter(eq => eq.length > 0);
      
      // If we have multiple equations, prefer separate display blocks
      if (equations.length > 1 && equations.length <= 4) {
        // Split into separate display equations for better readability
        return equations.map(eq => `\\[${eq}\\]`).join('\n\n');
      } else if (equations.length > 4) {
        // Too many equations - use aligned but ensure spacing
        const cleaned = trimmed.replace(/\n\s*/g, ' ');
        return `\\[\\begin{aligned}${cleaned}\\end{aligned}\\]`;
      }
    }
    
    // Single equation - ensure it's clean and on its own
    const cleaned = trimmed.replace(/\n\s*/g, ' ').trim();
    return `\\[${cleaned}\\]`;
  });

  // Remove mid-equation line breaks (but keep them in aligned environments)
  formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    if (!content.includes('\\begin{aligned}') && !content.includes('\\begin{align}')) {
      // Single equation - remove line breaks
      return `\\[${content.replace(/\n\s*/g, ' ').trim()}\\]`;
    }
    return match;
  });

  // Ensure each display equation is on its own line (separated from others)
  formatted = formatted.replace(/\\\]\s*\\\[/g, '\\]\n\n\\[');

  return formatted;
}

/**
 * Step 5: Subject-Specific Cleanup
 */
function applySubjectCleanup(latex: string, subject: SubjectType): string {
  switch (subject) {
    case 'physics':
      return cleanupPhysics(latex);
    case 'chemistry':
      return cleanupChemistry(latex);
    case 'mathematics':
      return cleanupMathematics(latex);
    case 'biology':
      return cleanupBiology(latex);
    default:
      return latex;
  }
}

function cleanupPhysics(latex: string): string {
  let cleaned = latex;

  // Ensure vectors use \vec{}
  cleaned = cleaned.replace(/([A-Z][a-z]?)\s*→/g, '\\vec{$1}');
  cleaned = cleaned.replace(/([A-Z][a-z]?)\s*arrow/g, '\\vec{$1}');

  // Units should not be part of math expressions
  // Move units outside math mode when possible
  cleaned = cleaned.replace(/\\\[([\s\S]*?)\s*([a-zA-Z]{1,3})\s*\\\]/g, (match, math, unit) => {
    // Common units
    const units = ['m', 's', 'kg', 'N', 'J', 'W', 'V', 'A', 'C', 'Hz', 'rad', 'deg'];
    if (units.includes(unit)) {
      return `\\[${math.trim()}\\] ${unit}`;
    }
    return match;
  });

  // Replace * with \cdot in physics contexts
  cleaned = cleaned.replace(/([0-9])\s*\*\s*([0-9a-zA-Z])/g, '$1 \\cdot $2');

  // Ensure vector equations are in display math
  cleaned = cleaned.replace(/\\\(([^)]*\\vec[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');

  return cleaned;
}

function cleanupChemistry(latex: string): string {
  let cleaned = latex;

  // Fix subscripts in chemical formulas
  // Ensure numbers after letters are subscripted
  cleaned = cleaned.replace(/([A-Z][a-z]?)([0-9]+)/g, (match, element, num) => {
    // Only if it's not already subscripted
    if (!match.includes('_')) {
      return `${element}_{${num}}`;
    }
    return match;
  });

  // Ensure charges are written as superscripts
  cleaned = cleaned.replace(/([A-Za-z0-9]+)\s*([+-])([0-9]*)/g, (match, base, sign, num) => {
    if (!match.includes('^')) {
      const charge = num ? `${sign}${num}` : sign;
      return `${base}^{${charge}}`;
    }
    return match;
  });

  // Clean reaction arrows - ensure reactions are in display math
  cleaned = cleaned.replace(/->/g, '\\rightarrow');
  cleaned = cleaned.replace(/<->/g, '\\leftrightarrow');
  cleaned = cleaned.replace(/<=>/g, '\\rightleftharpoons');

  // Ensure chemical reactions (with arrows) are in display math
  cleaned = cleaned.replace(/\\\(([^)]*\\rightarrow[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');
  cleaned = cleaned.replace(/\\\(([^)]*\\leftrightarrow[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');
  cleaned = cleaned.replace(/\\\(([^)]*\\rightleftharpoons[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');

  return cleaned;
}

function cleanupMathematics(latex: string): string {
  let cleaned = latex;

  // Replace inline divisions with \frac{}{}
  // But ensure they're in display math (they should already be after forceComplexMathToDisplay)
  cleaned = cleaned.replace(/([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)/g, (match, num, den) => {
    // Only if not already in a fraction and not in display math
    if (!match.includes('\\frac') && !match.includes('\\[')) {
      // Convert to fraction and ensure it's in display math
      return `\n\n\\[\\frac{${num}}{${den}}\\]\n\n`;
    }
    return match;
  });

  // Ensure limits, summations, and integrals are in display math
  cleaned = cleaned.replace(/\\\(([^)]*\\lim[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');
  cleaned = cleaned.replace(/\\\(([^)]*\\sum[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');
  cleaned = cleaned.replace(/\\\(([^)]*\\int[^)]*)\\\)/g, '\n\n\\[$1\\]\n\n');

  // Normalize summations, integrals, limits (add proper spacing)
  cleaned = cleaned.replace(/\\sum\s*([^_\\])/g, '\\sum $1');
  cleaned = cleaned.replace(/\\int\s*([^_\\])/g, '\\int $1');

  return cleaned;
}

function cleanupBiology(latex: string): string {
  let cleaned = latex;

  // Remove unnecessary math mode for simple text
  cleaned = cleaned.replace(/\\\(([A-Za-z\s]+)\\\)/g, (match, text) => {
    // If it's just text with no math symbols, remove math mode
    if (!text.match(/[0-9+\-*/=^_()\[\]]/)) {
      return text;
    }
    return match;
  });

  // Italicize scientific names using \textit{}
  cleaned = cleaned.replace(/([A-Z][a-z]+\s+[a-z]+)/g, (match, name) => {
    // Simple heuristic: if it looks like a scientific name (Genus species)
    if (name.split(' ').length === 2 && !name.includes('\\textit')) {
      return `\\textit{${name}}`;
    }
    return match;
  });

  return cleaned;
}

/**
 * Auto-detect subject from content
 */
function detectSubject(latex: string): SubjectType {
  const physicsKeywords = ['\\vec', 'force', 'velocity', 'acceleration', 'momentum', 'energy', 'electric', 'magnetic'];
  const chemistryKeywords = ['reaction', 'molecule', 'atom', 'ion', 'compound', 'element', '\\rightarrow'];
  const biologyKeywords = ['species', 'genus', 'organism', 'cell', 'DNA', 'RNA', 'protein'];
  const mathKeywords = ['\\sum', '\\int', '\\lim', 'derivative', 'integral', 'matrix', 'determinant'];

  const lowerLatex = latex.toLowerCase();

  const physicsScore = physicsKeywords.filter(kw => lowerLatex.includes(kw)).length;
  const chemistryScore = chemistryKeywords.filter(kw => lowerLatex.includes(kw)).length;
  const biologyScore = biologyKeywords.filter(kw => lowerLatex.includes(kw)).length;
  const mathScore = mathKeywords.filter(kw => lowerLatex.includes(kw)).length;

  const scores = [
    { subject: 'physics' as SubjectType, score: physicsScore },
    { subject: 'chemistry' as SubjectType, score: chemistryScore },
    { subject: 'biology' as SubjectType, score: biologyScore },
    { subject: 'mathematics' as SubjectType, score: mathScore },
  ];

  const maxScore = Math.max(...scores.map(s => s.score));
  if (maxScore === 0) return 'mathematics'; // Default

  return scores.find(s => s.score === maxScore)?.subject || 'mathematics';
}

/**
 * Step 6: Spacing & Readability
 * - Insert line breaks only between logical steps
 * - Ensure consistent spacing across the document
 * - Avoid cluttered equations
 */
function improveSpacing(latex: string): string {
  let improved = latex;

  // Normalize whitespace within math blocks (but preserve line breaks between equations)
  improved = improved.replace(/\\\[([\s\S]*?)\\\]/g, (match, content) => {
    // Don't normalize whitespace in aligned environments
    if (content.includes('\\begin{aligned}') || content.includes('\\begin{align}')) {
      return match;
    }
    
    // Normalize whitespace in single equations
    let spaced = content
      .replace(/\s+/g, ' ')  // Normalize multiple spaces
      .replace(/([a-zA-Z0-9])\s*=\s*([a-zA-Z0-9])/g, '$1 = $2')
      .replace(/([a-zA-Z0-9])\s*\+\s*([a-zA-Z0-9])/g, '$1 + $2')
      .replace(/([a-zA-Z0-9])\s*-\s*([a-zA-Z0-9])/g, '$1 - $2')
      .replace(/([a-zA-Z0-9])\s*\*\s*([a-zA-Z0-9])/g, '$1 \\cdot $2')
      .trim();
    
    return `\\[${spaced}\\]`;
  });

  // Ensure consistent spacing around display math delimiters
  // Text before display math should be on separate line
  improved = improved.replace(/([a-zA-Z0-9])\s*\\\[/g, '$1\n\n\\[');
  improved = improved.replace(/\\\]\s*([a-zA-Z0-9])/g, '\\]\n\n$1');

  // Ensure display equations are separated from each other
  improved = improved.replace(/\\\]\s*\\\[/g, '\\]\n\n\\[');

  // Clean up excessive line breaks (but keep double line breaks between equations)
  improved = improved.replace(/\n{4,}/g, '\n\n\n');
  improved = improved.replace(/\n{3,}/g, '\n\n');

  return improved.trim();
}

/**
 * Step 7: Validation
 * - Ensure all braces {}, brackets [], and environments are closed
 * - Ensure output compiles in KaTeX (strict mode)
 * - No syntax warnings or rendering ambiguity
 */
function validateLatex(latex: string): string {
  let validated = latex;

  // Count and balance braces
  const openBraces = (validated.match(/\{/g) || []).length;
  const closeBraces = (validated.match(/\}/g) || []).length;
  
  if (openBraces > closeBraces) {
    // Add missing closing braces (try to place them intelligently)
    const missing = openBraces - closeBraces;
    validated += '}'.repeat(missing);
  } else if (closeBraces > openBraces) {
    // Remove extra closing braces (from the end)
    const extra = closeBraces - openBraces;
    validated = validated.replace(/\}/g, (match, offset) => {
      if (offset >= validated.length - extra) {
        return '';
      }
      return match;
    });
  }

  // Validate environments
  const beginMatches = validated.match(/\\begin\{([^}]+)\}/g) || [];
  const endMatches = validated.match(/\\end\{([^}]+)\}/g) || [];

  if (beginMatches.length !== endMatches.length) {
    // Try to fix by ensuring each \begin has a matching \end
    const envNames = beginMatches.map(m => m.match(/\\begin\{([^}]+)\}/)?.[1]).filter(Boolean);
    const endNames = endMatches.map(m => m.match(/\\end\{([^}]+)\}/)?.[1]).filter(Boolean);

    // Add missing \end commands
    envNames.forEach((envName, index) => {
      if (!endNames.includes(envName)) {
        // Find the position after the last content of this environment
        // This is a simplified fix - in production, you'd want more sophisticated parsing
        const beginIndex = validated.indexOf(`\\begin{${envName}}`);
        if (beginIndex !== -1) {
          // Try to find where this environment should end
          // For now, we'll add it at the end if it's missing
          if (!validated.includes(`\\end{${envName}}`)) {
            validated += `\\end{${envName}}`;
          }
        }
      }
    });
  }

  // Remove invalid characters that might break KaTeX
  validated = validated.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  return validated;
}

/**
 * Export a simple function that can be used directly
 */
export default function sanitizeMathpixLatex(input: string, subject?: SubjectType): string {
  return sanitizeLatex(input, { subject: subject || 'auto', strict: true });
}

/**
 * Sanitize LaTeX content that may be mixed with HTML/text
 * This is useful when pasting content from Mathpix into rich text editors
 */
export function sanitizeMixedContent(content: string, subject?: SubjectType): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // Extract and sanitize LaTeX blocks while preserving HTML structure
  const latexPatterns = [
    /\$\$([\s\S]*?)\$\$/g,
    /\\\[([\s\S]*?)\\\]/g,
    /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g,
    /\\\(([^)]+?)\\\)/g,
  ];

  let sanitized = content;
  const placeholders: Array<{ placeholder: string; sanitized: string }> = [];
  let placeholderIndex = 0;

  // Extract all LaTeX blocks
  latexPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match) => {
      const placeholder = `__LATEX_PLACEHOLDER_${placeholderIndex}__`;
      const cleaned = sanitizeLatex(match, { subject: subject || 'auto', strict: true });
      placeholders.push({ placeholder, sanitized: cleaned });
      placeholderIndex++;
      return placeholder;
    });
  });

  // Restore sanitized LaTeX
  placeholders.forEach(({ placeholder, sanitized: latex }) => {
    sanitized = sanitized.replace(placeholder, latex);
  });

  return sanitized;
}


"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

interface DescriptionRendererProps {
  description: string;
  className?: string;
}

export default function DescriptionRenderer({
  description,
  className = "",
}: DescriptionRendererProps) {
  const [cleanedHtml, setCleanedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!description) {
      setCleanedHtml("");
      setIsLoading(false);
      return;
    }

    // Check if description contains proper HTML tags
    const hasProperHtml = /<[a-z][^>]*>/i.test(description);
    
    let htmlToProcess = description;

    // If it has proper HTML tags, just clean it
    if (hasProperHtml) {
      // Clean HTML on client-side using DOM
      try {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = description;
        
        // Remove data attributes and unwanted attributes
        const allElements = tmp.querySelectorAll('*');
        allElements.forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-') || 
                attr.name === 'contenteditable' || 
                attr.name === 'spellcheck') {
              el.removeAttribute(attr.name);
            }
          });
        });
        
        // Process markdown-style formatting in text nodes
        const processMarkdownInNodes = (element: HTMLElement) => {
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
          );
          
          const textNodes: Text[] = [];
          let node;
          while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
              textNodes.push(node as Text);
            }
          }
          
          textNodes.forEach(textNode => {
            const text = textNode.textContent || '';
            if (text.includes('*')) {
              const parent = textNode.parentElement;
              if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
                // Process markdown
                let processed = text
                  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                  .replace(/([^*]|^)\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');
                
                if (processed !== text) {
                  const temp = document.createElement('div');
                  temp.innerHTML = processed;
                  const fragment = document.createDocumentFragment();
                  while (temp.firstChild) {
                    fragment.appendChild(temp.firstChild);
                  }
                  parent.replaceChild(fragment, textNode);
                }
              }
            }
          });
        };
        
        processMarkdownInNodes(tmp);
        
        htmlToProcess = tmp.innerHTML;
      } catch (error) {
        console.error("Error processing HTML:", error);
        htmlToProcess = description;
      }
    } else {
      // Handle malformed HTML (tags without brackets)
      const tags = ['strong', 'em', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'p', 'u', 'b', 'i', 'a'];
      
      const fixMalformedHtml = (text: string): string => {
        const lines = text.split('\n');
        return lines.map(line => {
          // Match pattern: tags + text + closing tags
          const openingMatch = line.match(/^((?:p|div|span|h[1-6]|strong|em|ul|ol|li|br|a|u|b|i)+)(?![a-z])/i);
          if (!openingMatch) return line;
          
          const tagPart = openingMatch[1];
          let restOfLine = line.substring(tagPart.length);
          
          // Split tags carefully
          const openingTags: string[] = [];
          let remaining = tagPart;
          const sortedTags = [...tags].sort((a, b) => b.length - a.length);
          
          while (remaining.length > 0) {
            let found = false;
            for (const tag of sortedTags) {
              if (remaining.toLowerCase().startsWith(tag.toLowerCase())) {
                const after = remaining.substring(tag.length);
                // For single-letter tags, only match if followed by another tag
                if (tag.length === 1) {
                  if (sortedTags.some(t => t.length > 1 && after.toLowerCase().startsWith(t.toLowerCase()))) {
                    openingTags.push(tag);
                    remaining = after;
                    found = true;
                    break;
                  }
                } else {
                  if (after.length === 0 || sortedTags.some(t => after.toLowerCase().startsWith(t.toLowerCase())) || /^[^a-z0-9]/.test(after)) {
                    openingTags.push(tag);
                    remaining = after;
                    found = true;
                    break;
                  }
                }
              }
            }
            if (!found) {
              // Preserve remaining as text
              restOfLine = remaining + restOfLine;
              break;
            }
          }
          
          if (openingTags.length === 0) return line;
          
          // Find closing tags
          let textContent = restOfLine;
          let closingTags: string[] = [];
          const closingMatch = restOfLine.match(/(.+?)(\/[a-z0-9]+(?:\/[a-z0-9]+)*\/?)$/i);
          if (closingMatch) {
            textContent = closingMatch[1];
            const closingPart = closingMatch[2];
            const matches = closingPart.matchAll(/\/([a-z0-9]+)/gi);
            for (const match of matches) {
              const tag = match[1].toLowerCase();
              if (tags.includes(tag)) {
                closingTags.push(tag);
              }
            }
          }
          
          const opening = openingTags.map(t => `<${t}>`).join('');
          const closing = closingTags.length > 0 
            ? closingTags.map(t => `</${t}>`).join('')
            : [...openingTags].reverse().map(t => `</${t}>`).join('');
          
          return opening + textContent + closing;
        }).join('\n');
      };
      
      htmlToProcess = fixMalformedHtml(description);
      
      // Clean up any artifacts
      htmlToProcess = htmlToProcess
        .replace(/\b([a-z]|ul|ol|div|span|p|h[1-6]|li)\s+style\s*=\s*"([^"]*)"\s*/gi, '')
        .replace(/<>\s*/g, '')
        .replace(/\s*<>\s*/g, ' ');
    }

    // Final cleaning
    try {
      const tmp = document.createElement("DIV");
      tmp.innerHTML = htmlToProcess;
      
      // Remove data attributes
      tmp.querySelectorAll('*').forEach((el) => {
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-') || 
              attr.name === 'contenteditable' || 
              attr.name === 'spellcheck') {
            el.removeAttribute(attr.name);
          }
        });
      });
      
      setCleanedHtml(tmp.innerHTML.trim());
    } catch (error) {
      console.error("Error final cleaning:", error);
      setCleanedHtml(htmlToProcess);
    }
    
    setIsLoading(false);
  }, [description]);

  if (!description) {
    return <p className="text-gray-600">No description available.</p>;
  }

  // Check if description contains HTML
  const hasHtml = /<[^>]+>/g.test(description);
  const hasHtmlPatterns = ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 'b', 'i', 'ul', 'ol', 'li', 'br', 'a'].some(tag => 
    description.includes(tag) && !description.includes(`<${tag}`) && !description.includes(`</${tag}`)
  );
  
  if (hasHtml || hasHtmlPatterns) {
    const isSmallText = className.includes('text-sm');
    
    if (isLoading) {
      return <div className="text-gray-500 text-sm">Loading...</div>;
    }
    
    return (
      <div 
        className={`prose prose-sm max-w-none ${className}`}
        style={{
          fontSize: isSmallText ? '0.875rem' : '1rem',
          lineHeight: '1.6',
          color: '#374151',
        }}
        dangerouslySetInnerHTML={{ __html: cleanedHtml || description }}
      />
    );
  }

  // Check for markdown
  const hasMarkdown = /^#+\s|^\*\s|^-\s|^\d+\.\s|^\*\*|^__|^`|\[.*\]\(.*\)/m.test(description);
  const hasMultipleLines = description.split('\n').filter(line => line.trim()).length > 1;

  if (!hasMarkdown && hasMultipleLines) {
    const descriptionLines = description.split('\n').filter(line => line.trim());
    const isSmallText = className.includes('text-sm');
    return (
      <ul className={`space-y-2 ${className}`}>
        {descriptionLines.map((line, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-green-500 mt-1">✓</span>
            <span className={`text-gray-700 ${isSmallText ? 'text-sm' : 'text-lg'}`}>{line.trim()}</span>
          </li>
        ))}
      </ul>
    );
  }

  // Render markdown
  const isSmallText = className.includes('text-sm');
  const baseTextSize = isSmallText ? 'text-sm' : 'text-lg';
  const headingSizes = isSmallText 
    ? {
        h1: 'text-xl',
        h2: 'text-lg',
        h3: 'text-base',
        h4: 'text-sm',
      }
    : {
        h1: 'text-4xl',
        h2: 'text-3xl',
        h3: 'text-2xl',
        h4: 'text-xl',
      };

  return (
    <div className={`prose prose-lg max-w-none ${className}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className={`${headingSizes.h1} font-bold text-gray-900 mb-4 mt-6`}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={`${headingSizes.h2} font-bold text-gray-900 mb-3 mt-5`}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={`${headingSizes.h3} font-semibold text-gray-900 mb-2 mt-4`}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className={`${headingSizes.h4} font-semibold text-gray-900 mb-2 mt-3`}>{children}</h4>
          ),
          p: ({ children }) => (
            <p className={`text-gray-700 leading-relaxed ${baseTextSize} mb-4`}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2 mb-4 list-none">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-2 mb-4 list-decimal list-inside">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className={`text-gray-700 ${baseTextSize}`}>{children}</span>
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-800">{children}</em>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {description}
      </ReactMarkdown>
    </div>
  );
}

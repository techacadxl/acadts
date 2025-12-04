"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import {
  uploadImage,
  validateImageFile,
  getImageStorageConfig,
} from "@/lib/utils/imageStorage";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  disabled?: boolean;
  imageFolder?: string; // Optional folder path for organizing images
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  className = "",
  minHeight = "400px",
  disabled = false,
  imageFolder,
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Custom image upload handler for TinyMCE
  const handleImageUpload = useCallback(
    async (blobInfo: any, progress: (percent: number) => void) => {
      if (disabled) {
        throw new Error("Editor is disabled");
      }

      try {
        setIsUploading(true);
        progress(0);

        // Convert blob to File
        const file = new File([blobInfo.blob()], blobInfo.filename(), {
          type: blobInfo.blob().type,
        });

        // Validate file
      const validation = validateImageFile(file);
      if (!validation.isValid) {
          throw new Error(validation.error || "Invalid image file");
      }

        progress(50);

        // Upload image
        const config = getImageStorageConfig();
        if (imageFolder) {
          config.folder = imageFolder;
        }

        const uploadResult = await uploadImage(file, config);
        progress(100);

        return uploadResult.url;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Failed to upload image";
        console.error("[RichTextEditor] Image upload error:", error);
        throw new Error(msg);
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, imageFolder]
  );

  // Load KaTeX CSS for math rendering
  useEffect(() => {
    if (typeof window !== "undefined") {
      const existingLink = document.querySelector('link[href*="katex.min.css"]');
      if (!existingLink) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
        link.crossOrigin = "anonymous";
        document.head.appendChild(link);
      }
    }
  }, []);

  if (!isMounted) {
    return (
      <div
        className={`border border-gray-300 rounded p-4 bg-gray-50 ${className}`}
        style={{ minHeight }}
      >
        <div className="flex items-center justify-center text-gray-500">
          Loading editor...
        </div>
      </div>
    );
  }

    return (
    <div className={`rich-text-editor ${className} border border-gray-300 rounded-lg overflow-hidden shadow-sm`}>
      {/* Helpful hint - only show when editor is enabled */}
      {!disabled && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-xs text-blue-700">
          💡 <strong>Tips:</strong> 
          <span className="ml-2">• Drag and drop images directly into the editor</span>
          <span className="ml-2">• Click an image and use alignment buttons (⬅ ⬌ ➡) to position it</span>
          <span className="ml-2">• Use <strong>Ω</strong> button for Greek letters (α, β, γ, λ, etc.) and math symbols</span>
          <span className="ml-2">• Double-click images to resize and adjust properties</span>
          <span className="ml-2">• Drag the editor corner to resize</span>
        </div>
      )}
      <Editor
        tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@8/tinymce.min.js"
        onInit={(evt, editor) => {
          editorRef.current = editor;
        }}
        value={value}
        onEditorChange={(content) => {
          onChange(content);
        }}
        disabled={disabled}
        init={{
          license_key: 'gpl', // Open source license
          height: minHeight ? parseInt(minHeight) : 400,
          min_height: minHeight ? parseInt(minHeight) : 400,
          menubar: false,
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "image",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "fullscreen",
            "insertdatetime",
            "media",
            "table",
            "help",
            "wordcount",
          ],
          toolbar:
            "undo redo | " +
            "bold italic underline strikethrough | subscript superscript | " +
            "alignleft aligncenter alignright alignjustify | " +
            "bullist numlist | " +
            "link image imageinline imagealignleft imagealigncenter imagealignright | " +
            "specialchars | " +
            "code fullscreen | " +
            "removeformat help",
          // Add custom buttons for subscript, superscript, and image alignment
          setup: (editor: any) => {
            // Subscript button
            editor.ui.registry.addButton('subscript', {
              text: 'x₂',
              tooltip: 'Subscript',
              onAction: () => {
                editor.execCommand('mceToggleFormat', false, 'subscript');
              }
            });
            // Superscript button
            editor.ui.registry.addButton('superscript', {
              text: 'x²',
              tooltip: 'Superscript',
              onAction: () => {
                editor.execCommand('mceToggleFormat', false, 'superscript');
              }
            });
            
            // Custom Special Characters Dialog with visual grid - SIMPLIFIED VERSION
            editor.ui.registry.addButton('specialchars', {
              text: 'Ω',
              tooltip: 'Special Characters (Greek, Math, Symbols)',
              onAction: () => {
                // Store editor reference for global access
                const editorId = editor.id;
                (window as any).__tinyMCE_editor = editor;
                // Define character sets
                const greekLowercase = [
                  ['α', 'alpha'], ['β', 'beta'], ['γ', 'gamma'], ['δ', 'delta'],
                  ['ε', 'epsilon'], ['ζ', 'zeta'], ['η', 'eta'], ['θ', 'theta'],
                  ['ι', 'iota'], ['κ', 'kappa'], ['λ', 'lambda'], ['μ', 'mu'],
                  ['ν', 'nu'], ['ξ', 'xi'], ['π', 'pi'], ['ρ', 'rho'],
                  ['σ', 'sigma'], ['τ', 'tau'], ['υ', 'upsilon'], ['φ', 'phi'],
                  ['χ', 'chi'], ['ψ', 'psi'], ['ω', 'omega']
                ];
                
                const greekUppercase = [
                  ['Α', 'Alpha'], ['Β', 'Beta'], ['Γ', 'Gamma'], ['Δ', 'Delta'],
                  ['Ε', 'Epsilon'], ['Ζ', 'Zeta'], ['Η', 'Eta'], ['Θ', 'Theta'],
                  ['Ι', 'Iota'], ['Κ', 'Kappa'], ['Λ', 'Lambda'], ['Μ', 'Mu'],
                  ['Ν', 'Nu'], ['Ξ', 'Xi'], ['Π', 'Pi'], ['Ρ', 'Rho'],
                  ['Σ', 'Sigma'], ['Τ', 'Tau'], ['Υ', 'Upsilon'], ['Φ', 'Phi'],
                  ['Χ', 'Chi'], ['Ψ', 'Psi'], ['Ω', 'Omega']
                ];
                
                const mathSymbols = [
                  ['±', 'plus-minus'], ['×', 'times'], ['÷', 'divide'], ['≠', 'not equal'],
                  ['≤', 'less or equal'], ['≥', 'greater or equal'], ['≈', 'approximately'], ['∞', 'infinity'],
                  ['∑', 'sum'], ['∏', 'product'], ['∫', 'integral'], ['√', 'square root'],
                  ['∂', 'partial'], ['∇', 'nabla'], ['∆', 'delta'], ['∈', 'element of'],
                  ['∉', 'not element'], ['⊂', 'subset'], ['⊃', 'superset'], ['∪', 'union'],
                  ['∩', 'intersection'], ['∅', 'empty set'], ['∴', 'therefore'], ['∵', 'because']
                ];
                
                const arrows = [
                  ['→', 'right'], ['←', 'left'], ['↑', 'up'], ['↓', 'down'],
                  ['↔', 'left-right'], ['⇒', 'implies'], ['⇐', 'implied'], ['⇔', 'iff']
                ];
                
                const otherSymbols = [
                  ['°', 'degree'], ['′', 'prime'], ['″', 'double prime'], ['∠', 'angle'],
                  ['•', 'bullet'], ['…', 'ellipsis'], ['–', 'en dash'], ['—', 'em dash']
                ];
                
                // Store character data in a way that's accessible
                const allChars: Array<{char: string, name: string}> = [
                  ...greekLowercase.map(([char, name]) => ({char, name})),
                  ...greekUppercase.map(([char, name]) => ({char, name})),
                  ...mathSymbols.map(([char, name]) => ({char, name})),
                  ...arrows.map(([char, name]) => ({char, name})),
                  ...otherSymbols.map(([char, name]) => ({char, name}))
                ];
                
                // Create grid HTML with smaller cells and INLINE onclick handlers
                const createGridHTMLFixed = (chars: any[], title: string, charIndexStart: number) => {
                  let html = `<div style="margin-bottom: 15px;">
                    <h3 style="margin: 0 0 6px 0; font-size: 11px; font-weight: 600; color: #333; border-bottom: 1px solid #0066cc; padding-bottom: 3px;">${title}</h3>
                    <div style="display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px;">`;
                  
                  let index = charIndexStart;
                  chars.forEach(([char, name]) => {
                    const charIndex = index++;
                    // Escape character properly for JavaScript string in onclick
                    const charEscaped = char
                      .replace(/\\/g, '\\\\')
                      .replace(/'/g, "\\'")
                      .replace(/"/g, '\\"')
                      .replace(/\n/g, '\\n')
                      .replace(/\r/g, '\\r');
                    
                    // Use character code as fallback
                    const charCode = char.charCodeAt(0);
                    
                    html += `
                      <button 
                        type="button"
                        class="mce-char-btn" 
                        data-char-index="${charIndex}"
                        data-char-code="${charCode}"
                        title="${name}"
                        onclick="
                          try {
                            var ed = window.__tinyMCE_editor;
                            if (!ed && window.tinymce) {
                              var editors = window.tinymce.editors;
                              if (editors && editors.length > 0) {
                                ed = editors[0];
                              }
                            }
                            if (ed) {
                              var charToInsert = String.fromCharCode(${charCode});
                              ed.insertContent(charToInsert);
                              var wins = ed.windowManager.getWindows();
                              if (wins && wins.length > 0) {
                                wins[0].close();
                              }
                            } else {
                              console.error('Editor not found');
                            }
                          } catch(e) {
                            console.error('Error inserting character:', e);
                          }
                          if (event) {
                            event.preventDefault();
                            event.stopPropagation();
                          }
                          return false;
                        "
                        style="
                          width: 100%; 
                          height: 28px;
                          font-size: 14px; 
                          border: 1px solid #ccc; 
                          background: #fff; 
                          cursor: pointer; 
                          border-radius: 2px;
                          transition: all 0.1s ease;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          padding: 0;
                          margin: 0;
                          line-height: 1;
                        "
                      >${char}</button>
                    `;
                  });
                  
                  html += '</div></div>';
                  return {html, nextIndex: index};
                };
                
                let charIndex = 0;
                const grid1 = createGridHTMLFixed(greekLowercase, 'Greek Letters (Lowercase)', charIndex);
                charIndex = grid1.nextIndex;
                const grid2 = createGridHTMLFixed(greekUppercase, 'Greek Letters (Uppercase)', charIndex);
                charIndex = grid2.nextIndex;
                const grid3 = createGridHTMLFixed(mathSymbols, 'Math Symbols', charIndex);
                charIndex = grid3.nextIndex;
                const grid4 = createGridHTMLFixed(arrows, 'Arrows', charIndex);
                charIndex = grid4.nextIndex;
                const grid5 = createGridHTMLFixed(otherSymbols, 'Other Symbols', charIndex);
                
                const dialogContentFixed = `
                  <div id="char-dialog-container" style="max-height: 450px; overflow-y: auto; padding: 10px; background: #fafafa;">
                    ${grid1.html}
                    ${grid2.html}
                    ${grid3.html}
                    ${grid4.html}
                    ${grid5.html}
                  </div>
                  <style>
                    .mce-char-btn:hover {
                      background: #e3f2fd !important;
                      border-color: #0066cc !important;
                      transform: scale(1.05);
                      box-shadow: 0 1px 3px rgba(0,102,204,0.2);
                      z-index: 10;
                      position: relative;
                    }
                    .mce-char-btn:active {
                      background: #bbdefb !important;
                      transform: scale(0.98);
                    }
                  </style>
                `;
                
                const dialog = editor.windowManager.open({
                  title: 'Special Characters - Click to Insert',
                  body: {
                    type: 'panel',
                    items: [
                      {
                        type: 'htmlpanel',
                        html: dialogContentFixed,
                        presets: 'document'
                      }
                    ]
                  },
                  buttons: [
                    {
                      type: 'cancel',
                      text: 'Close'
                    }
                  ],
                  size: 'large',
                  initialData: {}
                });
                
                // Store editor globally for onclick handlers to access
                (window as any).__tinyMCE_editor = editor;
                
                console.log('Special characters dialog opened, editor stored globally');
              }
            });
            
            // Image alignment buttons - Enhanced with better control
            editor.ui.registry.addButton('imagealignleft', {
              icon: 'align-left',
              tooltip: 'Align image left (text wraps around)',
              onAction: () => {
                const node = editor.selection.getNode();
                if (node.tagName === 'IMG') {
                  editor.dom.setStyle(node, 'float', 'left');
                  editor.dom.setStyle(node, 'margin', '10px 20px 10px 0');
                  editor.dom.setStyle(node, 'display', 'block');
                  editor.dom.addClass(node, 'editor-image-left');
                  editor.dom.removeClass(node, 'editor-image-right editor-image-center editor-image-inline');
                } else {
                  editor.windowManager.alert('Please select an image first');
                }
              }
            });
            
            editor.ui.registry.addButton('imagealigncenter', {
              icon: 'align-center',
              tooltip: 'Align image center (block)',
              onAction: () => {
                const node = editor.selection.getNode();
                if (node.tagName === 'IMG') {
                  editor.dom.setStyle(node, 'float', 'none');
                  editor.dom.setStyle(node, 'margin', '15px auto');
                  editor.dom.setStyle(node, 'display', 'block');
                  editor.dom.addClass(node, 'editor-image-center');
                  editor.dom.removeClass(node, 'editor-image-left editor-image-right editor-image-inline');
                } else {
                  editor.windowManager.alert('Please select an image first');
                }
              }
            });
            
            editor.ui.registry.addButton('imagealignright', {
              icon: 'align-right',
              tooltip: 'Align image right (text wraps around)',
              onAction: () => {
                const node = editor.selection.getNode();
                if (node.tagName === 'IMG') {
                  editor.dom.setStyle(node, 'float', 'right');
                  editor.dom.setStyle(node, 'margin', '10px 0 10px 20px');
                  editor.dom.setStyle(node, 'display', 'block');
                  editor.dom.addClass(node, 'editor-image-right');
                  editor.dom.removeClass(node, 'editor-image-left editor-image-center editor-image-inline');
                } else {
                  editor.windowManager.alert('Please select an image first');
                }
              }
            });
            
            // Inline image button - makes image appear next to text
            editor.ui.registry.addButton('imageinline', {
              icon: 'image',
              tooltip: 'Make image inline (next to text)',
              onAction: () => {
                const node = editor.selection.getNode();
                if (node.tagName === 'IMG') {
                  editor.dom.setStyle(node, 'float', 'none');
                  editor.dom.setStyle(node, 'display', 'inline-block');
                  editor.dom.setStyle(node, 'vertical-align', 'middle');
                  editor.dom.setStyle(node, 'margin', '5px 8px');
                  editor.dom.addClass(node, 'editor-image');
                  editor.dom.removeClass(node, 'editor-image-left editor-image-right editor-image-center editor-image-inline');
                } else {
                  editor.windowManager.alert('Please select an image first');
                }
              }
            });
            
            // Make images inline by default when inserted
            editor.on('SetContent', (e: any) => {
              // Process images after content is set
              setTimeout(() => {
                const images = editor.dom.select('img');
                images.forEach((img: any) => {
                  // Only apply if image doesn't have any alignment class
                  if (!img.className || 
                      (!img.className.includes('editor-image-left') && 
                       !img.className.includes('editor-image-right') && 
                       !img.className.includes('editor-image-center') &&
                       !img.className.includes('editor-image-full'))) {
                    // Make it inline by default
                    editor.dom.setStyle(img, 'display', 'inline-block');
                    editor.dom.setStyle(img, 'vertical-align', 'middle');
                    editor.dom.setStyle(img, 'margin', '5px 8px');
                    if (!img.className) {
                      img.className = 'editor-image';
                    } else if (!img.className.includes('editor-image')) {
                      img.className += ' editor-image';
                    }
                  }
                });
              }, 100);
            });
            
            // Handle image insertion to make them inline by default
            editor.on('ObjectResized', (e: any) => {
              if (e.target.tagName === 'IMG') {
                const img = e.target;
                // If no alignment class, make it inline
                if (!img.className || 
                    (!img.className.includes('editor-image-left') && 
                     !img.className.includes('editor-image-right') && 
                     !img.className.includes('editor-image-center') &&
                     !img.className.includes('editor-image-full'))) {
                  editor.dom.setStyle(img, 'display', 'inline-block');
                  editor.dom.setStyle(img, 'vertical-align', 'middle');
                  editor.dom.setStyle(img, 'margin', '5px 8px');
                }
              }
            });
            
            // Intercept image insertion to make them inline by default
            editor.on('BeforeSetContent', (e: any) => {
              if (e.content && e.content.includes('<img')) {
                // Modify the content to add inline styling to images
                e.content = e.content.replace(
                  /<img([^>]*?)>/gi,
                  (match: string, attrs: string) => {
                    // Check if image already has alignment classes
                    if (attrs.includes('editor-image-left') || 
                        attrs.includes('editor-image-right') || 
                        attrs.includes('editor-image-center') ||
                        attrs.includes('editor-image-full')) {
                      return match; // Keep as is
                    }
                    // Add inline styling
                    let newAttrs = attrs;
                    if (!newAttrs.includes('class=')) {
                      newAttrs += ' class="editor-image"';
                    } else if (!newAttrs.includes('editor-image')) {
                      newAttrs = newAttrs.replace(/class="([^"]*)"/, 'class="$1 editor-image"');
                    }
                    if (!newAttrs.includes('style=')) {
                      newAttrs += ' style="display:inline-block;vertical-align:middle;margin:5px 8px;"';
                    } else if (!newAttrs.includes('display:')) {
                      newAttrs = newAttrs.replace(/style="([^"]*)"/, 'style="$1;display:inline-block;vertical-align:middle;margin:5px 8px;"');
                    }
                    return `<img${newAttrs}>`;
                  }
                );
              }
            });
            
            // Also handle images after they're inserted (for drag-drop and other methods)
            editor.on('SetContent', (e: any) => {
              setTimeout(() => {
                const images = editor.dom.select('img');
                images.forEach((img: any) => {
                  // Only apply if image doesn't have any alignment class
                  if (!img.className || 
                      (!img.className.includes('editor-image-left') && 
                       !img.className.includes('editor-image-right') && 
                       !img.className.includes('editor-image-center') &&
                       !img.className.includes('editor-image-full'))) {
                    // Make it inline by default
                    editor.dom.setStyle(img, 'display', 'inline-block');
                    editor.dom.setStyle(img, 'vertical-align', 'middle');
                    editor.dom.setStyle(img, 'margin', '5px 8px');
                    if (!img.className) {
                      img.className = 'editor-image';
                    } else if (!img.className.includes('editor-image')) {
                      img.className += ' editor-image';
                    }
                  }
                });
              }, 100);
            });
            
            // Add visual feedback when image is selected
            editor.on('NodeChange', (e: any) => {
              const node = e.element;
              if (node && node.tagName === 'IMG') {
                // Highlight selected image
                editor.dom.addClass(node, 'mce-selected-image');
              } else {
                // Remove highlight from all images
                const images = editor.dom.select('img.mce-selected-image');
                images.forEach((img: any) => {
                  editor.dom.removeClass(img, 'mce-selected-image');
                });
              }
            });
            
            // Enable drag and drop for repositioning images
            editor.on('init', () => {
              // Images can be dragged within the editor
              editor.dom.bind(editor.getBody(), 'dragstart', (e: any) => {
                if (e.target.tagName === 'IMG') {
                  e.dataTransfer.effectAllowed = 'move';
                }
              });
            });
          },
          toolbar_mode: 'sliding', // Better toolbar organization
          toolbar_sticky: true, // Keep toolbar visible when scrolling
          content_style: `
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              font-size: 15px;
              line-height: 1.7;
              padding: 15px;
              color: #333;
            }
            .code-block {
              background-color: #f4f4f4;
              padding: 12px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
              border: 1px solid #ddd;
            }
            .editor-image {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
              margin: 5px 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: inline-block;
              vertical-align: middle;
            }
            .editor-image-full {
              width: 100%;
              height: auto;
            }
            .editor-image-thumb {
              max-width: 200px;
              height: auto;
            }
            .editor-link {
              color: #0066cc;
              text-decoration: underline;
            }
            img {
              max-width: 100%;
              height: auto;
              display: inline-block;
              vertical-align: middle;
              margin: 5px 8px;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            img.editor-image {
              display: inline-block;
              vertical-align: middle;
              margin: 5px 8px;
            }
            /* Image alignment classes */
            .editor-image {
              max-width: 100%;
              height: auto;
              border-radius: 4px;
              margin: 5px 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: inline-block;
              vertical-align: middle;
            }
            .editor-image-left {
              float: left;
              margin: 5px 15px 5px 0;
              max-width: 50%;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: block;
            }
            .editor-image-right {
              float: right;
              margin: 5px 0 5px 15px;
              max-width: 50%;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              display: block;
            }
            .editor-image-center {
              display: block;
              margin: 15px auto;
              max-width: 80%;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .editor-image-inline {
              display: inline-block;
              vertical-align: middle;
              max-width: 200px;
              height: auto;
              margin: 0 5px;
              border-radius: 4px;
            }
            .editor-image-full {
              display: block;
              width: 100%;
              height: auto;
              margin: 15px 0;
            }
            .editor-image-thumb {
              display: inline-block;
              max-width: 150px;
              height: auto;
              margin: 5px 8px;
              vertical-align: middle;
            }
            /* Selected image highlight */
            .mce-selected-image {
              outline: 3px solid #0066cc !important;
              outline-offset: 2px;
              cursor: move;
            }
            /* Image resize handles */
            img[data-mce-selected] {
              outline: 3px solid #0066cc !important;
              outline-offset: 2px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            table td, table th {
              border: 1px solid #ddd;
              padding: 10px;
            }
            table th {
              background-color: #f4f4f4;
              font-weight: bold;
            }
          `,
          placeholder: placeholder || "Start typing...",
          branding: false,
          promotion: false,
          resize: 'both', // Allow resizing both width and height
          resize_img_proportional: true, // Maintain aspect ratio when resizing images
          // Enhanced image manipulation
          object_resizing: true, // Enable object resizing (images, tables, etc.)
          visual_blocks: true, // Show block boundaries
          visual_chars: false, // Don't show invisible characters
          // Better image editing
          image_advtab: true, // Show advanced image tab
          image_list: false, // We use upload, not image list
          // Enable drag and drop for images within editor
          draggable_modal: true,
          // Special Characters (Charmap) configuration with Greek letters and math symbols
          charmap_append: [
            // Greek letters (lowercase)
            ['α', 'alpha'],
            ['β', 'beta'],
            ['γ', 'gamma'],
            ['δ', 'delta'],
            ['ε', 'epsilon'],
            ['ζ', 'zeta'],
            ['η', 'eta'],
            ['θ', 'theta'],
            ['ι', 'iota'],
            ['κ', 'kappa'],
            ['λ', 'lambda'],
            ['μ', 'mu'],
            ['ν', 'nu'],
            ['ξ', 'xi'],
            ['π', 'pi'],
            ['ρ', 'rho'],
            ['σ', 'sigma'],
            ['τ', 'tau'],
            ['υ', 'upsilon'],
            ['φ', 'phi'],
            ['χ', 'chi'],
            ['ψ', 'psi'],
            ['ω', 'omega'],
            // Greek letters (uppercase)
            ['Α', 'Alpha'],
            ['Β', 'Beta'],
            ['Γ', 'Gamma'],
            ['Δ', 'Delta'],
            ['Ε', 'Epsilon'],
            ['Ζ', 'Zeta'],
            ['Η', 'Eta'],
            ['Θ', 'Theta'],
            ['Ι', 'Iota'],
            ['Κ', 'Kappa'],
            ['Λ', 'Lambda'],
            ['Μ', 'Mu'],
            ['Ν', 'Nu'],
            ['Ξ', 'Xi'],
            ['Π', 'Pi'],
            ['Ρ', 'Rho'],
            ['Σ', 'Sigma'],
            ['Τ', 'Tau'],
            ['Υ', 'Upsilon'],
            ['Φ', 'Phi'],
            ['Χ', 'Chi'],
            ['Ψ', 'Psi'],
            ['Ω', 'Omega'],
            // Math symbols
            ['±', 'plus-minus'],
            ['×', 'times'],
            ['÷', 'divide'],
            ['≠', 'not equal'],
            ['≤', 'less than or equal'],
            ['≥', 'greater than or equal'],
            ['≈', 'approximately equal'],
            ['∞', 'infinity'],
            ['∑', 'sum'],
            ['∏', 'product'],
            ['∫', 'integral'],
            ['√', 'square root'],
            ['∛', 'cube root'],
            ['∂', 'partial derivative'],
            ['∇', 'nabla'],
            ['∆', 'delta'],
            ['∈', 'element of'],
            ['∉', 'not element of'],
            ['⊂', 'subset'],
            ['⊃', 'superset'],
            ['∪', 'union'],
            ['∩', 'intersection'],
            ['∅', 'empty set'],
            ['∴', 'therefore'],
            ['∵', 'because'],
            ['∠', 'angle'],
            ['°', 'degree'],
            ['′', 'prime'],
            ['″', 'double prime'],
            // Arrows
            ['→', 'right arrow'],
            ['←', 'left arrow'],
            ['↑', 'up arrow'],
            ['↓', 'down arrow'],
            ['↔', 'left-right arrow'],
            ['⇒', 'implies'],
            ['⇐', 'implied by'],
            ['⇔', 'if and only if'],
            ['⇄', 'right-left arrow'],
            ['⇆', 'left-right arrow'],
            // Other useful symbols
            ['‰', 'per mille'],
            ['€', 'euro'],
            ['£', 'pound'],
            ['¥', 'yen'],
            ['©', 'copyright'],
            ['®', 'registered'],
            ['™', 'trademark'],
            ['§', 'section'],
            ['¶', 'paragraph'],
            ['•', 'bullet'],
            ['…', 'ellipsis'],
            ['–', 'en dash'],
            ['—', 'em dash'],
            ['"', 'left double quote'],
            ['"', 'right double quote'],
            ["'", 'left single quote'],
            ["'", 'right single quote'],
          ],
          elementpath: true,
          statusbar: true,
          readonly: disabled,
          // Better visual feedback
          content_css: false, // Use default styles
          skin: 'oxide',
          icons: 'default',
          // Image upload configuration - Enhanced
          images_upload_handler: handleImageUpload,
          images_upload_url: false, // Disable default upload URL
          automatic_uploads: true,
          file_picker_types: "image",
          image_advtab: true, // Advanced image options
          image_caption: true, // Enable image captions
          image_title: true, // Enable image titles
          image_description: true, // Enable image descriptions
          image_dimensions: true, // Show image dimensions
          // Make images inline by default so they can appear next to text
          image_prepend_url: '',
          image_list: false,
          // Image alignment options
          image_class_list: [
            { title: 'Inline (Default - Next to Text)', value: 'editor-image' },
            { title: 'Left Aligned (Text Wraps)', value: 'editor-image-left' },
            { title: 'Right Aligned (Text Wraps)', value: 'editor-image-right' },
            { title: 'Center (Block)', value: 'editor-image-center' },
            { title: 'Full Width', value: 'editor-image-full' },
            { title: 'Thumbnail', value: 'editor-image-thumb' },
            { title: 'Small Inline', value: 'editor-image-inline' }
          ],
          // Image alignment options
          image_align: true, // Enable alignment buttons
          image_list: false, // Disable image list (we use upload)
          image_prepend_url: '', // No prepend URL
          // Enhanced image resizing
          image_resize: true,
          image_dimensions: true,
          image_advtab: true,
          // Better image dialog
          image_caption: true,
          image_title: true,
          image_description: true,
          // Drag and drop support
          paste_data_images: true,
          paste_as_text: false,
          // Link configuration
          link_target_list: [
            { title: "None", value: "" },
            { title: "New window", value: "_blank" },
          ],
          // Table configuration
          table_toolbar: "tableprops tabledelete | tableinsertrowbefore tableinsertrowafter tabledeleterow | tableinsertcolbefore tableinsertcolafter tabledeletecol",
          // Code block configuration
          code_dialog_width: 600,
          code_dialog_height: 400,
          // Custom formats
          formats: {
            underline: { inline: "u", exact: true },
            strikethrough: { inline: "s", exact: true },
            subscript: { inline: "sub" },
            superscript: { inline: "sup" },
          },
          // Paste configuration
          paste_as_text: false,
          paste_auto_cleanup_on_paste: true,
          paste_remove_styles: false,
          paste_remove_spans: false,
          paste_strip_class_attributes: "none",
          // Accessibility
          a11y_advanced_options: true,
          // Custom CSS for better styling
          body_class: "prose prose-sm max-w-none",
        }}
      />
      {isUploading && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span className="font-medium">Uploading image... Please wait</span>
        </div>
      )}
    </div>
  );
}

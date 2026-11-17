# MD Studio

## Short description

MD Studio is a polished, browser-based Markdown editor and viewer that combines focused writing tools, live preview, file-based workflows, and presentation-ready annotations in one responsive workspace.

## Long description

MD Studio is a frontend-only Markdown workspace built for writing, reviewing, and presenting `.md` documents without requiring an account or backend service. It provides a distraction-free editor alongside a live, sanitized preview, with Preview, Split, and Editor modes for different stages of the workflow.

The app supports opening Markdown or text files through a file picker, drag-and-drop, or paste; editing with formatting controls and keyboard shortcuts; and saving changes back to the opened file when the browser supports the File System Access API. When direct file access is unavailable, documents can be downloaded instead. Content can also be exported as Markdown, standalone HTML, or a print-ready PDF.

For review and presentation, MD Studio includes a generated table of contents, synchronized editor/preview scrolling, syntax-highlighted code blocks with copy actions, interactive task lists, adjustable preview width and text size, and browser autosave for drafts and preferences. Its annotation layer adds a laser pointer, pen, highlighter, text blocks, color and size controls, erasing, and undo directly over the rendered document.

The project demonstrates practical client-side application design with React and Next.js: stateful editing interactions, browser APIs, local persistence, sanitized Markdown rendering, responsive UI behavior, keyboard accessibility, and export-oriented document workflows.

## Highlights

- Live Markdown preview powered by GFM parsing and syntax highlighting
- Preview, Split, and Editor viewing modes
- File picker, drag-and-drop, paste, save, and browser download workflows
- File System Access API support for saving back to opened files in Chromium-based browsers
- Markdown, standalone HTML, and print/PDF export
- Formatting toolbar and productivity shortcuts for common Markdown operations
- Interactive task-list checkboxes that update the source Markdown
- Generated table of contents with heading anchors
- Synchronized editor and preview scrolling
- Presentation annotation tools: laser, pen, marker, text, eraser, undo, and clear
- Local draft and preference autosave using `localStorage`
- Responsive dark interface with adjustable content width, font size, and wrapping

## Tech stack

- Next.js App Router
- React and TypeScript
- `marked` for GitHub-Flavored Markdown parsing
- DOMPurify for sanitized preview output
- Highlight.js for code highlighting
- CSS and browser APIs for the editor, file handling, annotations, persistence, and printing

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For a production build:

```bash
npm run build
npm start
```

## Scope

MD Studio is intentionally focused on local, browser-based document editing and presentation. Authentication, cloud storage, collaboration, and sharing are out of scope for this version.

## Portfolio tags

`Next.js` `React` `TypeScript` `Markdown Editor` `Markdown Preview` `Frontend Development` `Browser APIs` `File System Access API` `Document Tools` `Rich Text Editing` `Syntax Highlighting` `Local Storage` `Responsive UI` `Accessibility` `Data Export` `PDF Export` `Canvas Annotations` `Web App`

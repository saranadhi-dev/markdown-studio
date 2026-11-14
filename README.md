# MD Studio

Dark, responsive markdown viewer + editor (Next.js App Router, frontend only).

    npm install
    npm run dev        # http://localhost:3000
    npm run build && npm start

Features: file picker + drag-drop + paste, Preview / Split / Editor, annotate layer (laser, pen, marker,
text blocks, eraser), clickable task lists, outline, Save back to the opened file (Chromium, File System
Access API) or download, export .md / .html / PDF (print dialog), browser autosave.

Layout: app/ (page, layout, css) - components/ (Workbench, Editor, Preview, Menu) - lib/ (render, annotate, welcome).
Auth and sharing are intentionally out of scope for this version.

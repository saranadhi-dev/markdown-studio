export const WELCOME = `# MD Studio

A fast, dark **markdown workbench** for everyday dev docs: READMEs, ADRs, runbooks, changelogs.

- Open a \`.md\` file with **Open** (Ctrl+O), drop one onto the page, or just paste into the editor
- Edits autosave to this browser; **Save** (Ctrl+S) writes back to the file you opened
- Switch **Preview / Split / Editor** (Ctrl+E) and annotate the preview (Ctrl+Shift+A)

## Editor shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+B / Ctrl+I / Ctrl+K | Bold / italic / link |
| Tab / Shift+Tab | Indent / outdent lines |
| Alt+Up / Alt+Down | Move line(s) |
| Ctrl+Shift+D | Duplicate line(s) |
| Enter in a list | Continue the list |

## Code is highlighted

\`\`\`ts
type Job = { id: string; run: () => Promise<void> };

export async function drain(queue: Job[], concurrency = 4) {
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length) await queue.shift()!.run();
  });
  await Promise.all(workers);
}
\`\`\`

## Task lists are clickable in the preview

- [x] Paste or open a markdown file
- [x] Try the annotation laser pointer
- [ ] Click this checkbox in the preview, the source updates

> Tip: **Download** exports \`.md\`, \`.html\` or PDF.
`;

import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

// CodeMirror theme wired to the app's CSS variables, so the editor follows the
// same light/dark palette as the rest of the UI automatically.
const base = EditorView.theme({
  '&': {
    color: 'var(--text)',
    backgroundColor: 'var(--surface)',
    fontSize: '12.5px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    caretColor: 'var(--ring)',
    padding: '8px 0',
  },
  '.cm-scroller': { lineHeight: '1.55' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ring)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--ring) 22%, transparent)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--surface)',
    color: 'var(--faint)',
    border: 'none',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ring) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 8px' },
})

const highlight = HighlightStyle.define([
  { tag: t.comment, color: 'var(--faint)', fontStyle: 'italic' },
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--ring)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--key)' },
  { tag: [t.number, t.bool, t.null, t.atom, t.keyword], color: 'var(--key)' },
  { tag: [t.punctuation, t.separator], color: 'var(--muted)' },
])

export const cmTheme = [base, syntaxHighlighting(highlight)]

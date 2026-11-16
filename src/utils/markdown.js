import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

export function renderMarkdown(text) {
  const raw = String(text || '')
  if (!raw.trim()) return ''
  const html = marked.parse(raw, { async: false })
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  })
}

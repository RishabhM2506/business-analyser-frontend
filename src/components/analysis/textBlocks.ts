// Splits a plain-text LLM-authored string into paragraph blocks for
// structured rendering. This is the "structure by paragraph, not
// markdown-to-HTML" approach master brief §8 asks for: the backend's
// `item_description`/`analytical_summary` are plain strings (see
// types/generated.ts), not markdown or HTML — this only breaks on the
// blank-line/newline boundaries the prompt's own output already contains, it
// never interprets `*`, `#`, `<...>` or any other markup syntax.
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

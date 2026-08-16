import { describe, expect, it } from 'vitest'

import { splitParagraphs } from '@/components/analysis/textBlocks'

describe('splitParagraphs', () => {
  it('splits on blank-line paragraph breaks', () => {
    expect(splitParagraphs('First paragraph.\n\nSecond paragraph.')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ])
  })

  it('splits on single newlines too', () => {
    expect(splitParagraphs('Line one.\nLine two.')).toEqual(['Line one.', 'Line two.'])
  })

  it('returns a single-element array for text with no line breaks', () => {
    expect(splitParagraphs('Just one sentence.')).toEqual(['Just one sentence.'])
  })

  it('trims surrounding whitespace on each paragraph', () => {
    expect(splitParagraphs('  Padded line.  \n\n  Another.  ')).toEqual([
      'Padded line.',
      'Another.',
    ])
  })

  it('drops empty paragraphs produced by runs of blank lines', () => {
    expect(splitParagraphs('One.\n\n\n\nTwo.')).toEqual(['One.', 'Two.'])
  })

  it('returns an empty array for an empty or whitespace-only string', () => {
    expect(splitParagraphs('')).toEqual([])
    expect(splitParagraphs('   \n  \n ')).toEqual([])
  })

  it('never interprets markup syntax — it is not a markdown parser', () => {
    const withMarkup = splitParagraphs('# Heading\n\n**bold** and <script>alert(1)</script>')
    expect(withMarkup).toEqual(['# Heading', '**bold** and <script>alert(1)</script>'])
  })
})

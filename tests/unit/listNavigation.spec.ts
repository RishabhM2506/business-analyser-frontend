import { describe, expect, it } from 'vitest'

import { isListNavigationKey, nextActiveIndex } from '@/components/common/listNavigation'

describe('isListNavigationKey', () => {
  it('recognizes the four navigation keys', () => {
    expect(isListNavigationKey('ArrowDown')).toBe(true)
    expect(isListNavigationKey('ArrowUp')).toBe(true)
    expect(isListNavigationKey('Home')).toBe(true)
    expect(isListNavigationKey('End')).toBe(true)
  })

  it('rejects everything else, including similarly-named keys', () => {
    expect(isListNavigationKey('Enter')).toBe(false)
    expect(isListNavigationKey('Escape')).toBe(false)
    expect(isListNavigationKey('ArrowLeft')).toBe(false)
    expect(isListNavigationKey('a')).toBe(false)
    expect(isListNavigationKey('')).toBe(false)
  })
})

describe('nextActiveIndex', () => {
  it('ArrowDown from "nothing active" (-1) lands on the first item', () => {
    expect(nextActiveIndex(-1, 'ArrowDown', 5)).toBe(0)
  })

  it('ArrowUp from "nothing active" (-1) lands on the last item', () => {
    expect(nextActiveIndex(-1, 'ArrowUp', 5)).toBe(4)
  })

  it('ArrowDown advances by one', () => {
    expect(nextActiveIndex(1, 'ArrowDown', 5)).toBe(2)
  })

  it('ArrowUp retreats by one', () => {
    expect(nextActiveIndex(2, 'ArrowUp', 5)).toBe(1)
  })

  it('clamps at the last index on ArrowDown rather than wrapping to 0', () => {
    expect(nextActiveIndex(4, 'ArrowDown', 5)).toBe(4)
  })

  it('clamps at 0 on ArrowUp rather than wrapping to the last index', () => {
    expect(nextActiveIndex(0, 'ArrowUp', 5)).toBe(0)
  })

  it('Home always jumps to 0', () => {
    expect(nextActiveIndex(3, 'Home', 5)).toBe(0)
  })

  it('End always jumps to the last index', () => {
    expect(nextActiveIndex(1, 'End', 5)).toBe(4)
  })

  it('returns -1 for an empty list regardless of key', () => {
    expect(nextActiveIndex(-1, 'ArrowDown', 0)).toBe(-1)
    expect(nextActiveIndex(0, 'End', 0)).toBe(-1)
  })
})

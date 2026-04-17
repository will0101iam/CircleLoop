import { describe, expect, it } from 'vitest'
import { getResumeEventPlacement } from './runTimelinePlacement'

describe('runTimelinePlacement', () => {
  it('keeps resumed approval events in thinking before answer text starts', () => {
    expect(getResumeEventPlacement(false)).toEqual({
      phase: 'thinking',
      anchor: 'thinking',
      shouldAppendAnswerMarker: false,
    })
  })

  it('moves resumed approval events to answer after answer text has started', () => {
    expect(getResumeEventPlacement(true)).toEqual({
      phase: 'answer',
      anchor: 'answer',
      shouldAppendAnswerMarker: true,
    })
  })
})

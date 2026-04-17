export function getResumeEventPlacement(hasStartedAnswer: boolean) {
  if (hasStartedAnswer) {
    return {
      phase: 'answer' as const,
      anchor: 'answer' as const,
      shouldAppendAnswerMarker: true,
    }
  }

  return {
    phase: 'thinking' as const,
    anchor: 'thinking' as const,
    shouldAppendAnswerMarker: false,
  }
}

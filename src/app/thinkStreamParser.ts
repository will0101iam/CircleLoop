type Mode = 'answer' | 'thinking'

const MAX_TAG_FRAGMENT = 32

function findTag(haystack: string, tag: RegExp) {
  const match = tag.exec(haystack)
  if (!match) return null
  return { index: match.index, length: match[0].length }
}

function splitForCarry(text: string) {
  // Only keep a suffix that could plausibly be a split tag (starts at last '<').
  const start = Math.max(0, text.length - MAX_TAG_FRAGMENT)
  const tail = text.slice(start)
  const lastLt = tail.lastIndexOf('<')
  if (lastLt === -1) return { emit: text, carry: '' }
  const carryStart = start + lastLt
  return { emit: text.slice(0, carryStart), carry: text.slice(carryStart) }
}

export function createThinkStreamParser() {
  let mode: Mode = 'answer'
  let carry = ''
  let thinking = ''
  let answer = ''

  const openRe = /<think\s*>/i
  const closeRe = /<\/think\s*>/i

  const pushDelta = (delta: string) => {
    let text = `${carry}${delta}`
    carry = ''

    while (text.length > 0) {
      if (mode === 'answer') {
        const found = findTag(text, openRe)
        if (!found) {
          const { emit, carry: nextCarry } = splitForCarry(text)
          answer += emit
          carry = nextCarry
          break
        }
        answer += text.slice(0, found.index)
        text = text.slice(found.index + found.length)
        mode = 'thinking'
        continue
      }

      const found = findTag(text, closeRe)
      if (!found) {
        const { emit, carry: nextCarry } = splitForCarry(text)
        thinking += emit
        carry = nextCarry
        break
      }
      thinking += text.slice(0, found.index)
      text = text.slice(found.index + found.length)
      mode = 'answer'
    }
  }

  const getThinkingText = () => thinking
  const getAnswerText = () => answer

  return { pushDelta, getThinkingText, getAnswerText }
}

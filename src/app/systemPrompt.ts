const BASE_SYSTEM_PROMPT =
  'You are circleloop, a coding agent. Use tools when needed. Keep answers concise and precise. Use update_plan to keep the visible task checklist current when your plan or step status changes.'

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

export function formatCurrentDateForModel(date = new Date()) {
  return `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月${pad2(date.getDate())}日`
}

export function buildSystemPrompt(date = new Date()) {
  return `${BASE_SYSTEM_PROMPT}\n\n当前日期：${formatCurrentDateForModel(date)}。`
}

import type { ToolDefinition } from '../tools/toolRegistry'
import type { OpenAICompatTool } from './openaiCompat'

export function buildOpenAICompatTools(
  tools: ReadonlyArray<Pick<ToolDefinition, 'name' | 'description' | 'inputSchema'>>,
): OpenAICompatTool[] {
  return tools.map((tool) => {
    const fn: OpenAICompatTool['function'] = { name: tool.name }
    if (tool.description) fn.description = tool.description
    if (tool.inputSchema) fn.parameters = tool.inputSchema

    return { type: 'function', function: fn }
  })
}


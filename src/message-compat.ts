/** Read both DSH 0.1 nested tool results and DSH 0.2 tool-role messages. */
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
type LegacyResult = { readonly type: 'tool-result'; readonly toolCallId: string; readonly content: readonly CompatibleBlock[] }
type CompatibleBlock = ContentBlock | LegacyResult
export function compatibleTexts(blocks: readonly CompatibleBlock[]): string[] {
  const result: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') result.push(block.text)
    else if (block.type === 'tool-result') result.push(...compatibleTexts(block.content))
  }
  return result
}
export function compatibleCallId(message: { readonly content: readonly CompatibleBlock[]; readonly toolCallId?: string }): string | undefined {
  if (typeof message.toolCallId === 'string') return message.toolCallId
  for (const block of message.content) if (block.type === 'tool-result') return block.toolCallId
  return undefined
}

import { expect, it } from 'vitest'
import { compatibleCallId, compatibleTexts } from '../src/message-compat.ts'
import { blocksToText } from '../src/runtime.ts'
it('reads current tool-role result identity and text',()=>{
  const message={toolCallId:'call-02',content:[{type:'text' as const,text:'current result'}]}
  expect(compatibleCallId(message)).toBe('call-02')
  expect(compatibleTexts(message.content)).toEqual(['current result'])
  expect(blocksToText(message.content)).toBe('current result')
})
it('retains old nested result identity and text',()=>{
  const message={content:[{type:'tool-result' as const,toolCallId:'call-01',content:[{type:'text' as const,text:'legacy result'}]}]}
  expect(compatibleCallId(message)).toBe('call-01')
  expect(compatibleTexts(message.content)).toEqual(['legacy result'])
})
it('does not invent an identity for uncorrelated evidence',()=>{
  expect(compatibleCallId({content:[]})).toBeUndefined()
})

import { expect, it } from 'vitest'
import { toolResultCallId, contentTexts } from '../src/transcript-compat.ts'
import { blocksToText } from '../src/runtime.ts'
it('reads current tool-role result identity and text',()=>{
  const message={source:{kind:'tool',callId:'call-02'},toolCallId:'call-02',content:[{type:'text' as const,text:'current result'}]}
  expect(toolResultCallId(message)).toBe('call-02')
  expect(contentTexts(message.content)).toEqual(['current result'])
  expect(blocksToText(message.content)).toBe('current result')
})
it('retains old nested result identity and text',()=>{
  const message={content:[{type:'tool-result' as const,toolCallId:'call-01',content:[{type:'text' as const,text:'legacy result'}]}]}
  expect(toolResultCallId(message)).toBe('call-01')
  expect(contentTexts(message.content)).toEqual(['legacy result'])
})
it('does not invent an identity for uncorrelated evidence',()=>{
  expect(toolResultCallId({content:[]})).toBeUndefined()
})

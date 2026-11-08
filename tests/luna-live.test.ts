/** Explicit opt-in only. Sends synthetic evidence, never executes a tool. */
import { expect, it } from 'vitest'
import { runLunaReviewer } from '../src/luna-reviewer.ts'
const enabled = process.env.LUNA_LIVE === '1'
it.skipIf(!enabled)('OpenAI Decisions live contract (paid, requires prior user approval)', async () => {
  const result = await runLunaReviewer({ endpoint:'https://api.openai.com/v1/decisions',model:'gpt-6-luna',
    apiKeyEnv:'OPENAI_LUNA_DECISIONS_API_KEY',credential:process.env.OPENAI_LUNA_DECISIONS_API_KEY,
    timeoutMs:15000,allowEgress:true,autoAllow:false,allowProbabilityMin:0.99,
    classificationProbabilityMin:0.99,prohibitionProbabilityMax:0.001,
    evidence:{toolName:'read',argumentsText:'{"path":"README.md"}',transcript:'',userIntent:'Read README.md in a synthetic test workspace.'} })
  expect(result.failure).toBeUndefined()
  expect(result.verdict).toBeDefined()
  expect(result.answeredModel).toBe('gpt-6-luna')
})

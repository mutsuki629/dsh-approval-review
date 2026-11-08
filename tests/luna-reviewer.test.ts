import { describe, it, expect, vi, afterEach } from 'vitest'
import { Config, validateReviewerEngine, applyVerdictGates } from '../src/config.ts'
import type { Config as ConfigShape } from '../src/config.ts'
import { runLunaReviewer, buildLunaRequest, parseLunaVerdict, type LunaOptions } from '../src/luna-reviewer.ts'
import { effectiveReviewerModel } from '../src/model-override.ts'
import { reviewerModelChoices } from '../src/client/model-choices.ts'
const config = (x: unknown = {}) => (Config as unknown as (x: unknown) => ConfigShape)(x)
const options: LunaOptions = { ...config().reviewer.luna, allowEgress: true, autoAllow: true, credential: 'test-only',
  evidence: { toolName: 'read', argumentsText: '{"path":"README.md"}', transcript: 'not transmitted', userIntent: 'Read README.md' } }
export function fixture(changes: Record<string, string | number> = {}) {
  const body = buildLunaRequest(options.model, options.evidence)
  return { model: options.model, answers: body.questions.map(q => {
    const defaults: Record<string, string> = { permit_decision: 'permit', intrinsic_risk: 'low', user_authorization: 'high' }
    if (q.type === 'predicate') return { name: q.name, type: q.type, probability: changes[q.name] ?? (q.name === 'scope_bounded' ? 1 : 0) }
    const choice = changes[q.name] ?? defaults[q.name]
    const p = typeof changes.probability === 'number' ? changes.probability : 1
    return { name: q.name, type: q.type, choice, confidence: 0.2,
      probabilities: q.choices!.map(c => ({value: c.value, probability: c.value === choice ? p : (1-p)/(q.choices!.length-1)})) }
  }) }
}
const send = (payload = fixture()) => vi.fn<typeof fetch>(async () => Response.json(payload))
afterEach(() => vi.useRealTimers())
describe('native Luna contract (mock only)', () => {
  it('allows bounded low risk only with explicit autoAllow', async () => {
    const result = await runLunaReviewer({...options, fetchImpl: send()})
    expect(result.verdict).toMatchObject({decision:'allow', risk:'low', uncertain:false})
    expect(applyVerdictGates(config(),result.verdict).action).toBe('allow')
    expect(parseLunaVerdict(fixture(), {...options, autoAllow:false}).uncertain).toBe(true)
  })
  it('uses official questions array and sends only minimal evidence, key only in header', async () => {
    const fetchImpl = send(); await runLunaReviewer({...options, fetchImpl})
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe('https://api.openai.com/v1/decisions')
    expect(init?.redirect).toBe('error')
    expect(init?.body).not.toContain('test-only'); expect(init?.body).not.toContain('not transmitted')
    expect(JSON.parse(String(init?.body)).questions[0]).toMatchObject({type:'choice',name:'permit_decision'})
  })
  it('denies sensitive targets without transmitting and delegates arbitrary shell', async () => {
    const fetchImpl = send()
    expect((await runLunaReviewer({...options,fetchImpl,evidence:{...options.evidence,argumentsText:'read .credentials.yaml'}})).verdict?.decision).toBe('deny')
    expect((await runLunaReviewer({...options,fetchImpl,evidence:{...options.evidence,toolName:'bash',argumentsText:'rm -rf /'}})).verdict?.uncertain).toBe(true)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('denies model prohibition regardless of confident permit', () => {
    expect(parseLunaVerdict(fixture({prohibited_exfiltration:0.5}),options).decision).toBe('deny')
  })
  it.each([0.9899,0.99,0.9901])('uses selected probability, not confidence, at %s', p => {
    expect(parseLunaVerdict(fixture({probability:p}),options).uncertain).toBe(p<0.99)
  })
  it('delegates uncertainty and respects common critical gate', () => {
    expect(parseLunaVerdict(fixture({permit_decision:'uncertain'}),options).uncertain).toBe(true)
    const verdict=parseLunaVerdict(fixture({intrinsic_risk:'critical'}),options)
    expect(applyVerdictGates(config(),verdict).action).toBe('deny')
  })
  it.each([401,403,429,500])('fails closed for HTTP %s without response text leaks', async status => {
    const result=await runLunaReviewer({...options,fetchImpl:async()=>new Response('test-only',{status})})
    expect(result.verdict).toBeUndefined(); expect(result.failure).toBe(`luna: HTTP ${status}`)
  })
  it.each(['missing','duplicate','refusal','nan','range','sum','type','unknown','model','confidence'])('rejects malformed %s', kind => {
    const payload:any=fixture()
    if(kind==='missing') payload.answers.pop()
    if(kind==='duplicate') payload.answers[1]=payload.answers[0]
    if(kind==='refusal') payload.answers[0].type='refusal'
    if(kind==='nan') payload.answers[3].probability=NaN
    if(kind==='range') payload.answers[3].probability=2
    if(kind==='sum') payload.answers[0].probabilities[0].probability=0.1
    if(kind==='type') payload.answers[0].type='predicate'
    if(kind==='unknown') payload.answers[0].choice='execute'
    if(kind==='model') payload.model='unexpected'
    if(kind==='confidence') delete payload.answers[0].confidence
    expect(()=>parseLunaVerdict(payload,options)).toThrow('invalid or incomplete')
  })
  it('times out and aborts transport', async () => {
    vi.useFakeTimers()
    const pending=runLunaReviewer({...options,timeoutMs:1000,fetchImpl:async(_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new Error('test-only'))))})
    await vi.advanceTimersByTimeAsync(1001)
    expect((await pending).failure).toContain('timed out')
  })
  it('sanitizes transport errors and rejects non-JSON / oversized bodies', async () => {
    for(const fetchImpl of [async()=>{throw Error('test-only')},async()=>new Response('not JSON'),async()=>new Response('x'.repeat(65537))]) {
      const result=await runLunaReviewer({...options,fetchImpl})
      expect(result.verdict).toBeUndefined();expect(result.failure).not.toContain('test-only')
    }
  })
  it('validates egress and supported protocol before dispatch', async () => {
    const fetchImpl=send()
    for(const patch of [{allowEgress:false},{model:'wrong'},{endpoint:'https://example.com/decisions'},{credential:undefined}]) {
      expect((await runLunaReviewer({...options,...patch,fetchImpl})).failure).toBeDefined()
    }
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(validateReviewerEngine(config({reviewer:{engine:'luna'}})).errors.join()).toContain('allowEgress')
  })
  it('only exposes Luna through existing picker with egress consent',()=>{
    expect(reviewerModelChoices(false,[],true)).toEqual(['openai-decisions/gpt-6-luna'])
    const base={engine:'llm' as const,overrideEngine:'luna' as const,overrideModel:'gpt-6-luna',defaultProvider:'test',defaultModel:'test',jevPermitted:false}
    expect(effectiveReviewerModel(base).engine).toBe('llm')
    expect(effectiveReviewerModel({...base,lunaPermitted:true}).engine).toBe('luna')
  })
})

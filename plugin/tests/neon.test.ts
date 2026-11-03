import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const BASE = 'https://demo.supabase.co'
const KEY = 'sb_publishable_demo'
const LINKED = { url: BASE, key: KEY, token: 'nd_token', handle: 'gian' }
const START = { cwd: '/tmp/project', surface: 'terminal', isInteractive: true } as const
const HINT = '◢ neon · /neon link'

type Sent = { fn: string; url: string; headers: Record<string, string>; body: Record<string, unknown> }
type Reply = { status?: number; body: unknown }
type Responder = (fn: string, body: Record<string, unknown>) => Reply | undefined

function defaultReply(fn: string): Reply {
  if (fn === 'agent_ping') {
    return { body: { ok: true, handle: 'gian', turn: 1, open_bets: 0, duration_s: null, settled: [] } }
  }
  if (fn === 'device_overview') {
    return { body: { handle: 'gian', chips: 500, friends_online: 3, friends_working: 1 } }
  }
  if (fn === 'claim_pairing_code') return { body: { token: 'nd_fresh', handle: 'gian', device_id: 'd1' } }
  return { status: 404, body: { message: 'not found' } }
}

function world(on: On, store: Record<string, unknown>, respond?: Responder) {
  const sent: Sent[] = []
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  const data = new Map<string, unknown>(Object.entries(store))
  const clock = mock.clock(on, { now: 1_700_000_000_000 })
  on('store.get', ($, e) => ({ value: data.get(e.key) }))
  on('store.set', ($, e) => {
    data.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    data.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...data.keys()] }))
  on('command.register', () => ({ value: { command: 'neon' } }))
  on('ui.status', ($, e) => {
    statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', () => ({ result: {} }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('classic.PermissionRequest', () => ({}))
  on('http.fetch', ($, e) => {
    const fn = e.url.replace(BASE, '').replace('/rest/v1/rpc/', '').replace('/functions/v1/', 'fn:')
    const body = JSON.parse(e.init?.body ?? '{}') as Record<string, unknown>
    sent.push({ fn, url: e.url, headers: e.init?.headers ?? {}, body })
    const reply = respond?.(fn, body) ?? defaultReply(fn)
    const status = reply.status ?? 200
    return { value: { status, ok: status < 300, headers: {}, text: JSON.stringify(reply.body) } }
  })
  const pings = () => sent.filter(one => one.fn === 'agent_ping')
  const states = () => pings().map(one => one.body.p_state)
  return { sent, toasts, statuses, clock, data, pings, states }
}

async function neon($: Engine, args: string): Promise<string> {
  const result = await $.command.run({
    command: 'neon',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
  return result.text ?? ''
}

function finish(turnId: string) {
  return { answer: 'done', durationMs: 1_000, isAborted: false, turnId, reason: 'answer' } as const
}

test('link claims the code, stores the token and reports the drone', async ($, on) => {
  const w = world(on, {})
  await $.session.start(START)
  await w.clock.settle()
  expect(w.pings()).toHaveLength(0)
  expect(w.statuses.at(-1)).toBe(HINT)

  const reply = await neon($, `link ABCD-2345 ${BASE}/ ${KEY}`)
  await w.clock.settle()

  expect(reply).toContain('Linked as @gian')
  const claim = w.sent.find(one => one.fn === 'claim_pairing_code')
  expect(claim?.url).toBe(`${BASE}/rest/v1/rpc/claim_pairing_code`)
  expect(claim?.headers).toEqual({ apikey: KEY, 'Content-Type': 'application/json' })
  expect(claim?.body).toEqual({ p_code: 'ABCD-2345', p_device_name: 'Claude Code' })
  expect(w.data.get('token')).toBe('nd_fresh')
  expect(w.data.get('url')).toBe(BASE)
  expect(w.states()).toEqual(['idle'])
  expect(w.pings()[0]?.body.p_token).toBe('nd_fresh')
  expect(w.statuses.at(-1)).toBe('◢ neon · @gian · 3 online · 1 working')
})

test('a turn reports working, heartbeats while it runs, then idle', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await w.clock.settle()
  await $.turn.start({ text: 'fix the flaky test', turnId: 't1' })
  await w.clock.settle()
  await $.tool.call({ tool: 'Bash', command: 'npm test -- --grep secret' })
  await w.clock.settle()
  expect(w.states()).toEqual(['idle', 'working'])

  await w.clock.advance(60_000)
  expect(w.states()).toEqual(['idle', 'working', 'working'])

  await $.turn.complete(finish('t1'))
  await w.clock.settle()
  expect(w.states()).toEqual(['idle', 'working', 'working', 'idle'])

  await $.tool.call({ tool: 'Read', file_path: '/tmp/a.txt', agentId: 'background-1' })
  await w.clock.settle()
  expect(w.states()).toHaveLength(4)

  const keys = new Set(w.pings().map(one => one.body.p_session))
  expect(keys.size).toBe(1)
  expect(String(w.pings()[0]?.body.p_session)).toMatch(/^[a-z0-9]{24}$/)
  for (const ping of w.pings()) {
    expect(Object.keys(ping.body).sort()).toEqual(['p_label', 'p_session', 'p_state', 'p_token', 'p_tool'])
    expect(ping.body.p_tool).toBeNull()
  }
  expect(JSON.stringify(w.sent)).not.toContain('flaky')
  expect(JSON.stringify(w.sent)).not.toContain('secret')
  expect(JSON.stringify(w.sent)).not.toContain('/tmp')
})

test('tool names stay private until /neon tools on', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await $.turn.start({ text: '', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.advance(60_000)
  expect(w.pings().every(one => one.body.p_tool === null)).toBe(true)

  expect(await neon($, 'tools on')).toContain('now show at the bar')
  await $.tool.call({ tool: 'Read', file_path: '/Users/someone/private/notes.md' })
  await w.clock.advance(60_000)
  const last = w.pings().at(-1)
  expect(last?.body.p_state).toBe('working')
  expect(last?.body.p_tool).toBe('Read')
  expect(JSON.stringify(w.sent)).not.toContain('notes.md')

  expect(await neon($, 'tools off')).toContain('stay on this machine')
  await w.clock.settle()
  expect(w.pings().at(-1)?.body.p_tool).toBeNull()
})

test('pause and unlink stop the pings', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await w.clock.settle()

  expect(await neon($, 'pause')).toContain('Paused')
  await w.clock.settle()
  expect(w.states().at(-1)).toBe('offline')
  const whilePaused = w.pings().length
  await $.turn.start({ text: '', turnId: 't1' })
  await w.clock.advance(120_000)
  await $.turn.complete(finish('t1'))
  await w.clock.settle()
  expect(w.pings()).toHaveLength(whilePaused)
  expect(w.statuses.at(-1)).toBe('◢ neon · @gian · paused')

  expect(await neon($, 'resume')).toContain('Resumed')
  await w.clock.settle()
  expect(w.states().at(-1)).toBe('idle')

  expect(await neon($, 'unlink')).toContain('Unlinked')
  await w.clock.settle()
  expect(w.states().at(-1)).toBe('offline')
  expect(w.data.get('token')).toBeUndefined()
  expect(w.statuses.at(-1)).toBe(HINT)
  const afterUnlink = w.pings().length
  await $.turn.start({ text: '', turnId: 't2' })
  await w.clock.advance(60_000)
  expect(w.pings()).toHaveLength(afterUnlink)
})

test('a permission prompt shows the drone waiting until the call moves on', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await $.turn.start({ text: '', turnId: 't1' })
  await w.clock.settle()
  await $.classic.PermissionRequest({ tool_name: 'Bash', tool_input: { command: 'rm -rf build' } })
  await w.clock.settle()
  expect(w.states().at(-1)).toBe('waiting')

  await $.tool.call({ tool: 'Bash', command: 'rm -rf build' })
  await w.clock.settle()
  expect(w.states()).toEqual(['idle', 'working', 'waiting', 'working'])
  expect(JSON.stringify(w.sent)).not.toContain('rm -rf')
})

test('a revoked device token is forgotten', async ($, on) => {
  const revoked = { status: 401, body: { code: '28000', message: 'unknown device token, run /neon link again' } }
  const w = world(on, LINKED, fn => (fn === 'agent_ping' || fn === 'device_overview' ? revoked : undefined))
  await $.session.start(START)
  await w.clock.settle()
  expect(w.data.get('token')).toBeUndefined()
  expect(w.statuses.at(-1)).toBe(HINT)
  expect(await neon($, 'status')).toContain('Not linked')
})

test('bets riding on a job and their payout show as toasts', async ($, on) => {
  let open = 0
  const w = world(on, LINKED, (fn, body) => {
    if (fn !== 'agent_ping') return undefined
    if (body.p_state === 'idle' && open > 0) {
      const settled = [{ bettor: 'vapor_vic', pick: 'grind', amount: 50, payout: 150, status: 'won' }]
      return { body: { ok: true, handle: 'gian', turn: 1, open_bets: 0, duration_s: 102, settled } }
    }
    const turn = body.p_state === 'idle' ? 0 : 1
    return { body: { ok: true, handle: 'gian', turn, open_bets: open, duration_s: null, settled: [] } }
  })
  await $.session.start(START)
  await $.turn.start({ text: '', turnId: 't1' })
  await w.clock.settle()
  expect(w.toasts).toHaveLength(0)

  open = 2
  await w.clock.advance(60_000)
  expect(w.toasts).toEqual(['🎲 2 bets riding on this job'])
  await w.clock.advance(60_000)
  expect(w.toasts).toHaveLength(1)

  await $.turn.complete(finish('t1'))
  await w.clock.settle()
  expect(w.toasts.at(-1)).toBe('Job done in 1:42 · vapor_vic won 150 on GRIND')
})

test('approve shows who is asking and only signs in after a yes', async ($, on) => {
  const w = world(on, LINKED, fn => {
    if (fn === 'peek_login_request') {
      const created = new Date(1_700_000_000_000 - 120_000).toISOString()
      return { body: { client: 'Chrome on macOS', created_at: created, handle: 'gian' } }
    }
    if (fn === 'fn:claude-login') return { body: { ok: true, handle: 'gian' } }
    return undefined
  })
  await $.session.start(START)
  await w.clock.settle()

  const first = await neon($, 'approve WXYZ-2345')
  expect(first).toContain('Chrome on macOS')
  expect(first).toContain('2 min ago')
  expect(first).toContain('/neon approve WXYZ-2345 yes')
  expect(w.sent.find(one => one.fn === 'peek_login_request')?.body).toEqual({ p_token: 'nd_token', p_code: 'WXYZ-2345' })
  expect(w.sent.some(one => one.fn === 'fn:claude-login')).toBe(false)

  const second = await neon($, 'approve WXYZ-2345 yes')
  expect(second).toContain('Signed that browser in as @gian')
  const login = w.sent.find(one => one.fn === 'fn:claude-login')
  expect(login?.url).toBe(`${BASE}/functions/v1/claude-login`)
  expect(login?.body).toEqual({ token: 'nd_token', code: 'WXYZ-2345' })
})

test('a legacy JWT anon key also rides as a bearer token', async ($, on) => {
  const legacy = 'eyJhbGciOiJIUzI1NiJ9.demo.sig'
  const w = world(on, { ...LINKED, key: legacy })
  await $.session.start(START)
  await w.clock.settle()
  expect(w.pings()[0]?.headers).toEqual({
    apikey: legacy,
    'Content-Type': 'application/json',
    Authorization: `Bearer ${legacy}`,
  })
})

test('ending the session sends the drone home, /clear does not', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await w.clock.settle()
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  await w.clock.settle()
  expect(w.states()).toEqual(['idle'])

  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's2', resume: { id: 's2' } })
  await w.clock.settle()
  expect(w.states()).toEqual(['idle', 'offline'])
})

test('a label rides along once set', async ($, on) => {
  const w = world(on, LINKED)
  await $.session.start(START)
  await w.clock.settle()
  expect(await neon($, 'label   thesis grind  ')).toContain('"thesis grind"')
  await w.clock.settle()
  expect(w.pings().at(-1)?.body.p_label).toBe('thesis grind')
  expect(await neon($, 'label off')).toBe('Label cleared.')
  await w.clock.settle()
  expect(w.pings().at(-1)?.body.p_label).toBeNull()
})

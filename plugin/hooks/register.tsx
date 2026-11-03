import type { EngineInterface, Register } from 'claude-code'

import type { AgentState, NeonSession } from '../types'

type Engine = EngineInterface

type Config = {
  url: string
  key: string
  token: string
  handle: string
  label: string
  shareTools: boolean
  paused: boolean
}

type Settled = {
  bettor: string
  pick: string
  amount: number
  payout: number
  status: string
}

type PingReply = {
  handle?: string
  turn?: number
  open_bets?: number
  duration_s?: number | null
  settled?: Settled[]
}

type Overview = {
  handle?: string
  friends_online?: number
  friends_working?: number
}

type Change = {
  state: AgentState
  announce?: boolean
  onlyFrom?: AgentState
  tool?: string | null
  force?: boolean
  heartbeat?: boolean
}

const SESSION = { plugin: 'neon-daemon', key: 'session' } as const
const PING = { plugin: 'neon-daemon', key: 'ping' } as const

const HEARTBEAT_MS = 60_000
const OVERVIEW_MS = 120_000
const CONFIG_TTL_MS = 15_000
const PERSON_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode'])
const HINT = '◢ neon · /neon link'

const PICKS: Record<string, string> = {
  flash: 'FLASH',
  grind: 'GRIND',
  marathon: 'MARATHON',
  permission: 'PERMISSION',
  clean: 'CLEAN RUN',
}

const STATE_WORDS: Record<AgentState, string> = {
  idle: 'chilling at the bar',
  working: 'working',
  waiting: 'needs you',
  offline: 'offline',
}

const HELP = [
  '/neon status                    where things stand',
  '/neon link <CODE> <url> <key>   link this Claude Code (copy the whole line from the bar)',
  '/neon approve <CODE>            sign a browser in to the bar with this Claude Code',
  '/neon label <text> | off        a name shown above your drone',
  '/neon tools on | off            share tool names like Bash or Edit, never their inputs',
  '/neon pause | resume            stop or restart reporting',
  '/neon unlink                    forget the link on this machine',
  '',
  'Only your agent\'s state leaves this machine (plus a label or tool names if you turn them on). Never prompts, code, or paths.',
].join('\n')

let queue: Promise<void> = Promise.resolve()
let cached: { config: Config; at: number } | null = null

function errText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function randomKey(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, byte => alphabet.charAt(byte % alphabet.length)).join('')
}

function shortTool(tool: string): string {
  if (tool.startsWith('mcp__')) {
    const parts = tool.split('__')
    return `mcp:${parts[parts.length - 1] ?? 'tool'}`.slice(0, 24)
  }
  return tool.slice(0, 24)
}

function normalizeUrl(value: string | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(trimmed) || !URL.canParse(trimmed)) return ''
  return trimmed
}

function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).host : url
}

function minutesSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 90) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min ago`
  return `${Math.round(minutes / 60)} h ago`
}

function settledLine(duration: number | null | undefined, settled: Settled[]): string {
  const head = typeof duration === 'number' ? `Job done in ${minutesSeconds(duration)}` : 'Job ended'
  const parts = settled.slice(0, 3).map(bet => {
    const pick = PICKS[bet.pick] ?? bet.pick.toUpperCase()
    if (bet.status === 'won') return `${bet.bettor} won ${bet.payout} on ${pick}`
    if (bet.status === 'refunded') return `${bet.bettor} got ${bet.amount} back`
    return `${bet.bettor} lost ${bet.amount} on ${pick}`
  })
  const more = settled.length > 3 ? [`+${settled.length - 3} more`] : []
  return [head, ...parts, ...more].join(' · ')
}

async function loadConfig($: Engine): Promise<Config> {
  const now = await $.clock.now()
  if (cached && now - cached.at < CONFIG_TTL_MS) return cached.config
  const [url, key, token, handle, label, shareTools, paused] = await Promise.all(
    ['url', 'key', 'token', 'handle', 'label', 'shareTools', 'paused'].map(name => $.store.get(name)),
  )
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const config: Config = {
    url: text(url),
    key: text(key),
    token: text(token),
    handle: text(handle),
    label: text(label),
    shareTools: shareTools === true,
    paused: paused === true,
  }
  cached = { config, at: now }
  return config
}

async function saveConfig($: Engine, patch: Partial<Config>): Promise<void> {
  for (const [name, value] of Object.entries(patch)) {
    if (value === '' || value === undefined) await $.store.delete(name)
    else await $.store.set(name, value)
  }
  cached = null
}

function isLinked(config: Config): boolean {
  return Boolean(config.url && config.key && config.token)
}

function headersFor(key: string): Record<string, string> {
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' }
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  return headers
}

function messageOf(text: string, status: number): string {
  const fallback = text.trim().slice(0, 200) || `HTTP ${status}`
  try {
    const data: unknown = JSON.parse(text)
    if (data && typeof data === 'object') {
      for (const field of ['message', 'error', 'msg']) {
        const value = (data as Record<string, unknown>)[field]
        if (typeof value === 'string' && value) return value
      }
    }
  } catch {
    return fallback
  }
  return fallback
}

async function post($: Engine, url: string, key: string, path: string, body: unknown): Promise<unknown> {
  const response = await $.http.fetch(`${url}${path}`, {
    method: 'POST',
    headers: headersFor(key),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(messageOf(response.text, response.status))
  if (!response.text) return null
  try {
    return JSON.parse(response.text)
  } catch {
    return response.text
  }
}

function rpc($: Engine, config: Config, fn: string, body: unknown): Promise<unknown> {
  return post($, config.url, config.key, `/rest/v1/rpc/${fn}`, body)
}

async function ensureSession($: Engine): Promise<{ session: NeonSession; isNew: boolean }> {
  const held = await $.state.get(SESSION)
  if (held.value) return { session: held.value, isNew: false }
  const session: NeonSession = {
    key: randomKey(),
    state: 'idle',
    reported: null,
    sentAt: 0,
    tool: null,
    job: 0,
    betsSeen: 0,
  }
  await $.state.set(SESSION, session)
  return { session, isNew: true }
}

function enqueue(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task).catch(() => undefined)
  queue = run
  return run
}

function observe($: Engine, change: Change): Promise<void> {
  return enqueue(() => step($, change))
}

async function step($: Engine, change: Change): Promise<void> {
  const { session } = await ensureSession($)
  if (change.onlyFrom !== undefined && session.state !== change.onlyFrom) return
  const actual = change.announce ? session.state : change.state
  const tool = actual === 'working' ? (change.tool !== undefined ? change.tool : session.tool) : null
  const wire = change.state
  const config = await loadConfig($)
  const now = await $.clock.now()
  const window = change.heartbeat ? HEARTBEAT_MS - 5_000 : HEARTBEAT_MS
  const isDue = now - session.sentAt >= window
  const shouldSend =
    isLinked(config) && !config.paused && (wire !== session.reported || change.force === true || isDue)
  const updated: NeonSession = shouldSend
    ? { ...session, state: actual, tool, reported: wire, sentAt: now }
    : { ...session, state: actual, tool }
  await $.state.set(SESSION, updated)
  if (!shouldSend) return
  try {
    const reply = (await rpc($, config, 'agent_ping', {
      p_token: config.token,
      p_session: session.key,
      p_state: wire,
      p_label: config.label || null,
      p_tool: config.shareTools && wire === 'working' && tool ? tool : null,
    })) as PingReply | null
    await $.state.set(PING, { at: now, ok: true, state: wire, message: 'ok' })
    if (reply && typeof reply === 'object') await afterReply($, wire, reply)
  } catch (error) {
    const message = errText(error)
    await $.state.set(PING, { at: now, ok: false, state: wire, message })
    if (/unknown device token/i.test(message)) await forget($)
  }
}

async function afterReply($: Engine, wire: AgentState, reply: PingReply): Promise<void> {
  const session = (await $.state.get(SESSION)).value
  if (!session) return
  if (typeof reply.handle === 'string' && reply.handle) {
    const config = await loadConfig($)
    if (config.handle !== reply.handle) await saveConfig($, { handle: reply.handle })
  }
  const job = typeof reply.turn === 'number' ? reply.turn : session.job
  let betsSeen = job === session.job ? session.betsSeen : 0
  const open = typeof reply.open_bets === 'number' ? reply.open_bets : 0
  if ((wire === 'working' || wire === 'waiting') && open > betsSeen) {
    $.ui.toast(`🎲 ${open} ${open === 1 ? 'bet' : 'bets'} riding on this job`)
    betsSeen = open
  }
  const settled = Array.isArray(reply.settled) ? reply.settled : []
  if (settled.length > 0) $.ui.toast(settledLine(reply.duration_s, settled), { timeoutMs: 8_000 })
  await $.state.set(SESSION, { ...session, job, betsSeen })
}

async function forget($: Engine): Promise<void> {
  await saveConfig($, { token: '', handle: '' })
  $.ui.status(HINT)
}

async function refreshStatus($: Engine): Promise<void> {
  const config = await loadConfig($)
  if (!isLinked(config)) {
    $.ui.status(HINT)
    return
  }
  const who = `@${config.handle || 'you'}`
  if (config.paused) {
    $.ui.status(`◢ neon · ${who} · paused`)
    return
  }
  try {
    const overview = (await rpc($, config, 'device_overview', { p_token: config.token })) as Overview | null
    const handle = overview?.handle || config.handle
    if (handle && handle !== config.handle) await saveConfig($, { handle })
    const online = overview?.friends_online ?? 0
    const working = overview?.friends_working ?? 0
    $.ui.status(`◢ neon · @${handle || 'you'} · ${online} online · ${working} working`)
  } catch (error) {
    if (/unknown device token/i.test(errText(error))) {
      await forget($)
      return
    }
    $.ui.status(`◢ neon · ${who} · bar unreachable`)
  }
}

async function heartbeat($: Engine): Promise<void> {
  const state = (await $.state.get(SESSION)).value?.state
  if (state === 'working' || state === 'waiting') await observe($, { state, heartbeat: true })
}

async function announceOffline($: Engine, waitMs: number): Promise<void> {
  if (waitMs <= 0) return
  await Promise.race([
    observe($, { state: 'offline', announce: true, force: true }),
    $.clock.sleep(waitMs),
  ])
}

async function resend($: Engine): Promise<void> {
  const state = (await $.state.get(SESSION)).value?.state ?? 'idle'
  await observe($, { state, force: true })
}

async function statusText($: Engine): Promise<string> {
  const config = await loadConfig($)
  const session = (await $.state.get(SESSION)).value
  const ping = (await $.state.get(PING)).value
  const now = await $.clock.now()
  const lines: string[] = []
  if (!isLinked(config)) {
    lines.push('Not linked. In the bar, open Link Claude Code and paste the /neon link line here.')
  } else {
    lines.push(`Linked as @${config.handle || '?'} on ${hostOf(config.url)}${config.paused ? ' · paused' : ''}`)
  }
  const label = config.label ? ` · label "${config.label}"` : ''
  const tools = config.shareTools ? 'shared' : 'private'
  lines.push(`Drone: ${session ? STATE_WORDS[session.state] : 'starting'}${label} · tool names ${tools}`)
  if (ping) {
    const result = ping.ok ? `ok (${STATE_WORDS[ping.state]})` : `failed: ${ping.message}`
    lines.push(`Last ping ${ago(now - ping.at)}: ${result}`)
  }
  lines.push('', HELP)
  return lines.join('\n')
}

async function link($: Engine, words: string[]): Promise<string> {
  const [code, urlArg, keyArg] = words
  if (!code) return 'Usage: /neon link <CODE> <supabase-url> <publishable-key>. Copy the whole line from the bar.'
  const stored = await loadConfig($)
  const url = normalizeUrl(urlArg ?? stored.url)
  const key = (keyArg ?? stored.key).trim()
  if (!url || !key) {
    return 'This Claude Code does not know which bar to talk to yet. Paste the whole /neon link line from the bar, URL and key included.'
  }
  try {
    const reply = (await post($, url, key, '/rest/v1/rpc/claim_pairing_code', {
      p_code: code,
      p_device_name: 'Claude Code',
    })) as { token?: string; handle?: string } | null
    if (!reply?.token) return 'The bar did not hand back a device token. Make a fresh code and try again.'
    await saveConfig($, { url, key, token: reply.token, handle: reply.handle ?? '', paused: false })
    void resend($)
    void refreshStatus($)
    return `Linked as @${reply.handle ?? '?'}. Your drone shows up at the bar whenever this Claude Code works.`
  } catch (error) {
    return `Link failed: ${errText(error)}`
  }
}

async function unlink($: Engine): Promise<string> {
  const config = await loadConfig($)
  if (!isLinked(config)) return 'Not linked.'
  if (!config.paused) await announceOffline($, 3_000)
  await forget($)
  return 'Unlinked. Your drone left the bar. Revoke this device on the website to cancel its token for good.'
}

async function approve($: Engine, words: string[]): Promise<string> {
  const config = await loadConfig($)
  if (!isLinked(config)) return 'Link this Claude Code first: /neon link <CODE> <url> <key>.'
  const [code, confirm] = words
  if (!code) return 'Usage: /neon approve <CODE>, with the code the bar shows under Sign in with Claude Code.'
  if ((confirm ?? '').toLowerCase() !== 'yes') {
    try {
      const peek = (await rpc($, config, 'peek_login_request', { p_token: config.token, p_code: code })) as {
        client?: string
        created_at?: string
        handle?: string
      } | null
      const started = peek?.created_at ? Date.parse(peek.created_at) : Number.NaN
      const when = Number.isFinite(started) ? ago((await $.clock.now()) - started) : 'just now'
      return [
        `A browser (${peek?.client || 'unknown browser'}) asked to sign in ${when}.`,
        'Only approve a code that is on your own screen right now: whoever started this sign-in gets into your account.',
        `Run /neon approve ${code} yes to sign that browser in as @${peek?.handle ?? config.handle}.`,
      ].join('\n')
    } catch (error) {
      return `Could not find that sign-in: ${errText(error)}`
    }
  }
  try {
    const reply = (await post($, config.url, config.key, '/functions/v1/claude-login', {
      token: config.token,
      code,
    })) as { ok?: boolean; handle?: string; error?: string } | null
    if (reply?.ok) return `Signed that browser in as @${reply.handle ?? config.handle}. It opens the bar in a few seconds.`
    return `Sign-in failed: ${reply?.error ?? 'no answer from the bar'}`
  } catch (error) {
    return `Sign-in failed: ${errText(error)}`
  }
}

async function setLabel($: Engine, text: string): Promise<string> {
  const value = text.trim()
  if (!value) {
    const config = await loadConfig($)
    return config.label
      ? `Label: "${config.label}". /neon label off clears it.`
      : 'No label. /neon label <text> sets one, 32 characters at most.'
  }
  if (value.toLowerCase() === 'off') {
    await saveConfig($, { label: '' })
    void resend($)
    return 'Label cleared.'
  }
  const label = value.slice(0, 32)
  await saveConfig($, { label })
  void resend($)
  return `Label set to "${label}". It shows above your drone at the bar.`
}

async function setTools($: Engine, word: string | undefined): Promise<string> {
  const choice = (word ?? '').toLowerCase()
  if (choice === 'on') {
    await saveConfig($, { shareTools: true })
    return 'Tool names (Bash, Edit, ...) now show at the bar. Their inputs never leave this machine.'
  }
  if (choice === 'off') {
    await saveConfig($, { shareTools: false })
    void resend($)
    return 'Tool names stay on this machine.'
  }
  const config = await loadConfig($)
  return `Tool names are ${config.shareTools ? 'shared' : 'private'}. /neon tools on | off`
}

async function pause($: Engine): Promise<string> {
  const config = await loadConfig($)
  if (config.paused) return 'Already paused. /neon resume brings your drone back.'
  if (isLinked(config)) await announceOffline($, 3_000)
  await saveConfig($, { paused: true })
  void refreshStatus($)
  return 'Paused. Your drone left the bar and nothing is sent until /neon resume.'
}

async function resume($: Engine): Promise<string> {
  const config = await loadConfig($)
  if (!config.paused) return 'Not paused.'
  await saveConfig($, { paused: false })
  void resend($)
  void refreshStatus($)
  return 'Resumed. Your drone is back at the bar.'
}

async function runCommand($: Engine, args: string): Promise<string> {
  const trimmed = args.trim()
  const words = trimmed.split(/\s+/).filter(Boolean)
  const sub = (words[0] ?? 'status').toLowerCase()
  const rest = words.slice(1)
  switch (sub) {
    case 'status':
      return statusText($)
    case 'help':
      return HELP
    case 'link':
      return link($, rest)
    case 'unlink':
      return unlink($)
    case 'approve':
      return approve($, rest)
    case 'label':
      return setLabel($, trimmed.replace(/^\S+\s*/, ''))
    case 'tools':
      return setTools($, rest[0])
    case 'pause':
      return pause($)
    case 'resume':
      return resume($)
    default:
      return `Unknown subcommand "${sub}".\n\n${HELP}`
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'neon',
      description: 'NEON DAEMON bar: link this Claude Code, approve sign-ins, privacy switches',
      argumentHint: '[status | link | approve | label | tools | pause | resume | unlink]',
      immediate: true,
    })
    let isNew = false
    await enqueue(async () => {
      isNew = (await ensureSession($)).isNew
    })
    if (isNew) void observe($, { state: 'idle', force: true })
    $.clock.every(HEARTBEAT_MS, () => {
      void heartbeat($)
    })
    $.clock.every(OVERVIEW_MS, () => {
      void refreshStatus($)
    })
    void refreshStatus($)
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) void observe($, { state: 'working', tool: null })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (next.origin.plugin !== 'engine') return next(e)
    const name = String(e.tool)
    if (e.agentId === undefined) {
      const needsPerson = PERSON_TOOLS.has(name)
      void observe($, { state: needsPerson ? 'waiting' : 'working', tool: shortTool(name) })
    } else {
      void observe($, { state: 'working', onlyFrom: 'waiting' })
    }
    const ran = await next(e)
    void observe($, { state: 'working', onlyFrom: 'waiting' })
    return ran
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === undefined && verdict.block === undefined) void observe($, { state: 'waiting' })
    return verdict
  })

  on('classic.Elicitation', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.block === undefined) void observe($, { state: 'waiting' })
    return verdict
  })

  on('classic.ElicitationResult', ($, e, next) => {
    void observe($, { state: 'working', onlyFrom: 'waiting' })
    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) void observe($, { state: 'idle' })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason !== 'clear' && e.reason !== 'resume') {
      await announceOffline($, Math.min(2_000, next.budget.remainingMs - 300))
    }
    return next(e)
  })

  on('command.run', { command: 'neon' }, async ($, e) => ({ text: await runCommand($, e.args) }))
}

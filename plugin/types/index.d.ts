export type AgentState = 'idle' | 'working' | 'waiting' | 'offline'

export type NeonSession = {
  key: string
  state: AgentState
  reported: AgentState | null
  sentAt: number
  tool: string | null
  job: number
  betsSeen: number
}

export type NeonPing = {
  at: number
  ok: boolean
  state: AgentState
  message: string
}

declare module 'claude-code' {
  interface PluginState {
    'neon-daemon': { session: NeonSession; ping: NeonPing }
  }
}

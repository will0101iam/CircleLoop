type Decision =
  | { decision: 'allow' }
  | { decision: 'deny'; code: 'COMMAND_NOT_ALLOWED'; message?: string }
  | { decision: 'ask'; reason: string }

const ALLOW = new Set(['git', 'pnpm', 'npm', 'node', 'python', 'python3'])
const DENY = new Set(['rm', 'sudo', 'chmod', 'chown', 'mkfs'])

export function getCommandPolicyDecision(input: { command: string; args?: string[] }): Decision {
  const cmd = input.command.trim()
  if (DENY.has(cmd)) {
    return { decision: 'deny', code: 'COMMAND_NOT_ALLOWED', message: `Command ${cmd} is blocked` }
  }
  if (!ALLOW.has(cmd)) {
    return { decision: 'ask', reason: `Command ${cmd} is not on allowlist` }
  }
  // deny dangerous patterns even on allowed commands
  if (cmd === 'git') {
    const args = input.args ?? []
    if (args.join(' ').includes('reset --hard') || args.join(' ').includes('clean -fd')) {
      return { decision: 'ask', reason: 'Dangerous git operation' }
    }
  }
  return { decision: 'allow' }
}


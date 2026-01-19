/**
 * Built-in Hook Rules
 * Pre-configured safety and warning rules for common scenarios
 */

import { HookRule } from '../../shared/types/hook.types';

export const builtInHookRules: HookRule[] = [
  // ============ Dangerous Commands ============

  // Dangerous rm command
  {
    id: 'block-dangerous-rm',
    name: 'Block Dangerous rm',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'rm\\s+-rf\\s+(/|~|\\$HOME)',
      },
    ],
    action: 'block',
    message: `
⚠️ **Dangerous rm command detected!**

This command could delete critical system files.

Please:
- Verify the path is correct
- Use a more specific path
- Consider using trash instead of rm
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // Force push warning
  {
    id: 'block-force-push',
    name: 'Block Force Push',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'git\\s+push.*--force|git\\s+push.*-f',
      },
    ],
    action: 'block',
    message: `
🛑 **Force push blocked!**

Force pushing can rewrite history and cause issues for collaborators.

If you really need to force push:
- Ensure no one else is working on this branch
- Consider using --force-with-lease instead
- Get explicit approval from the user
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // Dangerous git commands
  {
    id: 'warn-git-reset-hard',
    name: 'Git Reset Hard Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'git\\s+reset\\s+--hard',
      },
    ],
    action: 'warn',
    message: `
⚠️ **git reset --hard detected**

This will discard uncommitted changes permanently.

Make sure:
- You've saved any work you want to keep
- You have a backup if needed
- You understand what will be lost
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // ============ Sensitive Files ============

  // Sensitive file warning
  {
    id: 'warn-sensitive-files',
    name: 'Sensitive File Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write|MultiEdit',
    conditions: [
      {
        field: 'filePath',
        operator: 'regex_match',
        pattern: '\\.env$|\\.env\\.|credentials|secrets|password|api.?key',
      },
    ],
    action: 'warn',
    message: `
🔐 **Sensitive file detected**

You're editing a file that may contain sensitive data:
- Ensure credentials are not hardcoded
- Use environment variables for secrets
- Verify this file is in .gitignore
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // SSH key warning
  {
    id: 'block-ssh-key-edit',
    name: 'SSH Key Edit Block',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write|MultiEdit',
    conditions: [
      {
        field: 'filePath',
        operator: 'regex_match',
        pattern: '\\.ssh/|id_rsa|id_ed25519|id_ecdsa',
      },
    ],
    action: 'block',
    message: `
🔒 **SSH key file modification blocked!**

Modifying SSH key files is extremely dangerous and could:
- Lock you out of remote systems
- Expose private keys
- Break authentication

This operation requires explicit user approval.
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // ============ Code Quality ============

  // Console.log in production code
  {
    id: 'warn-console-log',
    name: 'Console.log Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write',
    conditions: [
      { field: 'newContent', operator: 'contains', pattern: 'console.log' },
      { field: 'filePath', operator: 'not_contains', pattern: '.test.' },
      { field: 'filePath', operator: 'not_contains', pattern: '.spec.' },
    ],
    action: 'warn',
    message: `
📋 **console.log detected**

Consider using a proper logger instead of console.log for production code.
If this is for debugging, remember to remove it before committing.
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // Hardcoded credentials
  {
    id: 'warn-hardcoded-secrets',
    name: 'Hardcoded Secrets Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write',
    conditions: [
      {
        field: 'newContent',
        operator: 'regex_match',
        pattern: '(api[_-]?key|password|secret|token)\\s*[=:]\\s*["\'][^"\']{8,}["\']',
      },
    ],
    action: 'warn',
    message: `
🔑 **Possible hardcoded secret detected!**

It looks like you might be hardcoding a secret value. Please:
- Use environment variables instead
- Store secrets in a secure vault
- Never commit secrets to version control
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // TODO comments
  {
    id: 'warn-todo-comments',
    name: 'TODO Comment Warning',
    enabled: false, // Disabled by default - can be noisy
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write',
    conditions: [
      {
        field: 'newContent',
        operator: 'regex_match',
        pattern: '//\\s*(TODO|FIXME|HACK|XXX):?',
      },
    ],
    action: 'warn',
    message: `
📝 **TODO comment detected**

You're adding a TODO comment. Consider:
- Creating a ticket/issue for tracking
- Including enough context to understand later
- Setting a deadline if appropriate
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // ============ Dangerous Operations ============

  // Database drop warning
  {
    id: 'block-database-drop',
    name: 'Database Drop Block',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'DROP\\s+(DATABASE|TABLE|SCHEMA)|dropDatabase|db\\.dropDatabase',
      },
    ],
    action: 'block',
    message: `
🗄️ **Database drop command blocked!**

This command would permanently delete database data.

This operation requires explicit user confirmation.
- Verify you have backups
- Confirm you're targeting the correct database
- Get explicit approval before proceeding
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // Package installation warning
  {
    id: 'warn-package-install',
    name: 'Package Installation Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'npm\\s+install|yarn\\s+add|pnpm\\s+add|pip\\s+install|gem\\s+install',
      },
    ],
    action: 'warn',
    message: `
📦 **Package installation detected**

Before installing packages, consider:
- Is this package from a trusted source?
- Are there any known vulnerabilities?
- Is this the right version for your project?
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // ============ System Protection ============

  // System config modification
  {
    id: 'block-system-config',
    name: 'System Config Block',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Edit|Write|Bash',
    conditions: [
      {
        field: 'filePath',
        operator: 'regex_match',
        pattern: '^/(etc|var/log|usr/local/bin)/',
      },
    ],
    action: 'block',
    message: `
🖥️ **System file modification blocked!**

This file is in a system directory. Modifying it could:
- Break system functionality
- Require elevated permissions
- Have security implications

This operation requires explicit user approval.
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // Sudo command warning
  {
    id: 'warn-sudo',
    name: 'Sudo Command Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: '^sudo\\s+|\\|\\s*sudo\\s+',
      },
    ],
    action: 'warn',
    message: `
⚡ **sudo command detected**

Running commands with elevated privileges can:
- Modify system files
- Install software system-wide
- Have unintended side effects

Make sure you understand what this command does.
`,
    source: 'built-in',
    createdAt: Date.now(),
  },

  // ============ Network Operations ============

  // Curl to unknown domains
  {
    id: 'warn-curl-pipe-bash',
    name: 'Curl Pipe Bash Warning',
    enabled: true,
    event: 'PreToolUse',
    toolMatcher: 'Bash',
    conditions: [
      {
        field: 'command',
        operator: 'regex_match',
        pattern: 'curl.*\\|.*bash|wget.*\\|.*bash|curl.*\\|.*sh',
      },
    ],
    action: 'block',
    message: `
🌐 **curl | bash pattern blocked!**

Piping curl output to a shell is dangerous:
- You can't review the script before execution
- The script could contain malicious code
- It bypasses normal security checks

Download the script first and review it before running.
`,
    source: 'built-in',
    createdAt: Date.now(),
  },
];

// Helper to get rules by source
export function getBuiltInRulesByEvent(event: string): HookRule[] {
  return builtInHookRules.filter(
    (r) => r.event === event || r.event === 'all'
  );
}

// Helper to get enabled rules count
export function getEnabledRulesCount(): number {
  return builtInHookRules.filter((r) => r.enabled).length;
}

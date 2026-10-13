// Magic's rewrite prompt is private (lexi-magic is a private repo) and this
// move is public, so the prompt is never copied in here. The dev server reads
// it at run time from a local lexi-magic clone, at origin/main, without
// touching that checkout:
//
//   git -C $MAGIC_REPO show $MAGIC_REF:packages/magic-config/src/index.ts
//
// MAGIC_REPO defaults to ~/Github/lexi-magic, MAGIC_REF to origin/main
// (run `git fetch` there to pick up a newer prompt).
// Only the four string constants are lifted, and each must be a plain string
// literal; nothing from that file is executed.

import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface MagicPrompt {
  system: string
  inputPreamble: string
  outputDirective: string
  questionDirective: string
}

const NAMES = ['system', 'inputPreamble', 'outputDirective', 'questionDirective'] as const
const LITERAL = /^\s*(`[^`$]*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')\s*$/

function literal(src: string, name: string): string {
  const start = src.indexOf(`export const ${name} =`)
  if (start < 0) throw new Error(`${name} not found`)
  const from = start + `export const ${name} =`.length
  const end = src.indexOf(';\n', from)
  const expr = src.slice(from, end)
  if (!LITERAL.test(expr)) throw new Error(`${name} is not a plain string literal`)
  const body = expr.trim()
  // A template literal with no ${…} is its raw text; a quoted literal is JSON-ish.
  if (body.startsWith('`')) return body.slice(1, -1)
  if (body.startsWith('"')) return JSON.parse(body) as string
  return JSON.parse('"' + body.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"') as string
}

let cached: MagicPrompt | null | undefined

export function loadMagicPrompt(env: Record<string, string>): MagicPrompt | null {
  if (cached !== undefined) return cached
  const repo = (env.MAGIC_REPO || join(homedir(), 'Github', 'lexi-magic')).replace(/^~(?=\/|$)/, homedir())
  const ref = env.MAGIC_REF || 'origin/main'
  try {
    const src = execFileSync('git', ['-C', repo, 'show', `${ref}:packages/magic-config/src/index.ts`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const out = Object.fromEntries(NAMES.map((n) => [n, literal(src, n)])) as unknown as MagicPrompt
    console.log(`[magic] prompt loaded from ${repo} @ ${ref}`)
    cached = out
  } catch (err) {
    console.warn(`[magic] Magic's prompt is unavailable (${(err as Error).message}). Rewrite is off; Translate still works.`)
    cached = null
  }
  return cached
}

/** Magic's prompt sandwich (wrapPrompt in packages/magic-config), same order. */
export function wrapPrompt(p: MagicPrompt, text: string, options?: { question?: boolean }): string {
  const parts = [p.inputPreamble, `<input>${text}</input>`, p.outputDirective]
  if (options?.question) parts.push(p.questionDirective)
  return parts.join('\n')
}

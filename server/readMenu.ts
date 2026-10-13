// The one AI call, and the one place this play leaves the phone: the menu
// photo goes to a cloud model. Magic's own Rewrite and Translate never do.
// Runs inside the Vite dev server so the key never reaches the browser. It
// only finds where items are printed; the words on a card are the menu's own.

import Anthropic from '@anthropic-ai/sdk'
import type { IncomingMessage, ServerResponse } from 'node:http'

const MODEL = 'claude-opus-5-5'

const SYSTEM = `You find the orderable items on a photographed menu. A person will tap an item on the photo and it becomes a card they hold up at the counter, so the tap target must sit exactly on the printed item.

Skip section headings, descriptions, notes, allergen keys, and prices on their own.

For each item return:
- name: exactly as printed. Do not translate, correct, or reword it.
- price: as printed, or an empty string.
- box: the item's tap target in pixels of the image you were given (x, y = top-left, w, h). Cover the name line, and the price when it sits on the same row. Tight, not padded.

List items in reading order: top to bottom, then left to right by column.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'price', 'box'],
        properties: {
          name: { type: 'string' },
          price: { type: 'string' },
          box: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'w', 'h'],
            properties: {
              x: { type: 'integer' },
              y: { type: 'integer' },
              w: { type: 'integer' },
              h: { type: 'integer' },
            },
          },
        },
      },
    },
  },
}

interface Body {
  image: string // base64 JPEG, no data: prefix
  width: number
  height: number
}

async function readBody(req: IncomingMessage): Promise<Body> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Body
}

/**
 * POST { image, width, height } → streams the model's JSON text as it is
 * written. The client pulls each finished item out of the stream, so items
 * light up on the photo one by one.
 */
export function readMenuHandler(env: Record<string, string>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      res.statusCode = 503
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'no-key' }))
      return
    }

    let body: Body
    try {
      body = await readBody(req)
    } catch {
      res.statusCode = 400
      res.end()
      return
    }

    const effort = (['low', 'medium', 'high'] as const).find((e) => e === env.MENU_EFFORT) ?? 'low'
    const client = new Anthropic({ apiKey })

    res.statusCode = 200
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    res.setHeader('cache-control', 'no-store')

    try {
      const stream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort,
          format: { type: 'json_schema', schema: SCHEMA },
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: body.image },
              },
              {
                type: 'text',
                text: `The image is ${body.width}×${body.height} pixels. Read the menu.`,
              },
            ],
          },
        ],
      })
      stream.on('text', (delta) => res.write(delta))
      req.on('close', () => stream.abort())
      const final = await stream.finalMessage()
      if (final.stop_reason === 'refusal' || final.stop_reason === 'max_tokens') {
        res.write(`\n\u0000${final.stop_reason}`)
      }
      res.end()
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        res.end('\n\u0000bad-key')
      } else if (err instanceof Anthropic.RateLimitError) {
        res.end('\n\u0000rate-limit')
      } else if (err instanceof Anthropic.APIUserAbortError) {
        res.end()
      } else if (err instanceof Anthropic.APIError) {
        console.error('[read-menu]', err.status, err.message)
        res.end('\n\u0000api-error')
      } else {
        console.error('[read-menu]', err)
        res.end('\n\u0000api-error')
      }
    }
  }
}

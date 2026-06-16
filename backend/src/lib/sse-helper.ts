import type { FastifyReply } from 'fastify'

export function setupSSEHeaders(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
}

export function sendSSEEvent(reply: FastifyReply, event: string, data: string): void {
  reply.raw.write(`event: ${event}\ndata: ${data}\n\n`)
}

export function sendSSEData(reply: FastifyReply, data: string): void {
  reply.raw.write(`data: ${data}\n\n`)
}

export function closeSSE(reply: FastifyReply): void {
  reply.raw.end()
}

export function sendSSEError(reply: FastifyReply, message: string): void {
  sendSSEData(reply, JSON.stringify({ error: true, content: message }))
  closeSSE(reply)
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { mailDeliveryError, normalizeSmtpPassword, sendResendMessage } from './mail.js'

test('Gmail app passwords discard copy-formatting spaces without changing other SMTP passwords', () => {
  assert.equal(normalizeSmtpPassword(' SMTP.GMAIL.COM ', 'abcd efgh ijkl mnop'), 'abcdefghijklmnop')
  assert.equal(normalizeSmtpPassword('smtp.example.test', 'some password'), 'some password')
})

test('SMTP authentication failures explain credential and Gmail app-password checks', () => {
  const error = mailDeliveryError({ code: 'EAUTH' })
  assert.equal(error.status, 503)
  assert.match(error.message, /SMTP_USER and SMTP_PASSWORD/)
  assert.match(error.message, /Gmail requires an App Password/)
})

test('SMTP connection failures explain host and outbound connection checks', () => {
  const error = mailDeliveryError({ code: 'ETIMEDOUT' })
  assert.match(error.message, /SMTP_HOST and SMTP_PORT/)
  assert.match(error.message, /outbound SMTP/)
})

test('SMTP envelope failures explain sender and recipient checks', () => {
  const error = mailDeliveryError({ code: 'EENVELOPE' })
  assert.match(error.message, /SMTP_FROM and the customer email/)
})

test('SMTP provider rejection exposes only its response code, not server details', () => {
  const error = mailDeliveryError({
    responseCode: 550,
    response: 'private server response text',
  })
  assert.match(error.message, /response 550/)
  assert.doesNotMatch(error.message, /private server response text/)
})

test('Resend sends a verification email through its HTTPS API', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input)
    requestInit = init
    return new Response(null, { status: 200 })
  }
  try {
    await sendResendMessage({
      from: 'MAA Press <verify@example.com>',
      to: 'owner@example.com',
      subject: 'Verify your account',
      text: 'Open the verification link.',
      attachments: [{ filename: 'invoice.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' }],
    }, 'test-api-key')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(requestUrl, 'https://api.resend.com/emails')
  assert.ok(requestInit)
  assert.equal((requestInit.headers as Record<string, string>).Authorization, 'Bearer test-api-key')
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    from: 'MAA Press <verify@example.com>',
    to: ['owner@example.com'],
    subject: 'Verify your account',
    text: 'Open the verification link.',
    attachments: [{ filename: 'invoice.pdf', content: Buffer.from('pdf').toString('base64'), content_type: 'application/pdf' }],
  })
})

test('Resend rejection gives a safe actionable error without exposing provider response details', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response('private provider response', { status: 401 })
  try {
    await assert.rejects(
      sendResendMessage({ from: 'verify@example.com', to: 'owner@example.com', subject: 'Verify', text: 'Link' }, 'bad-key'),
      (error: unknown) => {
        const mapped = mailDeliveryError(error)
        assert.match(mapped.message, /RESEND_API_KEY/)
        assert.match(mapped.message, /verified sender/)
        assert.doesNotMatch(mapped.message, /private provider response/)
        return true
      },
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

import nodemailer from 'nodemailer'
import { config } from './config.js'

export class MailConfigurationError extends Error {
  readonly status = 503

  constructor() {
    super('Email is not configured. Add SMTP settings or a Resend API key and a verified sender to the API environment.')
    this.name = 'MailConfigurationError'
  }
}

export class MailDeliveryError extends Error {
  readonly status = 503

  constructor(message: string, readonly code?: string, readonly responseCode?: number) {
    super(message)
    this.name = 'MailDeliveryError'
  }
}

export function mailDeliveryError(error: unknown) {
  const code = errorProperty(error, 'code')
  const responseCode = errorProperty(error, 'responseCode')
  const message = errorProperty(error, 'message')?.toLowerCase() ?? ''

  if (code === 'EAUTH') {
    return new MailDeliveryError(
      'SMTP login was rejected. Check SMTP_USER and SMTP_PASSWORD in the API environment; Gmail requires an App Password, not your normal account password.',
    )
  }
  if (code === 'ERESEND') {
    if (responseCode === '401') {
      return new MailDeliveryError(
        'Resend rejected the API key (401). Revoke the exposed key, create a new Resend API key, update RESEND_API_KEY in the host environment, and redeploy.',
        code,
        Number(responseCode),
      )
    }
    if (responseCode === '403') {
      return new MailDeliveryError(
        'Resend denied this request (403). Check the API key permissions and verify your sending domain in Resend.',
        code,
        Number(responseCode),
      )
    }
    if (responseCode === '422') {
      return new MailDeliveryError(
        'Resend rejected the sender or email fields (422). Set RESEND_FROM to an address on a domain verified in Resend.',
        code,
        Number(responseCode),
      )
    }
    if (responseCode === '429') {
      return new MailDeliveryError('Resend rate limit reached (429). Wait briefly, then retry sending the verification email.', code, Number(responseCode))
    }
    return new MailDeliveryError(
      `Resend rejected the email request (HTTP ${responseCode ?? 'unknown'}). Check the Resend API key and verified sender.`,
      code,
      responseCode ? Number(responseCode) : undefined,
    )
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new MailDeliveryError('The SMTP host could not be resolved. Check SMTP_HOST in the API environment.')
  }
  if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ESOCKET' && message.includes('timeout')) {
    return new MailDeliveryError(
      'The API could not connect to the SMTP server. Check SMTP_HOST and SMTP_PORT, and confirm the hosting provider allows outbound SMTP connections.',
    )
  }
  if (code === 'EENVELOPE') {
    return new MailDeliveryError('The SMTP server rejected the sender or recipient. Check SMTP_FROM and the customer email address.')
  }
  if (message.includes('certificate') || message.includes('tls') || message.includes('ssl')) {
    return new MailDeliveryError('The SMTP TLS connection failed. Use port 465 for implicit TLS or port 587 for STARTTLS, as required by your provider.')
  }
  if (message.includes('fetch failed')) {
    return new MailDeliveryError('The API could not connect to the email provider over HTTPS. Check outbound network access and try again.')
  }
  if (responseCode && Number(responseCode) >= 500) {
    return new MailDeliveryError(
      `The SMTP provider rejected the message (response ${responseCode}). Check that SMTP_FROM is authorized and that the recipient address is accepted.`,
    )
  }
  return new MailDeliveryError(
    `SMTP could not deliver the message${code ? ` (${code})` : ''}. Check the API SMTP settings and provider logs.`,
  )
}

export function normalizeSmtpPassword(host: string, password: string) {
  return host.trim().toLowerCase() === 'smtp.gmail.com'
    ? password.replace(/\s+/g, '')
    : password
}

function errorProperty(error: unknown, key: string) {
  if (typeof error !== 'object' || error === null) return undefined
  const value = Reflect.get(error, key) as unknown
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

export function developmentVerificationLinksEnabled() {
  return config.NODE_ENV === 'development' && config.DEV_EMAIL_VERIFICATION_LINKS
}

export function emailDeliveryConfigured() {
  return config.RESEND_API_KEY
    ? Boolean(config.RESEND_FROM)
    : Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD && config.SMTP_FROM)
}

export function emailFromAddress() {
  return config.RESEND_API_KEY ? config.RESEND_FROM : config.SMTP_FROM
}

export function assertVerificationDeliveryConfigured() {
  if (!developmentVerificationLinksEnabled() && !emailDeliveryConfigured()) {
    throw new MailConfigurationError()
  }
}

export type EmailMessage = {
  from: string
  to: string
  subject: string
  text: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
}

export async function sendEmailMessage(message: EmailMessage) {
  if (config.RESEND_API_KEY) {
    await sendResendMessage({ ...message, from: config.RESEND_FROM })
    return
  }
  await mailTransport().sendMail(message)
}

export async function sendVerificationMessage(input: { email: string; name: string; url: string }) {
  if (developmentVerificationLinksEnabled()) {
    console.info(`[development-only email verification] ${input.email}: ${input.url}`)
    return
  }
  await sendEmailMessage({
    from: emailFromAddress(),
    to: input.email,
    subject: 'Verify your MAA business account',
    text: `Hello ${input.name}, verify your account within one hour: ${input.url}`,
  })
}

export async function sendResendMessage(message: EmailMessage, apiKey = config.RESEND_API_KEY) {
  if (!apiKey) throw new MailConfigurationError()
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map(({ filename, content, contentType }) => ({
              filename,
              content: content.toString('base64'),
              content_type: contentType,
            })),
          }
        : {}),
    }),
  })
  if (!response.ok) {
    throw new MailDeliveryError('Resend rejected the email request.', 'ERESEND', response.status)
  }
}

export function mailTransport() {
  if (!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASSWORD && config.SMTP_FROM)) {
    throw new MailConfigurationError()
  }
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    ...(config.SMTP_PORT === 587 ? { requireTLS: true } : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: { user: config.SMTP_USER, pass: normalizeSmtpPassword(config.SMTP_HOST, config.SMTP_PASSWORD) },
  })
}

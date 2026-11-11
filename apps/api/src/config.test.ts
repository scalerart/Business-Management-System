import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('production ignores development verification links without failing startup', () => {
  const configUrl = new URL('./config.ts', import.meta.url).href
  const script = `import { config } from ${JSON.stringify(configUrl)}; console.log(JSON.stringify({ nodeEnv: config.NODE_ENV, enabled: config.DEV_EMAIL_VERIFICATION_LINKS }))`
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DEV_EMAIL_VERIFICATION_LINKS: 'true',
      ALLOW_REMOTE_DEVELOPMENT_DATABASE: 'false',
      MONGODB_URI: 'mongodb://localhost/test',
      JWT_SECRET: 'a'.repeat(32),
    },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { nodeEnv: 'production', enabled: false })
  assert.match(result.stderr, /DEV_EMAIL_VERIFICATION_LINKS=true is ignored/)
})

test('Resend requires its own verified sender instead of falling back to the SMTP sender', () => {
  const mailUrl = new URL('./mail.ts', import.meta.url).href
  const script = `import { emailDeliveryConfigured, emailFromAddress } from ${JSON.stringify(mailUrl)}; console.log(JSON.stringify({ configured: emailDeliveryConfigured(), from: emailFromAddress() }))`
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      ALLOW_REMOTE_DEVELOPMENT_DATABASE: 'false',
      MONGODB_URI: 'mongodb://localhost/test',
      JWT_SECRET: 'a'.repeat(32),
      RESEND_API_KEY: 'test-key',
      RESEND_FROM: 'verified@example.test',
      SMTP_HOST: 'smtp.example.test',
      SMTP_USER: 'smtp-user@example.test',
      SMTP_PASSWORD: 'smtp-password',
      SMTP_FROM: 'unverified@example.test',
    },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), { configured: true, from: 'verified@example.test' })
})

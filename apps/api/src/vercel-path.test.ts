import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeVercelPath } from './vercel-path.js'

test('preserves Vercel API paths that already include the API prefix', () => {
  assert.equal(normalizeVercelPath('/api/customers?status=active'), '/api/customers?status=active')
  assert.equal(normalizeVercelPath('/api'), '/api')
})

test('adds the API prefix when Vercel provides a function-relative path', () => {
  assert.equal(normalizeVercelPath('/customers?status=active'), '/api/customers?status=active')
  assert.equal(normalizeVercelPath('/'), '/api/')
  assert.equal(normalizeVercelPath(undefined), '/api/')
})

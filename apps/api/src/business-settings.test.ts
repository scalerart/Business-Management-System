import assert from 'node:assert/strict'
import test from 'node:test'
import { businessSettingsPatchInput } from './business-settings.js'
import { paymentMethodSchema } from './domain/workflows.js'
import { Business, Product } from './models.js'

test('business settings normalize supported values and reject invalid configuration', () => {
  const parsed = businessSettingsPatchInput.parse({
    invoicePrefix: ' ab12 ',
    invoiceAccentColor: '#12abef',
    timeZone: 'Asia/Dhaka',
    paymentMethods: ['cash', 'bank', 'cash'],
  })

  assert.equal(parsed.invoicePrefix, 'AB12')
  assert.equal(parsed.invoiceAccentColor, '#12ABEF')
  assert.deepEqual(parsed.paymentMethods, ['cash', 'bank'])
  assert.equal(businessSettingsPatchInput.safeParse({ timeZone: 'Not/A_Timezone' }).success, false)
  assert.equal(businessSettingsPatchInput.safeParse({ paymentMethods: [] }).success, false)
  assert.equal(paymentMethodSchema.safeParse('custom').success, false)
})

test('new business settings and products receive the expected inheritance defaults', () => {
  const business = new Business({ name: 'Settings test' })
  const product = new Product({
    sku: 'SETTINGS-TEST',
    name: 'Settings test',
    category: 'Paper',
    unit: 'sheet',
  })

  assert.equal(business.invoicePrefix, 'INV')
  assert.equal(business.invoiceTermsDays, 0)
  assert.equal(business.timeZone, 'Asia/Dhaka')
  assert.equal(business.lowStockDefaultThreshold, 0)
  assert.deepEqual(business.paymentMethods, ['cash', 'bank', 'bkash', 'nagad', 'rocket', 'other'])
  assert.equal(product.reorderLevel, undefined)
})

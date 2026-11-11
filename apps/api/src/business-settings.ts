import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from './middleware.js'
import {
  Business,
  defaultBusinessTimeZone,
  defaultDateFormat,
  defaultExpenseCategories,
  defaultInvoiceEmailBody,
  defaultInvoiceEmailSubject,
  defaultPaymentMethods,
  paymentMethodValues,
} from './models.js'
import { recordAudit } from './domain/workflows.js'

export const businessSettingsInput = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40),
  email: z.string().trim().email().max(254).or(z.literal('')),
  address: z.string().trim().max(500),
  invoiceFooter: z.string().trim().max(500),
  invoicePrefix: z.string().trim().regex(/^[A-Za-z0-9]{2,8}$/).transform((value) => value.toUpperCase()),
  invoiceTermsDays: z.number().int().min(0).max(365),
  invoiceAccentColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).transform((value) => value.toUpperCase()),
  invoiceEmailSubject: z.string().trim().min(1).max(200),
  invoiceEmailBody: z.string().trim().min(1).max(2000),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase()),
  timeZone: z.string().trim().min(1).max(100).refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Enter a valid IANA timezone.'),
  dateFormat: z.enum(['dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']),
  lowStockDefaultThreshold: z.number().nonnegative().max(1_000_000),
  paymentMethods: z.array(z.enum(paymentMethodValues)).min(1).max(paymentMethodValues.length)
    .transform((methods) => [...new Set(methods)]),
  expenseCategories: z.array(z.string().trim().min(1).max(100)).max(50)
    .transform((categories) => [...new Set(categories)]),
})
export const businessSettingsPatchInput = businessSettingsInput.partial()

export const businessSettingsRouter = Router()
businessSettingsRouter.use(requireAuth)

businessSettingsRouter.get('/business/settings', async (req, res, next) => {
  try {
    const business = await Business.findById(req.authUser!.businessId).lean()
    if (!business) {
      res.status(404).json({ message: 'Business workspace not found.' })
      return
    }
    res.json({
      item: {
        name: business.name,
        phone: business.phone ?? '',
        email: business.email ?? '',
        address: business.address ?? '',
        invoiceFooter: business.invoiceFooter ?? '',
        invoicePrefix: business.invoicePrefix ?? 'INV',
        invoiceTermsDays: business.invoiceTermsDays ?? 0,
        invoiceAccentColor: business.invoiceAccentColor ?? '#238F85',
        invoiceLogoUrl: business.invoiceLogoUrl ?? '',
        invoiceEmailSubject: business.invoiceEmailSubject ?? defaultInvoiceEmailSubject,
        invoiceEmailBody: business.invoiceEmailBody ?? defaultInvoiceEmailBody,
        currency: business.currency ?? 'BDT',
        timeZone: business.timeZone ?? defaultBusinessTimeZone,
        dateFormat: business.dateFormat ?? defaultDateFormat,
        lowStockDefaultThreshold: business.lowStockDefaultThreshold ?? 0,
        paymentMethods: business.paymentMethods?.length ? business.paymentMethods : defaultPaymentMethods,
        expenseCategories: business.expenseCategories ?? defaultExpenseCategories,
      },
    })
  } catch (error) { next(error) }
})

businessSettingsRouter.patch('/business/settings', async (req, res, next) => {
  try {
    if (req.authUser?.role !== 'owner') {
      res.status(403).json({ message: 'Only the workspace owner can update business settings.' })
      return
    }
    const input = businessSettingsPatchInput.parse(req.body)
    if (Object.keys(input).length === 0) {
      res.status(400).json({ message: 'Provide at least one business setting to update.' })
      return
    }
    const business = await Business.findByIdAndUpdate(
      req.authUser!.businessId,
      { $set: input },
      { returnDocument: 'after', runValidators: true },
    )
    if (!business) {
      res.status(404).json({ message: 'Business workspace not found.' })
      return
    }
    await recordAudit(String(req.authUser!.id), 'updated', 'business', String(business._id), 'Updated business settings')
    res.json({
      item: {
        name: business.name,
        phone: business.phone ?? '',
        email: business.email ?? '',
        address: business.address ?? '',
        invoiceFooter: business.invoiceFooter ?? '',
        invoicePrefix: business.invoicePrefix ?? 'INV',
        invoiceTermsDays: business.invoiceTermsDays ?? 0,
        invoiceAccentColor: business.invoiceAccentColor ?? '#238F85',
        invoiceLogoUrl: business.invoiceLogoUrl ?? '',
        invoiceEmailSubject: business.invoiceEmailSubject ?? defaultInvoiceEmailSubject,
        invoiceEmailBody: business.invoiceEmailBody ?? defaultInvoiceEmailBody,
        currency: business.currency ?? 'BDT',
        timeZone: business.timeZone ?? defaultBusinessTimeZone,
        dateFormat: business.dateFormat ?? defaultDateFormat,
        lowStockDefaultThreshold: business.lowStockDefaultThreshold ?? 0,
        paymentMethods: business.paymentMethods?.length ? business.paymentMethods : defaultPaymentMethods,
        expenseCategories: business.expenseCategories ?? defaultExpenseCategories,
      },
    })
  } catch (error) { next(error) }
})

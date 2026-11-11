export type User = {
  id: string
  name: string
  email: string
  role: string
  businessId: string
  businessName: string
  platformAdmin: boolean
}

export type DashboardData = {
  range: { from: string; to: string }
  metrics: {
    salesMinor: number
    collectionsMinor: number
    outstandingMinor: number
    expensesMinor: number
    dailyNetProfitMinor: number
    monthlyNetProfitMinor: number
    yearlyNetProfitMinor: number
    activeCustomers: number
    orders: number
  }
  trends: {
    key: string
    label: string
    salesMinor: number
    collectionsMinor: number
    expensesMinor: number
  }[]
  expenseBreakdown: { category: string; amountMinor: number }[]
  recentOrders: {
    id: string
    orderNumber: string
    customerName: string
    amountMinor: number
    status: string
    orderDate: string
  }[]
  recentPayments: {
    id: string
    paymentNumber: string
    customerName: string
    amountMinor: number
    method: string
    receivedAt: string
  }[]
  outstandingOrders: {
    id: string
    orderNumber: string
    description: string
    customerId: string
    customerName: string
    invoiceId: string
    invoiceNumber: string
    dueMinor: number
    orderDate: string
    dueDate?: string
    status: string
  }[]
  topCustomers: { id: string; name: string; salesMinor: number }[]
}

export function normalizeVercelPath(url: string | undefined) {
  const requestUrl = url || '/'
  const queryIndex = requestUrl.indexOf('?')
  const pathname = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex)

  if (pathname === '/api' || pathname.startsWith('/api/')) return requestUrl
  return `/api${requestUrl.startsWith('/') ? requestUrl : `/${requestUrl}`}`
}

/* eslint-disable no-var */
declare global {
  var localB2BSchedulerInitialized: boolean | undefined
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Prevent duplicate scheduler instantiation during Next.js hot reloads in dev mode
    if (globalThis.localB2BSchedulerInitialized) {
      return
    }
    globalThis.localB2BSchedulerInitialized = true

    console.log('[scheduler] Starting Next.js B2B integrations background scheduler...')

    // Run a check every 1 minute
    setInterval(async () => {
      try {
        const now = new Date()
        
        // Trigger at the top of the hour (minute 00)
        if (now.getMinutes() === 0) {
          console.log(`[scheduler] Minute is 00. Triggering hourly B2B integration sync...`)
          
          const port = process.env.PORT || '3000'
          const secret = process.env.AUTOMATION_CRON_SECRET
          
          const url = `http://localhost:${port}/api/integrations/cron`
          const headers: Record<string, string> = {}
          if (secret) {
            headers['x-cron-secret'] = secret
          }
          
          const res = await fetch(url, { headers })
          if (!res.ok) {
            console.error(`[scheduler] Hourly B2B sync HTTP error: ${res.status} ${res.statusText}`)
          } else {
            const data = await res.json()
            console.log(`[scheduler] Hourly B2B sync response:`, JSON.stringify(data.summary || data))
          }
        }
      } catch (err) {
        console.error('[scheduler] Error in background scheduler loop:', err)
      }
    }, 60 * 1000)
  }
}

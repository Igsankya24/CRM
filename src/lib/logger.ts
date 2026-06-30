export async function logException({
  route,
  errorMsg,
  stack,
  api,
  dbQuery
}: {
  route: string;
  errorMsg: string;
  stack?: string;
  api?: string;
  dbQuery?: string;
}) {
  try {
    console.error(`[EXCEPTION] Route: ${route} | Error: ${errorMsg}`, stack);
    
    // Attempt to ship log to the API endpoint
    await fetch("/api/admin/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        route,
        errorMsg,
        stack,
        api,
        dbQuery
      })
    });
  } catch (err) {
    console.error("Failed to ship exception log to server:", err);
  }
}

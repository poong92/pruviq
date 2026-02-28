// Cloudflare Pages Function: Case-insensitive redirect for /coins/*
// Redirects /coins/BTCUSDT/ -> /coins/btcusdt/ (301 permanent)
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const lower = path.toLowerCase();
  
  // If path contains uppercase, redirect to lowercase
  if (path !== lower) {
    return Response.redirect(url.origin + lower, 301);
  }
  
  // Pass through to static file
  return context.next();
}

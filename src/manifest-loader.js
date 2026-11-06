// Injects the PWA manifest link with a subpath-aware absolute href
// (e.g. /sothh-dev/manifest.webmanifest). Lives in a module file rather than
// an inline <script> because the server CSP is script-src 'self'.
const match = window.location.pathname.match(/^\/([^/]+)/);
const base = match ? '/' + match[1] : '';
const link = document.createElement('link');
link.rel = 'manifest';
link.href = base + '/manifest.webmanifest';
document.head.appendChild(link);

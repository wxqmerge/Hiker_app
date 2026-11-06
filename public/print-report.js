// Click handler for documents opened by openHtmlInNewTab (report sheets).
// Loaded from our origin so it works under strict CSP (no inline scripts).
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('button[data-print]')) {
    window.print();
  }
});

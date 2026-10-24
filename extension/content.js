// Sends a small snapshot of the page to the background script for categorizing.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
  const clean = (s, n) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);

  try {
    api.runtime
      .sendMessage({
        type: 'page',
        url: location.href,
        desc: clean(meta?.content, 300),
        h1: clean(document.querySelector('h1')?.textContent, 200),
        text: clean(document.body?.innerText, 600),
      })
      .catch(() => {});
  } catch {
    // Extension reloaded; ignore.
  }
})();

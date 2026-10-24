// Tracks when each page was last viewed and stores a short text snapshot
// of each page (sent by content.js) so the popup can categorize tabs.
const api = globalThis.browser ?? globalThis.chrome;

const MAX_USAGE = 3000;
const MAX_PAGES = 400;

const urlKey = (url) => (url || '').split('#')[0];

// Keep only the newest `max` entries, ranked by `field`.
function prune(obj, max, field) {
  const keys = Object.keys(obj);
  if (keys.length <= max) return obj;
  keys.sort((a, b) => (obj[b][field] ?? 0) - (obj[a][field] ?? 0));
  for (const k of keys.slice(max)) delete obj[k];
  return obj;
}

async function touch(url) {
  if (!/^https?:/.test(url || '')) return;
  const key = urlKey(url);
  const { usage = {} } = await api.storage.local.get('usage');
  const entry = usage[key] ?? { visits: 0 };
  entry.lastUsed = Date.now();
  entry.visits += 1;
  usage[key] = entry;
  await api.storage.local.set({ usage: prune(usage, MAX_USAGE, 'lastUsed') });
}

async function savePage(msg) {
  const key = urlKey(msg.url);
  const { pages = {} } = await api.storage.local.get('pages');
  pages[key] = { desc: msg.desc, h1: msg.h1, text: msg.text, at: Date.now() };
  await api.storage.local.set({ pages: prune(pages, MAX_PAGES, 'at') });
}

api.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await api.tabs.get(tabId);
    await touch(tab.url);
  } catch {
    // Tab closed before we could read it.
  }
});

api.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status === 'complete' && tab.active) touch(tab.url);
});

api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'page') savePage(msg);
});

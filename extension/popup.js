const api = globalThis.browser ?? globalThis.chrome;

const DAY = 86_400_000;
const STALE = 'Stale (7d+)';
const USAGE_ORDER = ['Today', 'This week', STALE, 'Not tracked yet'];

const state = { tabs: [], saved: [], rules: [], view: 'topic', query: '' };
const $ = (sel) => document.querySelector(sel);

const urlKey = (url) => (url || '').split('#')[0];
// Looser key for duplicate detection: ignore hash and trailing slash.
const dupeKey = (url) => urlKey(url).replace(/\/$/, '');

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function ago(ts) {
  if (!ts) return 'not tracked yet';
  const min = Math.round((Date.now() - ts) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function usageBucket(ts) {
  if (!ts) return 'Not tracked yet';
  const age = Date.now() - ts;
  if (age < DAY) return 'Today';
  if (age < 7 * DAY) return 'This week';
  return STALE;
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function matchesQuery(title, url) {
  const q = state.query.toLowerCase();
  return !q || title.toLowerCase().includes(q) || url.toLowerCase().includes(q);
}

// Destructive buttons need a second tap within 3s (no confirm() dialogs in popups).
function onConfirmedTap(btn, armedLabel, action) {
  btn.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.armed) {
      await action();
      return;
    }
    const label = btn.textContent;
    btn.dataset.armed = '1';
    btn.textContent = armedLabel;
    setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = label;
    }, 3000);
  };
}

// Ids of duplicate tabs to close; the most recently used copy of each URL is kept.
function findDuplicates(tabs) {
  const byUrl = new Map();
  for (const t of tabs) {
    const key = dupeKey(t.url);
    if (!byUrl.has(key)) byUrl.set(key, []);
    byUrl.get(key).push(t);
  }
  const extras = new Set();
  for (const copies of byUrl.values()) {
    if (copies.length < 2) continue;
    copies.sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));
    for (const t of copies.slice(1)) extras.add(t.id);
  }
  return extras;
}

async function closeTabs(ids) {
  await api.tabs.remove(ids);
  state.tabs = state.tabs.filter((t) => !ids.includes(t.id));
  render();
}

async function openTab(tab) {
  await api.tabs.update(tab.id, { active: true });
  try { await api.windows?.update(tab.windowId, { focused: true }); } catch { /* not supported on iOS */ }
  window.close();
}

async function persistSaved() {
  await api.storage.local.set({ saved: state.saved });
}

async function saveAndClose(name, tabs) {
  state.saved.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    savedAt: Date.now(),
    tabs: tabs.map((t) => ({ title: t.title, url: t.url })),
  });
  await persistSaved();
  await closeTabs(tabs.map((t) => t.id));
}

async function restoreGroup(group) {
  for (const t of group.tabs) {
    try { await api.tabs.create({ url: t.url, active: false }); } catch { /* restricted URL */ }
  }
  state.saved = state.saved.filter((g) => g.id !== group.id);
  await persistSaved();
  await load();
}

async function deleteSaved(group) {
  state.saved = state.saved.filter((g) => g.id !== group.id);
  await persistSaved();
  render();
}

async function removeSavedTab(group, index) {
  group.tabs.splice(index, 1);
  if (group.tabs.length === 0) state.saved = state.saved.filter((g) => g.id !== group.id);
  await persistSaved();
  render();
}

function groupTabs(tabs) {
  const groups = new Map();
  for (const t of tabs) {
    const key = state.view === 'topic' ? `${t.topic.icon} ${t.topic.name}` : t.usage;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  for (const list of groups.values()) list.sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0));

  const entries = [...groups.entries()];
  if (state.view === 'usage') {
    entries.sort(([a], [b]) => USAGE_ORDER.indexOf(a) - USAGE_ORDER.indexOf(b));
  } else {
    // Biggest groups first, "Other" always last.
    const isOther = (k) => k.endsWith(` ${OTHER.name}`);
    entries.sort(([a, la], [b, lb]) => isOther(a) - isOther(b) || lb.length - la.length);
  }
  return entries;
}

function renderTab(t, dupes) {
  const isDupe = dupes.has(t.id);
  const meta = [isDupe ? 'duplicate' : '', t.host, ago(t.lastUsed), t.visits ? `${t.visits} visit${t.visits > 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join(' · ');
  const metaClass = isDupe ? ' dupe' : t.usage === STALE ? ' stale' : '';
  const open = el('button', { className: 'open', title: t.url },
    el('span', { className: 'title', textContent: t.title }),
    el('span', { className: `meta${metaClass}`, textContent: meta }));
  open.onclick = () => openTab(t);

  const close = el('button', { className: 'close', textContent: '×', ariaLabel: 'Close tab' });
  close.onclick = () => closeTabs([t.id]);

  return el('li', {}, open, close);
}

function renderOpenTabs(main, dupes) {
  const visible = state.tabs.filter((t) => matchesQuery(t.title, t.url));
  if (visible.length === 0) {
    main.append(el('p', { className: 'empty', textContent: state.query ? 'No matching tabs.' : 'No open tabs.' }));
    return;
  }

  for (const [name, tabs] of groupTabs(visible)) {
    const save = el('button', { className: 'plain', textContent: 'Save' });
    save.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      saveAndClose(name, tabs);
    };
    const closeAll = el('button', { className: 'danger', textContent: 'Close' });
    onConfirmedTap(closeAll, `Close ${tabs.length}?`, () => closeTabs(tabs.map((t) => t.id)));
    main.append(el('details', { open: true },
      el('summary', {},
        el('span', { className: 'name', textContent: name }),
        el('span', { className: 'count', textContent: tabs.length }),
        save,
        closeAll),
      el('ul', {}, ...tabs.map((t) => renderTab(t, dupes)))));
  }
}

async function persistRules() {
  await api.storage.local.set({ rules: state.rules });
  await load();
}

function renderRules(main) {
  const name = el('input', { placeholder: 'Group name (e.g. GitHub)', autocomplete: 'off' });
  const icon = el('input', { placeholder: '📌', maxLength: 4, className: 'icon-input', autocomplete: 'off' });
  const match = el('textarea', {
    placeholder: 'Match words, comma separated (e.g. github.com, gitlab.com)',
    rows: 2,
  });
  const add = el('button', { className: 'plain', textContent: 'Add rule' });
  add.onclick = async () => {
    if (!name.value.trim() || !match.value.trim()) return;
    state.rules.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.value.trim(),
      icon: icon.value.trim(),
      match: match.value.trim(),
    });
    await persistRules();
  };

  main.append(el('details', { open: true, className: 'rule-form' },
    el('summary', {}, el('span', { className: 'name', textContent: 'New rule' })),
    el('div', { className: 'form' },
      el('div', { className: 'row' }, icon, name),
      match,
      el('p', { className: 'hint', textContent: 'Tabs whose URL or title contain any word go in this group. Rules beat the built-in topics; the top rule wins.' }),
      add)));

  if (state.rules.length === 0) {
    main.append(el('p', { className: 'empty', textContent: 'No rules yet.' }));
    return;
  }

  const list = el('ul', {});
  state.rules.forEach((r, i) => {
    const up = el('button', { className: 'close', textContent: '↑', ariaLabel: 'Move up' });
    up.disabled = i === 0;
    up.onclick = async () => {
      [state.rules[i - 1], state.rules[i]] = [state.rules[i], state.rules[i - 1]];
      await persistRules();
    };
    const del = el('button', { className: 'close', textContent: '×', ariaLabel: 'Delete rule' });
    del.onclick = async () => {
      state.rules = state.rules.filter((x) => x.id !== r.id);
      await persistRules();
    };
    list.append(el('li', {},
      el('span', { className: 'open' },
        el('span', { className: 'title', textContent: `${r.icon || '📌'} ${r.name}` }),
        el('span', { className: 'meta', textContent: r.match })),
      up, del));
  });
  main.append(el('details', { open: true },
    el('summary', {}, el('span', { className: 'name', textContent: 'Your rules' }),
      el('span', { className: 'count', textContent: state.rules.length })),
    list));
}

function renderSaved(main) {
  const groups = state.saved
    .map((g) => ({ g, items: g.tabs.map((t, i) => ({ ...t, i })).filter((t) => matchesQuery(t.title, t.url)) }))
    .filter(({ items }) => items.length > 0);
  if (groups.length === 0) {
    main.append(el('p', { className: 'empty', textContent: state.query ? 'No matching saved tabs.' : 'Nothing saved yet. Tap "Save" on a group to store it and close its tabs.' }));
    return;
  }

  for (const { g, items } of groups) {
    const restore = el('button', { className: 'plain', textContent: 'Restore' });
    restore.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      restoreGroup(g);
    };
    const del = el('button', { className: 'danger', textContent: 'Delete' });
    onConfirmedTap(del, 'Delete?', () => deleteSaved(g));

    const rows = items.map((t) => {
      const open = el('button', { className: 'open', title: t.url },
        el('span', { className: 'title', textContent: t.title }),
        el('span', { className: 'meta', textContent: hostOf(t.url) }));
      open.onclick = () => api.tabs.create({ url: t.url });
      const remove = el('button', { className: 'close', textContent: '×', ariaLabel: 'Remove from saved' });
      remove.onclick = () => removeSavedTab(g, t.i);
      return el('li', {}, open, remove);
    });

    main.append(el('details', { open: true },
      el('summary', {},
        el('span', { className: 'name', textContent: g.name }),
        el('span', { className: 'count', textContent: `${g.tabs.length} · ${ago(g.savedAt)}` }),
        restore,
        del),
      el('ul', {}, ...rows)));
  }
}

function render() {
  const stale = state.tabs.filter((t) => t.usage === STALE);
  const dupes = findDuplicates(state.tabs);

  $('#summary').textContent = `${state.tabs.length} tabs · ${stale.length} stale · ${dupes.size} dupes`;
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  $('#search').placeholder = state.view === 'saved' ? 'Search saved' : 'Search tabs';
  $('#search').hidden = state.view === 'rules';

  const dupesBtn = $('#close-dupes');
  dupesBtn.hidden = dupes.size === 0;
  delete dupesBtn.dataset.armed;
  dupesBtn.textContent = `Close dupes (${dupes.size})`;
  onConfirmedTap(dupesBtn, 'Tap to confirm', () => closeTabs([...dupes]));

  const staleBtn = $('#close-stale');
  staleBtn.hidden = stale.length === 0;
  delete staleBtn.dataset.armed;
  staleBtn.textContent = `Close stale (${stale.length})`;
  onConfirmedTap(staleBtn, 'Tap to confirm', () => closeTabs(stale.map((t) => t.id)));

  const main = $('#groups');
  main.replaceChildren();
  if (state.view === 'saved') renderSaved(main);
  else if (state.view === 'rules') renderRules(main);
  else renderOpenTabs(main, dupes);
}

async function load() {
  const [tabs, store] = await Promise.all([
    api.tabs.query({}),
    api.storage.local.get(['usage', 'pages', 'view', 'saved', 'rules']),
  ]);
  const usage = store.usage ?? {};
  const pages = store.pages ?? {};
  state.view = store.view ?? 'topic';
  state.saved = store.saved ?? [];
  state.rules = store.rules ?? [];

  state.tabs = tabs.map((tab) => {
    const key = urlKey(tab.url);
    const u = usage[key] ?? {};
    // Chrome exposes tab.lastAccessed; Safari relies on our own tracking.
    const lastUsed = u.lastUsed ?? tab.lastAccessed ?? null;
    return {
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || tab.url || 'Untitled',
      url: tab.url ?? '',
      host: hostOf(tab.url),
      lastUsed,
      visits: u.visits ?? 0,
      usage: usageBucket(lastUsed),
      topic: categorize(tab, pages[key], state.rules),
    };
  });
  render();
}

document.querySelectorAll('.seg button').forEach((b) => {
  b.onclick = () => {
    state.view = b.dataset.view;
    api.storage.local.set({ view: state.view });
    render();
  };
});

$('#search').oninput = (e) => {
  state.query = e.target.value;
  render();
};

load();

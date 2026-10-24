# Tab Sorter

Safari extension (iOS 16+) that groups open tabs by topic and by usage.

- **By topic**: Video, Social, Dev, Apple & Jailbreak, AI, Shopping, News, Mail & Docs, Finance, Learning, Search, Other.
  Domain rules first, then keywords from the tab title and page text. Edit `extension/classify.js` to tweak.
- **By usage**: Today / This week / Stale (7d+) / Not tracked yet. Tracking starts once the extension is installed.
- Tap a tab to jump to it, `×` to close, "Close" (whole group) / "Close stale" (tap twice to confirm).
- **Duplicates**: same URL open twice is marked `duplicate`; "Close dupes" keeps the most recently used copy.
- **Saved**: "Save" on a group stores its tabs and closes them. The Saved view lets you reopen one tab, "Restore" the whole group, or delete it.

## Test on Windows (Chrome)

1. `chrome://extensions` → enable Developer mode → **Load unpacked** → pick the `extension` folder.
2. Click the extension icon.

## Build for iPhone

1. Push this folder to a GitHub repo (branch `main`).
2. Actions tab → **Build IPA** runs automatically → download the `TabSorter-ipa` artifact (zip containing `TabSorter.ipa`).
3. Send `TabSorter.ipa` to the phone and open it with **TrollStore** (or Filza + AppSync Unified).
4. Open the **TabSorter** app once.
5. Settings → Safari → Extensions → **Tab Sorter** → on, and set *All Websites* to **Allow**.
6. In Safari tap the **puzzle icon** (aA menu on iOS 16) → Tab Sorter.

Tabs opened before install show "Not tracked yet" until you view them again; reload a page to give it page-text-based sorting.

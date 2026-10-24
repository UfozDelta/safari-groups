# Tab Sorter

A Safari extension for iPhone (iOS 16+) that groups your open tabs by topic and shows which ones you actually use.

Built as a plain WebExtension (Manifest V3, no dependencies). It runs in Chrome on Windows for testing and ships to an iPhone through a GitHub Actions macOS build, so you don't need a Mac.

## Features

| View | What it does |
| --- | --- |
| **Topic** | Groups tabs into Video, Social, Dev, Apple & Jailbreak, AI, Shopping, News, Mail & Docs, Finance, Learning, Search, Other. |
| **Usage** | Groups tabs into Today, This week, Stale (7+ days) and Not tracked yet. |
| **Rules** | Your own groups. Name + words to match in a tab's URL or title (e.g. `github.com` → "🐙 My GitHub"). Beat the built-in topics; top rule wins, reorder with ↑. |
| **Saved** | Stores a group's tabs and closes them. Reopen one tab, restore the whole group, or delete it. |

Actions:

- Tap a tab to jump to it. `×` closes it.
- **Close** closes a whole group. **Close stale** closes the 7+ day group. Both ask you to tap twice.
- **Duplicates**: a URL open twice is marked `duplicate`. **Close dupes** keeps the most recently used copy.
- **Save** on a group stores it in the Saved view and closes the tabs.

## How sorting works

0. Your **rules** (Rules tab) are checked first.
1. The most specific matching **domain** wins.
2. Otherwise **keywords** are scored across the tab title (counted twice) and a short snapshot of the page text. The best score wins if it is at least 2.
3. Otherwise the tab goes in **Other**.

Usage tracking starts when the extension is installed. Tabs opened earlier show as "Not tracked yet" until you view them again. Reload a page to give it page-text sorting.

To add your own sites or keywords, edit `CATEGORIES` in [`extension/classify.js`](extension/classify.js).

## Project layout

```
extension/
  manifest.json   MV3 manifest (service worker + background scripts fallback for iOS 16)
  background.js   records last-used time and page snapshots in storage.local
  content.js      sends a text snapshot of the page to the background
  classify.js     domain and keyword rules
  popup.html/js/css   the UI
.github/workflows/build-ipa.yml   macOS build that produces an unsigned .ipa
```

## Test on Windows (Chrome)

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and pick the `extension` folder.
3. Click the extension icon.

## Build and install on iPhone

Needs a jailbroken or TrollStore-capable device, since the build is unsigned.

1. Push this repo to GitHub on branch `main`.
2. The **Build IPA** workflow runs on every push. Download the `TabSorter-ipa` artifact (a zip containing `TabSorter.ipa`).
3. Send `TabSorter.ipa` to the phone and open it with **TrollStore** (or Filza with AppSync Unified).
4. Open the **TabSorter** app once so iOS registers the extension.
5. Go to Settings → Safari → Extensions → **Tab Sorter**. Turn it on and set *All Websites* to **Allow**.
6. In Safari, tap the **aA** menu, then Tab Sorter.

## Troubleshooting

**Extension doesn't appear in Safari's settings**
- Reinstall the IPA in TrollStore, then reboot or run `uicache -a`.
- Open the TabSorter app at least once.
- Check the build log: `PlugIns/TabSorter Extension.appex` must be inside the `.app`.

**Extension is listed but does nothing**
- Set *All Websites* to **Allow**. Without it, page snapshots and tab URLs aren't available.

**Popup shows everything under "Not tracked yet"**
- Expected right after install. Visit or reload the tabs.

## Limits

- Rule-based only. There is no AI sorting yet (a Claude "smart sort" is a possible later addition).
- Stored history is capped (3,000 URLs of usage, 400 page snapshots) and the oldest entries are dropped first.

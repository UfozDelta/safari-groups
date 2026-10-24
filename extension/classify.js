// Rule-based tab categorizer.
// 1. Most specific matching domain wins.
// 2. Otherwise score keywords in title (x2) + page snapshot; best score >= 2 wins.
// 3. Otherwise "Other".
// Edit CATEGORIES to add your own sites and keywords.

const CATEGORIES = [
  {
    name: 'Video',
    icon: '▶️',
    domains: ['youtube.com', 'youtu.be', 'netflix.com', 'twitch.tv', 'vimeo.com', 'tiktok.com',
      'hulu.com', 'disneyplus.com', 'primevideo.com', 'max.com', 'crunchyroll.com'],
    keywords: /\b(watch|video|episode|season|stream(ing)?|trailer|movie)\b/gi,
  },
  {
    name: 'Social',
    icon: '💬',
    domains: ['reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com', 'threads.net',
      'discord.com', 'linkedin.com', 'mastodon.social', 'bsky.app', 'tumblr.com', 'pinterest.com'],
    keywords: /\b(followers|posted|comments?|subreddit|thread|reply|retweet)\b/gi,
  },
  {
    name: 'Dev',
    icon: '💻',
    domains: ['github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com', 'npmjs.com',
      'developer.apple.com', 'developer.mozilla.org', 'pypi.org', 'docs.python.org', 'vercel.com',
      'netlify.app', 'codepen.io', 'replit.com'],
    keywords: /\b(api|sdk|documentation|repository|function|javascript|typescript|python|swift|xcode|npm|error|compile|github)\b/gi,
  },
  {
    name: 'Apple & Jailbreak',
    icon: '🍎',
    domains: ['theapplewiki.com', 'ios.cfw.guide', 'havoc.app', 'chariz.com', 'idownloadblog.com',
      '9to5mac.com', 'macrumors.com', 'apple.com', 'ipsw.me', 'appdb.to'],
    keywords: /\b(jailbreak|tweak|sileo|zebra|dopamine|palera1n|trollstore|rootless|ios ?1[5-9]|iphone|ipad)\b/gi,
  },
  {
    name: 'AI',
    icon: '🤖',
    domains: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'openai.com',
      'anthropic.com', 'huggingface.co', 'poe.com'],
    keywords: /\b(ai|llm|gpt|claude|chatbot|prompt|model)\b/gi,
  },
  {
    name: 'Shopping',
    icon: '🛒',
    domains: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com', 'aliexpress.com', 'target.com',
      'bestbuy.com', 'temu.com', 'shein.com', 'costco.com', 'newegg.com'],
    keywords: /(\$\d|\b(buy|cart|price|deal|sale|shipping|checkout|in stock|add to bag)\b)/gi,
  },
  {
    name: 'News',
    icon: '📰',
    domains: ['cnn.com', 'bbc.com', 'bbc.co.uk', 'nytimes.com', 'reuters.com', 'apnews.com',
      'theguardian.com', 'theverge.com', 'wsj.com', 'bloomberg.com', 'news.ycombinator.com',
      'arstechnica.com', 'techcrunch.com', 'news.google.com'],
    keywords: /\b(news|breaking|reported|according to|officials|announced)\b/gi,
  },
  {
    name: 'Mail & Docs',
    icon: '📄',
    domains: ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'docs.google.com',
      'drive.google.com', 'notion.so', 'icloud.com', 'dropbox.com', 'proton.me'],
    keywords: /\b(inbox|spreadsheet|document|shared with you)\b/gi,
  },
  {
    name: 'Finance',
    icon: '💰',
    domains: ['paypal.com', 'coinbase.com', 'robinhood.com', 'tradingview.com', 'binance.com',
      'finance.yahoo.com', 'chase.com', 'bankofamerica.com', 'wellsfargo.com', 'venmo.com'],
    keywords: /\b(stocks?|crypto|bitcoin|bank(ing)?|invest(ing|ment)?|portfolio|dividend)\b/gi,
  },
  {
    name: 'Learning',
    icon: '📚',
    domains: ['wikipedia.org', 'coursera.org', 'udemy.com', 'khanacademy.org', 'medium.com',
      'wikihow.com', 'quizlet.com', 'duolingo.com'],
    keywords: /\b(how to|tutorial|guide|learn(ing)?|course|lesson|explained)\b/gi,
  },
  {
    name: 'Search',
    icon: '🔍',
    domains: [],
    test: (u) => /(^|\.)(google|bing|duckduckgo|yahoo|ecosia)\./.test(u.hostname) &&
      (u.pathname.startsWith('/search') || u.searchParams.has('q')),
  },
];

const OTHER = { name: 'Other', icon: '🗂️' };

function domainMatch(host, domain) {
  return host === domain || host.endsWith('.' + domain);
}

function categorize(tab, page) {
  let url;
  try { url = new URL(tab.url); } catch { return OTHER; }
  const host = url.hostname.replace(/^www\./, '');

  let best = null;
  let bestLen = 0;
  for (const cat of CATEGORIES) {
    if (cat.test?.(url)) return cat;
    for (const d of cat.domains) {
      if (domainMatch(host, d) && d.length > bestLen) {
        best = cat;
        bestLen = d.length;
      }
    }
  }
  if (best) return best;

  const title = tab.title || '';
  const body = page ? `${page.h1} ${page.desc} ${page.text}` : '';
  let topScore = 0;
  for (const cat of CATEGORIES) {
    if (!cat.keywords) continue;
    const score = (title.match(cat.keywords)?.length ?? 0) * 2 + (body.match(cat.keywords)?.length ?? 0);
    if (score > topScore) {
      topScore = score;
      best = cat;
    }
  }
  return topScore >= 2 ? best : OTHER;
}

if (typeof module !== 'undefined') module.exports = { categorize, CATEGORIES, OTHER };

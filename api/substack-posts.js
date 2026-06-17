// api/substack-posts.js
// Fetches and parses the Substack RSS feed, returning the N most recent posts as clean JSON.

const FEED_URL = 'https://isisanchalee.substack.com/feed';
const DEFAULT_LIMIT = 3;

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  let value = match[1].trim();
  // Strip CDATA wrapper if present
  const cdataMatch = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) value = cdataMatch[1].trim();
  return value;
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripHtml(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

function parseItems(xml, limit) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const itemXml = match[1];

    const title = decodeEntities(extractTag(itemXml, 'title'));
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');

    // Substack typically provides description (often HTML) and sometimes content:encoded
    let description = extractTag(itemXml, 'description');
    description = decodeEntities(stripHtml(description));

    // Truncate description to a clean excerpt
    const excerpt = description.length > 140
      ? description.slice(0, 140).trim() + '…'
      : description;

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        excerpt,
      });
    }
  }

  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.SITE_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = Math.min(parseInt(req.query.limit, 10) || DEFAULT_LIMIT, 10);

  try {
    const response = await fetch(FEED_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IsisAnchaleeSite/1.0)' },
    });

    if (!response.ok) {
      throw new Error(`Feed responded with status ${response.status}`);
    }

    const xml = await response.text();
    const posts = parseItems(xml, limit);

    // Cache for 30 minutes at the edge to avoid hammering Substack on every page load
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json({ posts });

  } catch (err) {
    console.error('Substack feed error:', err);
    return res.status(500).json({ error: 'Failed to fetch Substack posts', posts: [] });
  }
};

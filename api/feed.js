// GET /api/feed  ->  { updated, channels: [...], posts: [...] }
// Scrapes the public web preview (https://t.me/s/<handle>) of each channel.
const cheerio = require('cheerio');

// Edit this list to add or remove channels.
const CHANNELS = [
  'danielamram3',
  'abualiexpress',
  'amitsegal',
  'newssil',
  'israel_news_telegram',
  'News_il_h',
  'israel1',
  'ramreports',
  'salehdesk1',
];

const POSTS_PER_CHANNEL = 12;
const MAX_POSTS = 80;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseCount(raw) {
  if (!raw) return null;
  const s = raw.replace(/\s/g, '').toUpperCase();
  const m = s.match(/^([\d.,]+)([KM]?)$/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(',', '.'));
  if (Number.isNaN(n)) return null;
  if (m[2] === 'K') n *= 1e3;
  if (m[2] === 'M') n *= 1e6;
  return Math.round(n);
}

function bgImage(styleAttr) {
  if (!styleAttr) return null;
  const m = styleAttr.match(/url\(['"]?([^'")]+)['"]?\)/);
  if (!m) return null;
  const url = m[1].replace(/&amp;/g, '&');
  return url.startsWith('https://') ? url : null;
}

async function scrapeChannel(handle) {
  const res = await fetch(`https://t.me/s/${handle}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'he,en;q=0.8' },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const wraps = $('.tgme_widget_message_wrap');
  if (!wraps.length) {
    // Removed channel, private channel, or a user/bot: Telegram shows no preview.
    throw new Error('no public preview');
  }

  const title = $('.tgme_channel_info_header_title').first().text().trim() || handle;
  let subscribers = null;
  $('.tgme_channel_info_counter').each((_, el) => {
    const type = $(el).find('.counter_type').text().trim().toLowerCase();
    if (type.startsWith('subscriber')) {
      subscribers = parseCount($(el).find('.counter_value').text());
    }
  });

  const posts = [];
  wraps.each((_, el) => {
    const msg = $(el).find('.tgme_widget_message').first();
    const dataPost = msg.attr('data-post'); // "handle/123"
    if (!dataPost) return;
    const id = dataPost.split('/')[1];

    // Main text (ignore the quoted text inside a reply box)
    let text = '';
    msg.find('.tgme_widget_message_text').each((__, t) => {
      if ($(t).closest('.tgme_widget_message_reply').length) return;
      if (text) return;
      const clone = $(t).clone();
      clone.find('br').replaceWith('\n');
      text = clone.text().replace(/\u00a0/g, ' ').trim();
    });

    const photo = bgImage(msg.find('.tgme_widget_message_photo_wrap').first().attr('style'));
    const videoThumb = bgImage(msg.find('.tgme_widget_message_video_thumb').first().attr('style'));
    const linkImg = bgImage(msg.find('.link_preview_image').first().attr('style'));
    const image = photo || videoThumb || linkImg || null;
    const hasVideo = msg.find('.tgme_widget_message_video_player, .message_video_play').length > 0;

    const date = msg.find('.tgme_widget_message_date time').first().attr('datetime') || null;
    if (!text && !image) return;

    posts.push({
      channel: handle,
      id,
      url: `https://t.me/${dataPost}`,
      date,
      text,
      image,
      hasVideo,
    });
  });

  return {
    info: { handle, title, subscribers, ok: true },
    posts: posts.slice(-POSTS_PER_CHANNEL),
  };
}

module.exports = async (req, res) => {
  const settled = await Promise.allSettled(CHANNELS.map(scrapeChannel));

  const channels = [];
  let posts = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      channels.push(r.value.info);
      posts = posts.concat(r.value.posts);
    } else {
      channels.push({
        handle: CHANNELS[i],
        title: CHANNELS[i],
        subscribers: null,
        ok: false,
        error: String(r.reason && r.reason.message ? r.reason.message : r.reason),
      });
    }
  });

  if (!posts.length) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'No channel could be read', channels });
  }

  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  posts = posts.slice(0, MAX_POSTS);

  // Cache at Vercel's edge so Telegram is hit at most about once every 2 minutes.
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  res.status(200).json({ updated: new Date().toISOString(), channels, posts });
};

module.exports._scrapeChannel = scrapeChannel; // for local testing

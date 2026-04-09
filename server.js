const http = require('http');
const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

// Simple in-memory post store (replace with a database later)
const posts = {
  '1': { id: '1', platform: 'Instagram', text: 'Behind the scenes of our biggest campaign...', status: 'pending' },
  '2': { id: '2', platform: 'LinkedIn', text: 'We just helped a B2B SaaS brand 3x their reach...', status: 'pending' },
};

function sendTelegram(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${endpoint}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Social Approval Bot is running!' }));
    return;
  }

  // Telegram webhook
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const update = JSON.parse(body);
        const cb = update.callback_query;

        if (cb) {
          const [action, postId] = cb.data.split('_');
          const post = posts[postId];

          if (post) {
            post.status = action === 'approve' ? 'approved' : 'rejected';
            const emoji = action === 'approve' ? '✅' : '❌';
            const label = action === 'approve' ? 'Approved' : 'Rejected';

            // Answer the callback (removes loading state on button)
            await sendTelegram('answerCallbackQuery', {
              callback_query_id: cb.id,
              text: `Post ${label}!`
            });

            // Update the Telegram message
            await sendTelegram('editMessageText', {
              chat_id: cb.message.chat.id,
              message_id: cb.message.message_id,
              text: `${emoji} *${label}*\n\n*Platform:* ${post.platform}\n\n"${post.text.substring(0, 150)}..."`,
              parse_mode: 'Markdown'
            });

            console.log(`Post ${postId} ${label} by user ${cb.from.first_name}`);
          }
        }

        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        console.error('Webhook error:', e.message);
        res.writeHead(200);
        res.end('OK');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Social Approval Bot running on port ${PORT}`);
  console.log(`BOT_TOKEN: ${BOT_TOKEN ? 'SET' : 'MISSING - add in Railway Variables'}`);
  console.log(`CHAT_ID: ${CHAT_ID ? 'SET' : 'MISSING - add in Railway Variables'}`);
});

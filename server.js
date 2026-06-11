const express = require('express');
const ytDlp = require('yt-dlp-exec');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Search - returns tracks or artist page results
app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const result = await ytDlp(`ytsearch10:${q}`, {
      dumpSingleJson: true,
      noPlaylist: true,
      noWarnings: true,
    });
    const entries = result.entries || [];
    const tracks = entries.map(e => ({
      id: e.id,
      title: e.title,
      artist: e.uploader || e.channel || 'Unknown',
      thumbnail: e.thumbnail || (e.thumbnails && e.thumbnails[0]?.url) || '',
      duration: e.duration || 0,
    }));
    res.json(tracks);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Stream audio
app.get('/stream', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing id');
  try {
    const url = await ytDlp(id, {
      getUrl: true,
      format: 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
      noPlaylist: true,
      noWarnings: true,
    });
    const audioUrl = url.trim();
    const range = req.headers.range;
    const headers = {};
    if (range) headers.Range = range;
    const upstream = await fetch(audioUrl, { headers });
    if (!upstream.ok) return res.status(upstream.status).send('Stream failed');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    if (upstream.status === 206) {
      res.status(206);
      res.setHeader('Content-Range', upstream.headers.get('content-range'));
    }
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    upstream.body.pipe(res);
  } catch (err) {
    console.error('Stream error:', err);
    res.status(500).send('Stream error');
  }
});

app.listen(PORT, () => console.log(`Ghost server listening on port ${PORT}`));

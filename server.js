// server.js
const express = require('express');
const ytDlp = require('yt-dlp-exec');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Recherche : renvoie 5 résultats YouTube en JSON
app.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Query parameter q required' });

  try {
    const output = await ytDlp(`ytsearch5:${q}`, {
      dumpSingleJson: false,
      noPlaylist: true,
    });

    const lines = output.trim().split('\n');
    const tracks = lines.map(line => {
      const entry = JSON.parse(line);
      return {
        id: entry.id,
        title: entry.title,
        artist: entry.uploader || entry.channel || 'Unknown',
        thumbnail: entry.thumbnail || (entry.thumbnails && entry.thumbnails[0]?.url) || '',
        duration: entry.duration,
      };
    });

    res.json(tracks);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Stream audio proxy avec support des requêtes Range
app.get('/stream', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing id');

  try {
    const url = await ytDlp(id, {
      getUrl: true,
      format: 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
      noPlaylist: true,
    });

    const range = req.headers.range;
    const headers = {};
    if (range) headers.Range = range;

    const upstreamRes = await fetch(url, { headers });

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send('Failed to fetch audio stream');
    }

    const contentType = upstreamRes.headers.get('content-type') || 'audio/mp4';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (upstreamRes.status === 206) {
      res.status(206);
      res.setHeader('Content-Range', upstreamRes.headers.get('content-range'));
      const len = upstreamRes.headers.get('content-length');
      if (len) res.setHeader('Content-Length', len);
    } else {
      const len = upstreamRes.headers.get('content-length');
      if (len) res.setHeader('Content-Length', len);
    }

    upstreamRes.body.pipe(res);
  } catch (err) {
    console.error('Stream error:', err);
    res.status(500).send('Stream error');
  }
});

app.listen(PORT, () => {
  console.log(`Ghost server listening on port ${PORT}`);
});

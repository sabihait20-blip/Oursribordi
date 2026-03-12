import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const saVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    let serviceAccount;

    if (saVar) {
      try {
        // Try parsing as direct JSON
        serviceAccount = JSON.parse(saVar);
      } catch (e) {
        try {
          // Try parsing as base64 encoded JSON (some environments encode secrets)
          const decoded = Buffer.from(saVar, 'base64').toString();
          serviceAccount = JSON.parse(decoded);
        } catch (e2) {
          console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON. It seems to start with:', saVar.substring(0, 20));
          console.error('Please ensure you have pasted the ENTIRE JSON object (including { and }) into the environment variable.');
        }
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('Firebase Admin initialized with service account');
    } else {
      // Fallback to application default (works if running in GCP with proper IAM)
      admin.initializeApp({
        credential: admin.credential.applicationDefault()
      });
      console.log('Firebase Admin initialized with application default credentials');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/download', async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send('URL required');
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const filename = imageUrl.split('/').pop() || 'download.jpg';
      
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.send(buffer);
    } catch (error) {
      res.status(500).send('Error downloading image');
    }
  });

  app.post('/api/send-notification', async (req, res) => {
    const { token, title, body, data } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      const message = {
        notification: { title, body },
        token: token,
        data: data || {},
        webpush: {
          notification: {
            icon: '/firebase-logo.png',
            click_action: 'https://ais-pre-4evteq6f7cam3x5m6neoco-68546391801.asia-southeast1.run.app'
          }
        }
      };

      const response = await admin.messaging().send(message);
      res.status(200).json({ success: true, messageId: response });
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    
    // Intercept HTML requests in dev mode to inject OG tags
    app.use(async (req, res, next) => {
      if (req.method !== 'GET' || req.headers.accept?.indexOf('text/html') === -1) {
        return next();
      }
      
      const postId = req.query.post as string;
      let ogTags = '';
      
      if (postId && admin.apps.length) {
        try {
          const db = admin.firestore();
          const postDoc = await db.collection('posts').doc(postId).get();
          if (postDoc.exists) {
            const postData = postDoc.data();
            const title = postData?.name ? `Post by ${postData.name}` : 'আমাদের শ্রীবরদী';
            const description = postData?.caption || 'Check out this post on আমাদের শ্রীবরদী';
            const imageUrl = postData?.imageUrl || 'https://ais-pre-4evteq6f7cam3x5m6neoco-68546391801.asia-southeast1.run.app/firebase-logo.png';
            
            ogTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${imageUrl}" />`;
          }
        } catch (error) {
          console.error('Error fetching post for OG tags:', error);
        }
      }

      try {
        let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        if (ogTags) {
          template = template.replace('</head>', `${ogTags}\n  </head>`);
        }
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    // Production mode
    app.use(express.static('dist', { index: false }));
    
    app.get('*', async (req, res) => {
      const postId = req.query.post as string;
      let ogTags = '';
      
      if (postId && admin.apps.length) {
        try {
          const db = admin.firestore();
          const postDoc = await db.collection('posts').doc(postId).get();
          if (postDoc.exists) {
            const postData = postDoc.data();
            const title = postData?.name ? `Post by ${postData.name}` : 'আমাদের শ্রীবরদী';
            const description = postData?.caption || 'Check out this post on আমাদের শ্রীবরদী';
            const imageUrl = postData?.imageUrl || 'https://ais-pre-4evteq6f7cam3x5m6neoco-68546391801.asia-southeast1.run.app/firebase-logo.png';
            
            ogTags = `
    <meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${imageUrl}" />`;
          }
        } catch (error) {
          console.error('Error fetching post for OG tags:', error);
        }
      }
      
      try {
        const indexPath = path.join(process.cwd(), 'dist', 'index.html');
        let html = fs.readFileSync(indexPath, 'utf-8');
        if (ogTags) {
          html = html.replace('</head>', `${ogTags}\n  </head>`);
        }
        res.send(html);
      } catch (error) {
        res.status(500).send('Error loading application');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

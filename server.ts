import express from 'express';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import path from 'path';

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
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

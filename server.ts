import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // HighLevel Proxy
  app.post('/api/highlevel/sync-contact', async (req, res) => {
    const apiKey = process.env.HIGHLEVEL_API_KEY;
    const locationId = process.env.HIGHLEVEL_LOCATION_ID;

    if (!apiKey) {
      return res.status(500).json({ error: 'HighLevel API Key not configured' });
    }

    try {
      const contactData = req.body;
      
      // Basic mapping to HighLevel Contact structure
      // This assumes v1 API or v2 with Location Token. 
      // Adjust based on specific API version requirements.
      const payload = {
        ...contactData,
        locationId: locationId
      };

      const response = await axios.post('https://rest.gohighlevel.com/v1/contacts/', payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error('HighLevel API Error:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to sync with HighLevel', 
        details: error.response?.data || error.message 
      });
    }
  });

  // HighLevel Proxy - GET Contacts
  app.get('/api/highlevel/contacts', async (req, res) => {
    console.log("Server: GET /api/highlevel/contacts called");
    const apiKey = process.env.HIGHLEVEL_API_KEY;
    
    if (!apiKey) {
      console.error("Server: HIGHLEVEL_API_KEY is missing");
      return res.status(500).json({ error: 'HighLevel API Key not configured' });
    }

    try {
      console.log("Server: Fetching from HighLevel API...");
      // Fetch contacts (limit 100 for MVP)
      const response = await axios.get('https://rest.gohighlevel.com/v1/contacts/?limit=100', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      console.log("Server: HighLevel API success. Status:", response.status);

      res.json(response.data);
    } catch (error: any) {
      console.error('HighLevel API Error (GET):', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to fetch from HighLevel', 
        details: error.response?.data || error.message 
      });
    }
  });

  // MCP Server Placeholder (Model Context Protocol)
  // If the user meant this, we can expand it later.
  app.get('/api/mcp/tools', (req, res) => {
    res.json({
      tools: [
        {
          name: "sync_contact_to_highlevel",
          description: "Sync a contact to HighLevel CRM",
          parameters: {
            type: "object",
            properties: {
              email: { type: "string" },
              phone: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" }
            },
            required: ["email"]
          }
        }
      ]
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    // app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

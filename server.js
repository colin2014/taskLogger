import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;
const MONGODB_URI = process.env.MONGODB_URI; // mongodb+srv://cchambers:Bo7Z6uE7l83VVbSD@cluster0.xxxxx.mongodb.net
const DB_NAME = process.env.DB_NAME || 'tasklog';

if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI in .env');
  process.exit(1);
}

let client, db, daysCol, catsCol;

try {
  client = new MongoClient(MONGODB_URI, { maxPoolSize: 10 });
  await client.connect();
  db = client.db(DB_NAME);

  console.log(`✅ Connected to MongoDB cluster`);
  console.log(`   Database: ${DB_NAME}`);

  // List collections for verification
  const collections = await db.listCollections().toArray();
  console.log(`   Collections in this DB:`, collections.map(c => c.name));

  daysCol = db.collection('tasklog_days');
  catsCol = db.collection('tasklog_categories');

  await daysCol.createIndex({ date: 1 }, { unique: true });
} catch (err) {
  console.error('❌ Failed to connect to MongoDB:', err);
  process.exit(1);
}

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Get tasks for a day
app.get('/api/day/:date', async (req, res) => {
  const { date } = req.params; // YYYY-MM-DD
  const doc = await daysCol.findOne({ date });
  res.json({ date, items: doc?.items || [] });
});

// Put tasks for a day
app.put('/api/day/:date', async (req, res) => {
  const { date } = req.params;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  await daysCol.updateOne(
    { date },
    { $set: { date, items, updatedAt: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

// Get all days as a map for the running log
app.get('/api/log', async (_req, res) => {
  const cursor = daysCol.find({}, { projection: { _id: 0 } });
  const days = {};
  for await (const d of cursor) days[d.date] = d.items || [];
  res.json({ days });
});

// Categories
app.get('/api/categories', async (_req, res) => {
  const doc = await catsCol.findOne({ _id: 'singleton' });
  res.json({ categories: doc?.categories || [] });
});

app.put('/api/categories', async (req, res) => {
  const categories = Array.isArray(req.body.categories) ? req.body.categories : [];
  await catsCol.updateOne(
    { _id: 'singleton' },
    { $set: { categories, updatedAt: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`🚀 Task Log API listening on http://localhost:${PORT}`));

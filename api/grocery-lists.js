// Vercel serverless function for a meal plan's grocery list — one document per
// plan (_id = planId), holding a checklist of items with quantity, checked state,
// and which recipes (in that plan) call for each item. Mirrors api/plans.js.
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const { URL } = require('url');

const DB_NAME = process.env.MONGODB_DB || 'mealplanner';
const COLLECTION = 'groceryLists';

let clientPromise;
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

function docToList(doc) {
  if (!doc) return null;
  return {
    planId: doc._id,
    items: doc.items || [],
    updatedAt: doc.updatedAt,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    const client = await getClient();
    const collection = client.db(DB_NAME).collection(COLLECTION);

    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const planId = url.searchParams.get('planId');
      if (!planId) {
        res.status(400).json({ error: 'planId is required' });
        return;
      }
      const doc = await collection.findOne({ _id: planId });
      res.status(200).json(docToList(doc) || {});
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.action === 'save') {
        await collection.updateOne(
          { _id: body.planId },
          {
            $set: { items: body.items || [], updatedAt: Date.now() },
            $setOnInsert: { createdAt: Date.now() },
          },
          { upsert: true }
        );
        const doc = await collection.findOne({ _id: body.planId });
        res.status(200).json(docToList(doc));
        return;
      }

      res.status(400).json({ error: 'Unknown action' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

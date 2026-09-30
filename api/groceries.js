// Vercel serverless function for the grocery item database (name, category, price,
// optional thumbnail). Mirrors api/recipes.js and api/plans.js.
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'mealplanner';
const COLLECTION = 'groceries';

let clientPromise;
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

function docToItem(doc) {
  return {
    id: doc._id,
    name: doc.name,
    category: doc.category,
    // Only meaningful when category === 'grocery' — Market items are food by definition.
    subCategory: doc.subCategory || null,
    // 'unit' (price per item) or 'kg' (price per kilogram).
    pricingUnit: doc.pricingUnit || 'unit',
    price: doc.price,
    thumbnail: doc.thumbnail || null,
    createdAt: doc.createdAt,
  };
}

async function getAllItems(collection) {
  const docs = await collection.find({}).toArray();
  return docs.map(docToItem);
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
      res.status(200).json(await getAllItems(collection));
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.action === 'create') {
        const item = body.item;
        await collection.insertOne({
          _id: item.id,
          name: item.name,
          category: item.category,
          subCategory: item.subCategory || null,
          pricingUnit: item.pricingUnit || 'unit',
          price: item.price,
          thumbnail: item.thumbnail || null,
          createdAt: item.createdAt,
        });
      } else if (body.action === 'update') {
        const item = body.item;
        await collection.updateOne(
          { _id: item.id },
          { $set: {
            name: item.name,
            category: item.category,
            subCategory: item.subCategory || null,
            pricingUnit: item.pricingUnit || 'unit',
            price: item.price,
            thumbnail: item.thumbnail || null,
          } }
        );
      } else if (body.action === 'delete') {
        await collection.deleteOne({ _id: body.id });
      }

      res.status(200).json(await getAllItems(collection));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

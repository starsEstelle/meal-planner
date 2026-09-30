// Vercel serverless function for recipes, mirroring api/plans.js.
// Thumbnails are stored as base64 data URLs directly on the document (resized
// client-side first) rather than in a separate object store, to keep this a
// one-database setup.
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'mealplanner';
const COLLECTION = 'recipes';

let clientPromise;
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

function docToRecipe(doc) {
  return {
    id: doc._id,
    name: doc.name,
    // Normalized (trimmed, lowercased) generic item names — e.g. "soy sauce" —
    // not grocery document ids, so any brand variant of that item can be used.
    ingredientItems: doc.ingredientItems || [],
    thumbnail: doc.thumbnail || null,
    createdAt: doc.createdAt,
  };
}

async function getAllRecipes(collection) {
  const docs = await collection.find({}).toArray();
  return docs.map(docToRecipe);
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
      res.status(200).json(await getAllRecipes(collection));
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.action === 'create') {
        const recipe = body.recipe;
        await collection.insertOne({
          _id: recipe.id,
          name: recipe.name,
          ingredientItems: recipe.ingredientItems || [],
          thumbnail: recipe.thumbnail || null,
          createdAt: recipe.createdAt,
        });
      } else if (body.action === 'update') {
        const recipe = body.recipe;
        await collection.updateOne(
          { _id: recipe.id },
          { $set: {
            name: recipe.name,
            ingredientItems: recipe.ingredientItems || [],
            thumbnail: recipe.thumbnail || null,
          } }
        );
      } else if (body.action === 'delete') {
        await collection.deleteOne({ _id: body.id });
      }

      res.status(200).json(await getAllRecipes(collection));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Vercel serverless function backing the meal planner site.
// Replaces apps-script/Code.gs — same request/response shape, backed by MongoDB Atlas
// instead of a Google Sheet. Needs a MONGODB_URI env var set in the Vercel project settings.

const { MongoClient } = require('mongodb');

const DB_NAME = process.env.MONGODB_DB || 'mealplanner';
const COLLECTION = 'plans';

// Cache the client across warm invocations instead of reconnecting every request.
let clientPromise;
function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

function docToPlan(doc) {
  return {
    id: doc._id,
    fromDate: doc.fromDate,
    toDate: doc.toDate,
    budget: doc.budget,
    createdAt: doc.createdAt,
    meals: doc.meals || {},
  };
}

async function getAllPlans(collection) {
  const docs = await collection.find({}).toArray();
  return docs.map(docToPlan);
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
      res.status(200).json(await getAllPlans(collection));
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      if (body.action === 'create') {
        const plan = body.plan;
        await collection.insertOne({
          _id: plan.id,
          fromDate: plan.fromDate,
          toDate: plan.toDate,
          budget: plan.budget,
          createdAt: plan.createdAt,
          meals: plan.meals || {},
        });
      } else if (body.action === 'delete') {
        await collection.deleteOne({ _id: body.id });
      } else if (body.action === 'updateMeal') {
        await collection.updateOne(
          { _id: body.id },
          { $set: { [`meals.${body.date}.${body.mealType}`]: body.value } }
        );
      }

      res.status(200).json(await getAllPlans(collection));
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

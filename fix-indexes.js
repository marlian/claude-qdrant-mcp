#!/usr/bin/env node

// Quick fix script to add hash index to existing collections

import { QdrantClient } from "@qdrant/js-client-rest";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

async function fixIndexes() {
  try {
    console.log("🔧 Adding hash indexes to existing collections...");
    
    const collections = await client.getCollections();
    const relevantCollections = collections.collections
      .map(c => c.name)
      .filter(name => name.endsWith('_catalog') || name.endsWith('_chunks'));
    
    for (const collectionName of relevantCollections) {
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: "hash",
          field_schema: "keyword"
        });
        console.log(`✅ Added hash index to ${collectionName}`);
      } catch (error) {
        if (error.message?.includes('already exists')) {
          console.log(`⏭️ Index already exists for ${collectionName}`);
        } else {
          console.error(`❌ Failed to add index to ${collectionName}:`, error.message);
        }
      }
    }
    
    console.log("🎉 Index fix completed!");
    
  } catch (error) {
    console.error("💥 Error:", error);
  }
}

fixIndexes();

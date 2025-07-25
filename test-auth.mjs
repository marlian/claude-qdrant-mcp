import https from 'https';
import 'dotenv/config';

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

// Test both authentication formats
const tests = [
  {
    name: "api-key header",
    headers: { 'api-key': apiKey }
  },
  {
    name: "Authorization Bearer",
    headers: { 'Authorization': `Bearer ${apiKey}` }
  }
];

for (const test of tests) {
  console.log(`\nTesting ${test.name}...`);
  
  const options = {
    headers: test.headers,
    rejectUnauthorized: false
  };

  https.get(`${url}/collections`, options, (res) => {
    console.log('Status Code:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      console.log('Response:', data);
    });

const http = require('http');

const data = JSON.stringify({
  siteId: 'skechers-tr',
  message: 'erkek çocuğu için var mı',
  conversationHistory: [
    {
      role: 'user',
      content: '28 numara bebek ayakkabısı kız ışıklı',
      timestamp: new Date('2024-01-01T10:00:00Z')
    }
  ]
});

console.log('Request body:', data);
console.log('Body length:', data.length);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data, 'utf8')
  }
};

console.log('Sending request...');

const req = http.request(options, (res) => {
  let responseBody = '';

  res.on('data', (chunk) => {
    responseBody += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(responseBody);
      console.log('\n=== DEBUG INFO ===');
      console.log('Original Query:', response.debug?.originalQuery);
      console.log('Enhanced Query:', response.debug?.enhancedQuery);
      console.log('Is Follow-Up:', response.debug?.isFollowUp);
      console.log('\n=== PRODUCTS ===');
      console.log('Count:', response.recommendedProducts?.length || 0);
      if (response.recommendedProducts) {
        response.recommendedProducts.slice(0, 3).forEach(p => {
          console.log(`  - ${p.title.substring(0, 60)}... (Size: ${p.size}, Gender: ${p.gender})`);
        });
      }
      console.log('\n=== AI MESSAGE ===');
      console.log(response.message);
    } catch (e) {
      console.error('Parse error:', e.message);
      console.log('Response:', responseBody);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(data);
req.end();

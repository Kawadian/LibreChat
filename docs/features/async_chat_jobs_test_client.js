/**
 * Example test client for async chat job queue
 * 
 * Usage:
 * 1. Make sure LibreChat server is running with Redis enabled
 * 2. Get an auth token from the API
 * 3. Run: node async_chat_jobs_test_client.js <token> <message>
 * 
 * Example:
 * node async_chat_jobs_test_client.js "eyJhbGc..." "Hello, how are you?"
 */

const https = require('https');
const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:3080';
const TOKEN = process.argv[2];
const MESSAGE = process.argv[3] || 'Hello! This is a test of the async job system.';

if (!TOKEN) {
  console.error('Usage: node async_chat_jobs_test_client.js <auth-token> [message]');
  process.exit(1);
}

const request = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(data),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
};

async function submitJob(message) {
  console.log('\n=== Submitting Job ===');
  console.log('Message:', message);
  
  const response = await request(`${API_BASE}/api/jobs/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      text: message,
      endpointOption: {
        endpoint: 'openAI',
        model: 'gpt-3.5-turbo',
      },
    }),
  });
  
  console.log('Response:', JSON.stringify(response.body, null, 2));
  return response.body.jobId;
}

async function checkJobStatus(jobId) {
  const response = await request(`${API_BASE}/api/jobs/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
    },
  });
  
  return response.body;
}

async function pollJob(jobId, maxAttempts = 30, interval = 2000) {
  console.log('\n=== Polling Job Status ===');
  console.log('Job ID:', jobId);
  
  for (let i = 0; i < maxAttempts; i++) {
    const status = await checkJobStatus(jobId);
    console.log(`[${i + 1}/${maxAttempts}] Status: ${status.status}`, 
                status.progress ? `(${status.progress}%)` : '');
    
    if (status.status === 'completed') {
      console.log('\n=== Job Completed ===');
      console.log('Result:', JSON.stringify(status.result, null, 2));
      return status;
    } else if (status.status === 'failed') {
      console.error('\n=== Job Failed ===');
      console.error('Reason:', status.failedReason);
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  console.warn('\n=== Polling Timeout ===');
  console.warn('Job did not complete within the expected time');
  return null;
}

async function getMetrics() {
  console.log('\n=== Queue Metrics ===');
  
  const response = await request(`${API_BASE}/api/jobs/metrics`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
    },
  });
  
  console.log('Metrics:', JSON.stringify(response.body, null, 2));
  return response.body;
}

async function main() {
  try {
    // Get initial metrics
    await getMetrics();
    
    // Submit job
    const jobId = await submitJob(MESSAGE);
    
    if (!jobId) {
      console.error('Failed to submit job');
      process.exit(1);
    }
    
    // Poll for completion
    await pollJob(jobId);
    
    // Get final metrics
    await getMetrics();
    
    console.log('\n=== Test Complete ===');
  } catch (error) {
    console.error('\n=== Error ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();

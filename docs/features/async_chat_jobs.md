# Async Chat Job Queue - Backend Continuity

## Overview

This feature allows LibreChat to continue processing LLM requests and saving chat history even after the client disconnects. This is achieved using a Redis-based job queue (BullMQ) that processes chat requests asynchronously.

## Architecture

### Components

1. **Job Queue Service** (`chatJobService.js`)
   - Submits chat jobs to the queue
   - Retrieves job status
   - Manages job lifecycle

2. **Job Processor** (`chatJobProcessor.js`)
   - Processes chat jobs asynchronously
   - Communicates with LLM endpoints
   - Saves messages and conversations to database

3. **Worker** (`chatWorker.js`)
   - Consumes jobs from the queue
   - Runs multiple concurrent workers (default: 3)

4. **Queue Configuration** (`queueConfig.js`)
   - Configures Redis connection for BullMQ
   - Provides queue and worker factory functions

## API Endpoints

### Submit Chat Job
```
POST /api/jobs/chat
```

Submit a chat request for asynchronous processing.

**Request Body:**
```json
{
  "text": "User message",
  "conversationId": "optional-conversation-id",
  "endpointOption": {
    "endpoint": "openAI",
    "model": "gpt-4"
  },
  "parentMessageId": "optional-parent-message-id"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "unique-job-id",
  "status": "queued",
  "conversationId": "conversation-id",
  "submittedAt": 1234567890,
  "message": "Job submitted successfully. The chat will continue processing even if you disconnect."
}
```

### Get Job Status
```
GET /api/jobs/:jobId
```

Check the status of a submitted job.

**Response:**
```json
{
  "jobId": "unique-job-id",
  "status": "completed",
  "progress": 100,
  "result": {
    "success": true,
    "conversationId": "conversation-id",
    "messageId": "message-id",
    "text": "AI response",
    "completedAt": 1234567890
  },
  "submittedAt": 1234567890,
  "processedOn": 1234567891,
  "finishedOn": 1234567895
}
```

**Job Status Values:**
- `queued` - Job is waiting in the queue
- `waiting` - Job is waiting for dependencies
- `active` - Job is currently being processed
- `completed` - Job completed successfully
- `failed` - Job failed with an error
- `not_found` - Job not found or expired

### Cancel Job
```
DELETE /api/jobs/:jobId
```

Cancel a pending or active job.

**Response:**
```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

### Get Queue Metrics
```
GET /api/jobs/metrics
```

Get current queue statistics.

**Response:**
```json
{
  "available": true,
  "waiting": 5,
  "active": 2,
  "completed": 100,
  "failed": 3,
  "delayed": 1,
  "paused": 0
}
```

## Configuration

### Environment Variables

The job queue system uses the existing Redis configuration:

- `USE_REDIS` - Enable Redis (required for job queue)
- `REDIS_URI` - Redis connection URI
- `REDIS_USERNAME` - Redis username (optional)
- `REDIS_PASSWORD` - Redis password (optional)
- `REDIS_CA` - Redis CA certificate (optional for TLS)

### Worker Configuration

Workers are automatically started when the server starts. You can configure the number of concurrent workers in `api/server/index.js`:

```javascript
startChatWorker({ concurrency: 3 }); // Process up to 3 jobs concurrently
```

## Usage Example

### Frontend Implementation

```javascript
// Submit a chat job
async function submitAsyncChat(text, conversationId, endpointOption) {
  const response = await fetch('/api/jobs/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      text,
      conversationId,
      endpointOption
    })
  });
  
  const { jobId } = await response.json();
  return jobId;
}

// Poll for job status
async function pollJobStatus(jobId) {
  const response = await fetch(`/api/jobs/${jobId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const status = await response.json();
  return status;
}

// Example usage
const jobId = await submitAsyncChat('Hello!', null, { endpoint: 'openAI' });

// Poll every 2 seconds
const interval = setInterval(async () => {
  const status = await pollJobStatus(jobId);
  
  if (status.status === 'completed') {
    console.log('Response:', status.result.text);
    clearInterval(interval);
  } else if (status.status === 'failed') {
    console.error('Job failed:', status.failedReason);
    clearInterval(interval);
  }
}, 2000);
```

## Benefits

1. **Client Disconnection Resilience**: Chat processing continues even if the browser tab is closed or network connection is lost
2. **Background Processing**: Long-running LLM requests don't block the client
3. **Job Monitoring**: Track job progress and retrieve results later
4. **Scalability**: Multiple workers can process jobs concurrently
5. **Reliability**: Jobs are persisted in Redis and can survive server restarts

## Limitations

1. **Redis Requirement**: Redis must be enabled for this feature to work
2. **No Real-time Streaming**: Jobs don't support SSE streaming to clients (responses are returned when complete)
3. **Polling Required**: Clients must poll for job status rather than receiving push notifications
4. **Resource Usage**: Background workers consume server resources even without active clients

## Future Enhancements

- WebSocket support for real-time job status updates
- Scheduled jobs and recurring tasks
- Priority-based job processing
- Job result caching and retrieval APIs
- Dashboard for monitoring job queue health

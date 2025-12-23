# Backend Chat Continuity - Implementation Summary

## Overview
This implementation adds asynchronous job queue functionality to LibreChat, allowing the server to continue processing LLM requests and saving chat history even after the client disconnects.

## Problem Solved
Previously, if a user's browser closed or network connection was lost during an LLM request, the entire conversation would be lost. This implementation uses a Redis-based job queue (BullMQ) to decouple chat processing from client connections.

## Architecture

```
Client Request → API Endpoint → Job Queue (Redis) → Worker Pool → LLM Provider
                      ↓                                    ↓
                  Job ID Returned               Database Persistence
                      ↓
            Client Polls Status → Job Result Retrieved
```

### Components

1. **Queue Configuration** (`queueConfig.js`)
   - Manages Redis connection for BullMQ
   - Factory functions for queues, workers, and event listeners
   - Automatic retry logic with exponential backoff

2. **Job Service** (`chatJobService.js`)
   - Job submission with unique IDs
   - Status checking and progress tracking
   - Job cancellation
   - Queue metrics

3. **Job Processor** (`chatJobProcessor.js`)
   - Mock request/response objects
   - LLM communication via existing client infrastructure
   - Progress updates (10%, 20%, 30%, 40%, 80%, 90%, 100%)
   - Error handling with sanitization
   - Database persistence

4. **Worker** (`chatWorker.js`)
   - Consumes jobs from queue
   - Configurable concurrency (default: 3)
   - Automatic startup with server

5. **API Controller** (`JobsController.js`)
   - Endpoint handlers
   - Request validation
   - Response formatting

6. **API Routes** (`jobs.js`)
   - POST /api/jobs/chat
   - GET /api/jobs/:jobId
   - DELETE /api/jobs/:jobId
   - GET /api/jobs/metrics

## Security Features

### API Key Sanitization
The implementation sanitizes error messages to prevent exposure of:
- OpenAI keys (sk-, pk-)
- Slack tokens (xoxb-, xoxa-)
- Google API keys (AIza-)
- GitHub tokens (gho-, ghp-, ghs-, ghu-, github_pat)
- GitLab tokens (glpat-)
- Bearer tokens
- Long alphanumeric strings (32+ chars)
- Email addresses
- Sensitive file paths

### Error Handling
- Invalid Redis URI validation
- JSON parsing with detailed logging
- Proper variable scoping to prevent reference errors
- Error message length limiting (200 chars)

## Configuration

### Environment Variables
```bash
USE_REDIS=true
REDIS_URI=redis://localhost:6379
# Optional:
# REDIS_USERNAME=username
# REDIS_PASSWORD=password
# REDIS_CA=/path/to/ca.pem
```

### Worker Concurrency
Edit `api/server/index.js`:
```javascript
startChatWorker({ concurrency: 5 }); // Adjust as needed
```

## Usage Example

### Submit a Job
```javascript
POST /api/jobs/chat
Content-Type: application/json
Authorization: Bearer <token>

{
  "text": "Hello, world!",
  "endpointOption": {
    "endpoint": "openAI",
    "model": "gpt-4"
  }
}

Response:
{
  "jobId": "abc-123",
  "status": "queued",
  "conversationId": "conv-456",
  "submittedAt": 1234567890
}
```

### Check Status
```javascript
GET /api/jobs/abc-123
Authorization: Bearer <token>

Response:
{
  "jobId": "abc-123",
  "status": "completed",
  "progress": 100,
  "result": {
    "conversationId": "conv-456",
    "messageId": "msg-789",
    "text": "AI response here",
    "completedAt": 1234567895
  }
}
```

## Job States

- **queued**: Job is waiting to be processed
- **waiting**: Job is waiting for dependencies
- **active**: Job is currently being processed
- **completed**: Job finished successfully
- **failed**: Job failed with an error
- **not_found**: Job not found or expired

## Performance Characteristics

### Job Retention
- Completed jobs: 1 hour (configurable)
- Failed jobs: 24 hours (configurable)
- Max completed jobs in memory: 100

### Retry Logic
- Max attempts: 3
- Backoff: Exponential starting at 5 seconds

### Worker Concurrency
- Default: 3 concurrent jobs
- Recommended: 3-5 for production
- Adjust based on server resources and LLM rate limits

## Monitoring

### Queue Metrics
```javascript
GET /api/jobs/metrics
Authorization: Bearer <token>

Response:
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

## Limitations

1. **Redis Requirement**: Feature only works with Redis enabled
2. **No Streaming**: Jobs don't support SSE streaming (response returned when complete)
3. **Polling Required**: Clients must poll for status updates
4. **Resource Usage**: Background workers consume server resources

## Testing

### Unit Tests
```bash
cd api
npm test test/services/Jobs/chatJobService.spec.js
```

### Manual Testing
```bash
cd docs/features
node async_chat_jobs_test_client.js <your-auth-token> "Test message"
```

## Troubleshooting

### Worker Not Starting
- Check Redis connection (`USE_REDIS=true` and valid `REDIS_URI`)
- Check logs for connection errors
- Verify Redis server is running

### Jobs Stuck in Queue
- Check worker logs for errors
- Verify LLM API credentials
- Check queue metrics for failed jobs

### High Memory Usage
- Reduce worker concurrency
- Decrease job retention times
- Monitor queue size

## Future Enhancements

- WebSocket support for real-time updates
- Priority-based job processing
- Scheduled/recurring jobs
- Job result caching
- Admin dashboard for queue monitoring
- Multi-queue support for different endpoints

## Migration Notes

### Enabling the Feature
1. Enable Redis in your environment
2. Restart the server
3. Workers start automatically
4. No database migrations required

### Disabling the Feature
1. Set `USE_REDIS=false` or remove Redis configuration
2. Restart the server
3. Regular synchronous chat continues to work
4. Queued jobs will be lost

## Support

For issues or questions:
1. Check logs in `api/logs/`
2. Review Redis connection status
3. Verify queue metrics endpoint
4. Test with the provided test client

## License
Same as LibreChat (MIT)

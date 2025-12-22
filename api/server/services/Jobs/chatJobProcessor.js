const { logger } = require('@librechat/data-schemas');
const { initializeClient } = require('~/server/services/Endpoints/agents');
const addTitle = require('~/server/services/Endpoints/agents/title');
const { saveMessage, saveConvo } = require('~/models');

/**
 * Mock response object for non-streaming mode
 * This allows us to capture events without sending to a real HTTP response
 */
class MockResponse {
  constructor(jobId) {
    this.jobId = jobId;
    this.events = [];
    this.finished = false;
    this.statusCode = 200;
  }

  write(data) {
    try {
      const lines = data.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6);
          if (jsonStr !== '[DONE]') {
            const parsed = JSON.parse(jsonStr);
            this.events.push(parsed);
          }
        }
      }
    } catch (error) {
      logger.error('[MockResponse] Failed to parse SSE data:', error);
    }
  }

  setHeader() {
    // No-op for mock
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  end() {
    this.finished = true;
  }

  on() {
    // No-op for mock
  }

  removeListener() {
    // No-op for mock
  }

  getEvents() {
    return this.events;
  }
}

/**
 * Process a chat job asynchronously
 * @param {Object} job - BullMQ job object
 * @returns {Promise<Object>} Job result
 */
async function processChatJob(job) {
  const { userId, conversationId, text, endpointOption, body } = job.data;
  
  logger.info(`[ChatJobProcessor] Processing job ${job.id} for user ${userId}`);
  
  try {
    // Update progress
    await job.updateProgress(10);

    // Create mock request and response objects
    const mockRes = new MockResponse(job.id);
    
    const mockReq = {
      user: { id: userId },
      body: {
        ...body,
        text,
        conversationId,
        endpointOption,
      },
      app: {
        locals: {},
      },
    };

    // Initialize the client
    await job.updateProgress(20);
    const { client } = await initializeClient({
      req: mockReq,
      res: mockRes,
      endpointOption,
    });

    await job.updateProgress(30);

    // Prepare message options
    const messageOptions = {
      user: userId,
      conversationId,
      parentMessageId: body.parentMessageId,
      overrideParentMessageId: body.overrideParentMessageId,
      isRegenerate: body.isRegenerate || false,
      isContinued: body.isContinued || false,
      editedContent: body.editedContent || null,
      responseMessageId: body.responseMessageId,
      getReqData: (data = {}) => {
        // Capture data for saving
        return data;
      },
      progressOptions: {
        res: mockRes,
      },
    };

    // Send the message (this will process the LLM request)
    await job.updateProgress(40);
    const response = await client.sendMessage(text, messageOptions);
    await job.updateProgress(80);

    // Wait for database operations to complete
    if (response.databasePromise) {
      await response.databasePromise;
    }

    await job.updateProgress(90);

    // Add title if new conversation
    if (!body.conversationId && response.conversationId) {
      try {
        await addTitle(mockReq, {
          text,
          response: response,
          client,
        });
      } catch (titleError) {
        logger.error('[ChatJobProcessor] Failed to add title:', titleError);
        // Non-critical error, continue
      }
    }

    await job.updateProgress(100);

    logger.info(`[ChatJobProcessor] Job ${job.id} completed successfully`);

    return {
      success: true,
      conversationId: response.conversationId || conversationId,
      messageId: response.messageId,
      text: response.text,
      endpoint: endpointOption.endpoint,
      completedAt: Date.now(),
    };

  } catch (error) {
    logger.error(`[ChatJobProcessor] Job ${job.id} failed:`, error);
    
    // Try to save error state to database if we have enough context
    try {
      if (conversationId) {
        const errorMessage = {
          conversationId,
          user: userId,
          text: `[Error processing message: ${error.message}]`,
          isCreatedByUser: false,
          error: true,
        };
        await saveMessage(mockReq, errorMessage, { context: 'ChatJobProcessor error' });
      }
    } catch (saveError) {
      logger.error('[ChatJobProcessor] Failed to save error message:', saveError);
    }

    throw error;
  }
}

module.exports = {
  processChatJob,
  MockResponse,
};

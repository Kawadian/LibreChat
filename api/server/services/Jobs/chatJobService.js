const { v4: uuidv4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { createQueue } = require('./queueConfig');

const CHAT_QUEUE_NAME = 'librechat:chat';

class ChatJobService {
  constructor() {
    this.queue = createQueue(CHAT_QUEUE_NAME);
    if (!this.queue) {
      logger.warn('[ChatJobService] Job queue not available. Async mode will not work.');
    }
  }

  /**
   * Submit a chat job to the queue
   * @param {Object} jobData - Job data
   * @param {string} jobData.userId - User ID
   * @param {string} jobData.conversationId - Conversation ID
   * @param {string} jobData.text - User message text
   * @param {Object} jobData.endpointOption - Endpoint configuration
   * @param {Object} jobData.body - Full request body
   * @returns {Promise<{jobId: string, status: string}>} Job info
   */
  async submitChatJob(jobData) {
    if (!this.queue) {
      throw new Error('Job queue not available. Redis must be enabled to use async chat mode.');
    }

    const jobId = uuidv4();
    
    try {
      const job = await this.queue.add(
        'processChat',
        {
          ...jobData,
          submittedAt: Date.now(),
        },
        {
          jobId,
          priority: jobData.priority || 10,
        }
      );

      logger.info(`[ChatJobService] Job ${jobId} submitted for user ${jobData.userId}`);

      return {
        jobId: job.id,
        status: 'queued',
        conversationId: jobData.conversationId,
        submittedAt: Date.now(),
      };
    } catch (error) {
      logger.error('[ChatJobService] Failed to submit job:', error);
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status info
   */
  async getJobStatus(jobId) {
    if (!this.queue) {
      throw new Error('Job queue not available');
    }

    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return {
          jobId,
          status: 'not_found',
          message: 'Job not found or expired',
        };
      }

      const state = await job.getState();
      const progress = job.progress;
      const result = job.returnvalue;
      const failedReason = job.failedReason;

      return {
        jobId,
        status: state,
        progress,
        result,
        failedReason,
        conversationId: job.data?.conversationId,
        submittedAt: job.data?.submittedAt,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
      };
    } catch (error) {
      logger.error(`[ChatJobService] Failed to get job status for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} Success status
   */
  async cancelJob(jobId) {
    if (!this.queue) {
      throw new Error('Job queue not available');
    }

    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return false;
      }

      const state = await job.getState();
      
      // Only cancel if job is waiting or active
      if (state === 'waiting' || state === 'active' || state === 'delayed') {
        await job.remove();
        logger.info(`[ChatJobService] Job ${jobId} cancelled`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[ChatJobService] Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get queue metrics
   * @returns {Promise<Object>} Queue metrics
   */
  async getQueueMetrics() {
    if (!this.queue) {
      return { available: false };
    }

    try {
      const counts = await this.queue.getJobCounts();
      
      return {
        available: true,
        ...counts,
      };
    } catch (error) {
      logger.error('[ChatJobService] Failed to get queue metrics:', error);
      return { available: false, error: error.message };
    }
  }

  /**
   * Close the queue connection
   */
  async close() {
    if (this.queue) {
      await this.queue.close();
      logger.info('[ChatJobService] Queue closed');
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get ChatJobService instance
 * @returns {ChatJobService}
 */
function getChatJobService() {
  if (!instance) {
    instance = new ChatJobService();
  }
  return instance;
}

module.exports = {
  ChatJobService,
  getChatJobService,
  CHAT_QUEUE_NAME,
};

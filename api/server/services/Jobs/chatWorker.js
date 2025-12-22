const { logger } = require('@librechat/data-schemas');
const { createWorker } = require('./queueConfig');
const { processChatJob } = require('./chatJobProcessor');
const { CHAT_QUEUE_NAME } = require('./chatJobService');

let worker = null;

/**
 * Start the chat job worker
 * @param {Object} options - Worker options
 * @returns {Worker|null} Worker instance
 */
function startChatWorker(options = {}) {
  if (worker) {
    logger.warn('[ChatWorker] Worker already running');
    return worker;
  }

  worker = createWorker(CHAT_QUEUE_NAME, processChatJob, {
    concurrency: options.concurrency || 3,
  });

  if (!worker) {
    logger.warn('[ChatWorker] Failed to create worker - Redis not available');
    return null;
  }

  logger.info('[ChatWorker] Chat worker started');
  return worker;
}

/**
 * Stop the chat job worker
 */
async function stopChatWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info('[ChatWorker] Chat worker stopped');
  }
}

/**
 * Get worker instance
 * @returns {Worker|null}
 */
function getChatWorker() {
  return worker;
}

module.exports = {
  startChatWorker,
  stopChatWorker,
  getChatWorker,
};

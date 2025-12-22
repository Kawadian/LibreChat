const { Queue, Worker, QueueEvents } = require('bullmq');
const { logger } = require('@librechat/data-schemas');
const { cacheConfig } = require('@librechat/api');

/**
 * Get Redis connection configuration for BullMQ
 * @returns {Object} Redis connection config
 */
function getRedisConnection() {
  if (!cacheConfig.USE_REDIS) {
    logger.warn('[JobQueue] Redis is not enabled. Job queue functionality will not work.');
    return null;
  }

  const urls = cacheConfig.REDIS_URI?.split(',').map((uri) => new URL(uri)) || [];
  const username = urls?.[0]?.username || cacheConfig.REDIS_USERNAME;
  const password = urls?.[0]?.password || cacheConfig.REDIS_PASSWORD;
  const ca = cacheConfig.REDIS_CA;

  const connection = {
    host: urls[0]?.hostname || 'localhost',
    port: parseInt(urls[0]?.port, 10) || 6379,
    username,
    password,
    ...(ca ? { tls: { ca } } : {}),
  };

  logger.info('[JobQueue] Redis connection configured', {
    host: connection.host,
    port: connection.port,
  });

  return connection;
}

/**
 * Create a BullMQ queue
 * @param {string} queueName - Name of the queue
 * @returns {Queue|null} Queue instance or null if Redis is not available
 */
function createQueue(queueName) {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep max 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  });

  queue.on('error', (error) => {
    logger.error(`[JobQueue] Queue ${queueName} error:`, error);
  });

  logger.info(`[JobQueue] Queue ${queueName} created`);
  return queue;
}

/**
 * Create a BullMQ worker
 * @param {string} queueName - Name of the queue
 * @param {Function} processor - Job processor function
 * @param {Object} options - Worker options
 * @returns {Worker|null} Worker instance or null if Redis is not available
 */
function createWorker(queueName, processor, options = {}) {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: options.concurrency || 5,
    ...options,
  });

  worker.on('completed', (job) => {
    logger.info(`[JobQueue] Job ${job.id} in queue ${queueName} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[JobQueue] Job ${job?.id} in queue ${queueName} failed:`, err);
  });

  worker.on('error', (error) => {
    logger.error(`[JobQueue] Worker ${queueName} error:`, error);
  });

  logger.info(`[JobQueue] Worker ${queueName} created with concurrency ${options.concurrency || 5}`);
  return worker;
}

/**
 * Create queue events listener
 * @param {string} queueName - Name of the queue
 * @returns {QueueEvents|null} QueueEvents instance or null if Redis is not available
 */
function createQueueEvents(queueName) {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  const queueEvents = new QueueEvents(queueName, { connection });

  queueEvents.on('completed', ({ jobId }) => {
    logger.debug(`[JobQueue] Job ${jobId} completed event`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.debug(`[JobQueue] Job ${jobId} failed event: ${failedReason}`);
  });

  return queueEvents;
}

module.exports = {
  getRedisConnection,
  createQueue,
  createWorker,
  createQueueEvents,
};

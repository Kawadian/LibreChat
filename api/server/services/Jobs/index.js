const { getChatJobService, ChatJobService, CHAT_QUEUE_NAME } = require('./chatJobService');
const { startChatWorker, stopChatWorker, getChatWorker } = require('./chatWorker');
const { processChatJob } = require('./chatJobProcessor');
const { createQueue, createWorker, getRedisConnection } = require('./queueConfig');

module.exports = {
  // Job service
  getChatJobService,
  ChatJobService,
  CHAT_QUEUE_NAME,
  
  // Worker
  startChatWorker,
  stopChatWorker,
  getChatWorker,
  
  // Processor
  processChatJob,
  
  // Queue utilities
  createQueue,
  createWorker,
  getRedisConnection,
};

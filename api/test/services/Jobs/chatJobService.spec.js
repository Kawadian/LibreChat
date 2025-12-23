const { ChatJobService } = require('~/server/services/Jobs');

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@librechat/api', () => ({
  cacheConfig: {
    USE_REDIS: false,
    REDIS_URI: null,
  },
}));

describe('ChatJobService', () => {
  let chatJobService;

  beforeEach(() => {
    chatJobService = new ChatJobService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance without Redis', () => {
      expect(chatJobService).toBeInstanceOf(ChatJobService);
      expect(chatJobService.queue).toBeNull();
    });
  });

  describe('submitChatJob', () => {
    it('should throw error when Redis is not available', async () => {
      const jobData = {
        userId: 'user123',
        conversationId: 'conv123',
        text: 'Hello',
        endpointOption: { endpoint: 'openAI' },
        body: {},
      };

      await expect(chatJobService.submitChatJob(jobData)).rejects.toThrow(
        'Job queue not available. Redis must be enabled to use async chat mode.'
      );
    });
  });

  describe('getJobStatus', () => {
    it('should throw error when Redis is not available', async () => {
      await expect(chatJobService.getJobStatus('job123')).rejects.toThrow(
        'Job queue not available'
      );
    });
  });

  describe('cancelJob', () => {
    it('should throw error when Redis is not available', async () => {
      await expect(chatJobService.cancelJob('job123')).rejects.toThrow(
        'Job queue not available'
      );
    });
  });

  describe('getQueueMetrics', () => {
    it('should return unavailable status when Redis is not configured', async () => {
      const metrics = await chatJobService.getQueueMetrics();
      expect(metrics).toEqual({ available: false });
    });
  });

  describe('close', () => {
    it('should close gracefully even without queue', async () => {
      await expect(chatJobService.close()).resolves.not.toThrow();
    });
  });
});

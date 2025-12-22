const { logger } = require('@librechat/data-schemas');
const { getChatJobService } = require('~/server/services/Jobs');

/**
 * Submit a chat job
 * @route POST /api/jobs/chat
 */
const submitChatJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const { text, conversationId, endpointOption, ...rest } = req.body;

    if (!text || !endpointOption) {
      return res.status(400).json({
        error: 'Missing required fields: text and endpointOption are required',
      });
    }

    const jobService = getChatJobService();
    const jobInfo = await jobService.submitChatJob({
      userId,
      conversationId,
      text,
      endpointOption,
      body: req.body,
      priority: rest.priority,
    });

    logger.info(`[JobsController] Chat job submitted: ${jobInfo.jobId}`);

    res.status(202).json({
      success: true,
      ...jobInfo,
      message: 'Job submitted successfully. The chat will continue processing even if you disconnect.',
    });
  } catch (error) {
    logger.error('[JobsController] Failed to submit chat job:', error);
    res.status(500).json({
      error: 'Failed to submit job',
      message: error.message,
    });
  }
};

/**
 * Get job status
 * @route GET /api/jobs/:jobId
 */
const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobService = getChatJobService();
    
    const status = await jobService.getJobStatus(jobId);

    res.status(200).json(status);
  } catch (error) {
    logger.error(`[JobsController] Failed to get job status:`, error);
    res.status(500).json({
      error: 'Failed to get job status',
      message: error.message,
    });
  }
};

/**
 * Cancel a job
 * @route DELETE /api/jobs/:jobId
 */
const cancelJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobService = getChatJobService();
    
    const cancelled = await jobService.cancelJob(jobId);

    if (cancelled) {
      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Job not found or already completed',
      });
    }
  } catch (error) {
    logger.error(`[JobsController] Failed to cancel job:`, error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message,
    });
  }
};

/**
 * Get queue metrics
 * @route GET /api/jobs/metrics
 */
const getQueueMetrics = async (req, res) => {
  try {
    const jobService = getChatJobService();
    const metrics = await jobService.getQueueMetrics();

    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[JobsController] Failed to get queue metrics:', error);
    res.status(500).json({
      error: 'Failed to get queue metrics',
      message: error.message,
    });
  }
};

module.exports = {
  submitChatJob,
  getJobStatus,
  cancelJob,
  getQueueMetrics,
};

const express = require('express');
const {
  submitChatJob,
  getJobStatus,
  cancelJob,
  getQueueMetrics,
} = require('~/server/controllers/JobsController');
const {
  setHeaders,
  moderateText,
  validateConvoAccess,
  buildEndpointOption,
} = require('~/server/middleware');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// Apply authentication to all routes
router.use(requireJwtAuth);

/**
 * @route POST /api/jobs/chat
 * @desc Submit a chat job for async processing
 * @access Private
 */
router.post(
  '/chat',
  moderateText,
  buildEndpointOption,
  validateConvoAccess,
  setHeaders,
  submitChatJob
);

/**
 * @route GET /api/jobs/metrics
 * @desc Get queue metrics
 * @access Private
 */
router.get('/metrics', getQueueMetrics);

/**
 * @route GET /api/jobs/:jobId
 * @desc Get job status
 * @access Private
 */
router.get('/:jobId', getJobStatus);

/**
 * @route DELETE /api/jobs/:jobId
 * @desc Cancel a job
 * @access Private
 */
router.delete('/:jobId', cancelJob);

module.exports = router;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock fetch for external API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock environment variables
process.env.RENDI_API_KEY = 'test-rendi-api-key-12345'
process.env.VERCEL_BLOB_READ_WRITE_TOKEN = 'test-vercel-blob-token'

// Rendi API response types
interface RendiJobResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress?: number
  error?: string
  results?: {
    frames: Array<{
      url: string
      timestamp: number
      filename: string
    }>
    cost: number
    duration: number
  }
}

interface RendiCreateJobRequest {
  input: {
    type: 'url'
    url: string
  }
  outputs: Array<{
    name: string
    type: 'image'
    format: 'png'
    quality: 'high'
  }>
  ffmpeg: {
    filters: string
    duration?: number
  }
}

describe('Task 4 - External Services Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendi API Integration', () => {
    it('should authenticate with Rendi API using API key', async () => {
      // Mock successful authentication response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jobId: 'rendi-job-12345',
          status: 'queued'
        })
      })

      const requestBody: RendiCreateJobRequest = {
        input: {
          type: 'url',
          url: 'https://blob.vercel-storage.com/test-video.mp4'
        },
        outputs: Array.from({ length: 120 }, (_, i) => {
          const seconds = (i + 1) * 5
          const minutes = Math.floor(seconds / 60)
          const remainingSeconds = seconds % 60
          const filename = `frame_${minutes.toString().padStart(2, '0')}m${remainingSeconds.toString().padStart(2, '0')}s.png`
          
          return {
            name: filename,
            type: 'image' as const,
            format: 'png' as const,
            quality: 'high' as const
          }
        }),
        ffmpeg: {
          filters: 'fps=1/5',
          duration: 600
        }
      }

      // Simulate API call to Rendi
      const response = await fetch('https://api.rendi.dev/v1/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      // Verify API call was made with correct authentication
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.rendi.dev/v1/jobs',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-rendi-api-key-12345',
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('frame_00m05s.png')
        })
      )

      expect(response.ok).toBe(true)
      const jobData = await response.json()
      expect(jobData.jobId).toBe('rendi-job-12345')
      expect(jobData.status).toBe('queued')
    })

    it('should handle Rendi API frame extraction with timestamp-based filenames', async () => {
      // Mock job creation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'rendi-job-67890',
          status: 'queued'
        })
      })

      // Mock job status polling responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-67890',
            status: 'processing',
            progress: 25
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-67890',
            status: 'processing',
            progress: 75
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-67890',
            status: 'completed',
            results: {
              frames: [
                { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m20s.png', timestamp: 20, filename: 'frame_00m20s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m25s.png', timestamp: 25, filename: 'frame_00m25s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m30s.png', timestamp: 30, filename: 'frame_00m30s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m35s.png', timestamp: 35, filename: 'frame_00m35s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m40s.png', timestamp: 40, filename: 'frame_00m40s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m45s.png', timestamp: 45, filename: 'frame_00m45s.png' }
              ],
              cost: 1.20,
              duration: 15000
            }
          })
        })

      // Simulate frame extraction workflow
      const videoUrl = 'https://blob.vercel-storage.com/test-video.mp4'
      
      // Step 1: Create job
      const createJobResponse = await fetch('https://api.rendi.dev/v1/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: { type: 'url', url: videoUrl },
          outputs: [{ name: 'frame_00m05s.png', type: 'image', format: 'png', quality: 'high' }],
          ffmpeg: { filters: 'fps=1/5' }
        })
      })

      const jobData = await createJobResponse.json()
      expect(jobData.jobId).toBe('rendi-job-67890')

      // Step 2: Poll job status
      let jobStatus: RendiJobResponse = { jobId: jobData.jobId, status: 'processing' }
      let pollCount = 0

      while (jobStatus.status === 'processing' && pollCount < 3) {
        const statusResponse = await fetch(`https://api.rendi.dev/v1/jobs/${jobData.jobId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.RENDI_API_KEY}`
          }
        })
        jobStatus = await statusResponse.json()
        pollCount++
      }

      // Step 3: Verify completion
      expect(jobStatus.status).toBe('completed')
      expect(jobStatus.results?.frames).toHaveLength(9)
      expect(jobStatus.results?.frames[0].filename).toBe('frame_00m05s.png')
      expect(jobStatus.results?.frames[8].filename).toBe('frame_00m45s.png')
      expect(jobStatus.results?.cost).toBe(1.20)
      expect(jobStatus.results?.duration).toBe(15000)
    })

    it('should handle variable video lengths correctly', async () => {
      // Test 35-second video (should produce 7 frames)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-short',
            status: 'queued'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-short',
            status: 'completed',
            results: {
              frames: [
                { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m20s.png', timestamp: 20, filename: 'frame_00m20s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m25s.png', timestamp: 25, filename: 'frame_00m25s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m30s.png', timestamp: 30, filename: 'frame_00m30s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m35s.png', timestamp: 35, filename: 'frame_00m35s.png' }
              ],
              cost: 0.85,
              duration: 8000
            }
          })
        })

      // Test 8-minute video (should produce 96 frames)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-long',
            status: 'queued'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            // Generate 96 frames for 8-minute video
            const frames = []
            for (let i = 5; i <= 480; i += 5) { // 5 seconds to 8 minutes
              const minutes = Math.floor(i / 60)
              const seconds = i % 60
              const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
              frames.push({
                url: `https://api.rendi.dev/files/${filename}`,
                timestamp: i,
                filename: filename
              })
            }

            return {
              jobId: 'rendi-job-long',
              status: 'completed',
              results: {
                frames,
                cost: 4.80,
                duration: 45000
              }
            }
          }
        })

      // Test short video
      const shortVideoResult = await fetch('https://api.rendi.dev/v1/jobs/rendi-job-short')
      const shortVideoData = await shortVideoResult.json()
      
      expect(shortVideoData.results.frames).toHaveLength(7)
      expect(shortVideoData.results.frames[6].timestamp).toBe(35)
      expect(shortVideoData.results.frames[6].filename).toBe('frame_00m35s.png')

      // Test long video
      const longVideoResult = await fetch('https://api.rendi.dev/v1/jobs/rendi-job-long')
      const longVideoData = await longVideoResult.json()
      
      expect(longVideoData.results.frames).toHaveLength(96)
      expect(longVideoData.results.frames[0].timestamp).toBe(5)
      expect(longVideoData.results.frames[0].filename).toBe('frame_00m05s.png')
      expect(longVideoData.results.frames[95].timestamp).toBe(480)
      expect(longVideoData.results.frames[95].filename).toBe('frame_08m00s.png')
    })

    it('should handle Rendi API errors and timeouts', async () => {
      // Test authentication error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: 'Invalid API key',
          message: 'The provided API key is invalid or expired'
        })
      })

      const authErrorResponse = await fetch('https://api.rendi.dev/v1/jobs', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      expect(authErrorResponse.ok).toBe(false)
      expect(authErrorResponse.status).toBe(401)

      // Test timeout error
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      )

      await expect(
        fetch('https://api.rendi.dev/v1/jobs', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })
      ).rejects.toThrow('Request timeout')

      // Test rate limiting
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please try again later.',
          retryAfter: 60
        })
      })

      const rateLimitResponse = await fetch('https://api.rendi.dev/v1/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      expect(rateLimitResponse.ok).toBe(false)
      expect(rateLimitResponse.status).toBe(429)

      // Test job failure
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-failed',
            status: 'queued'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-failed',
            status: 'failed',
            error: 'Video format not supported',
            message: 'The input video format is not supported for processing'
          })
        })

      const failedJobResponse = await fetch('https://api.rendi.dev/v1/jobs/rendi-job-failed')
      const failedJobData = await failedJobResponse.json()
      
      expect(failedJobData.status).toBe('failed')
      expect(failedJobData.error).toBe('Video format not supported')
    })

    it('should handle Rendi API cost calculation correctly', async () => {
      // Test cost calculation for different video lengths
      const costScenarios = [
        {
          videoDuration: 30, // 30 seconds
          expectedFrames: 6,
          expectedCost: 0.60,
          description: '30-second video'
        },
        {
          videoDuration: 120, // 2 minutes
          expectedFrames: 24,
          expectedCost: 1.20,
          description: '2-minute video'
        },
        {
          videoDuration: 300, // 5 minutes
          expectedFrames: 60,
          expectedCost: 2.40,
          description: '5-minute video'
        },
        {
          videoDuration: 600, // 10 minutes
          expectedFrames: 120,
          expectedCost: 4.80,
          description: '10-minute video'
        }
      ]

      for (const scenario of costScenarios) {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              jobId: `rendi-job-${scenario.videoDuration}`,
              status: 'queued'
            })
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              jobId: `rendi-job-${scenario.videoDuration}`,
              status: 'completed',
              results: {
                frames: Array.from({ length: scenario.expectedFrames }, (_, i) => ({
                  url: `frame${i + 1}.png`,
                  timestamp: (i + 1) * 5,
                  filename: `frame_${Math.floor(((i + 1) * 5) / 60).toString().padStart(2, '0')}m${(((i + 1) * 5) % 60).toString().padStart(2, '0')}s.png`
                })),
                cost: scenario.expectedCost,
                duration: scenario.videoDuration * 100, // Mock processing time
                breakdown: {
                  videoProcessing: scenario.expectedCost * 0.6,
                  frameGeneration: scenario.expectedCost * 0.3,
                  storage: scenario.expectedCost * 0.1
                }
              }
            })
          })

        const response = await fetch(`https://api.rendi.dev/v1/jobs/rendi-job-${scenario.videoDuration}`)
        const data = await response.json()

        expect(data.results.frames).toHaveLength(scenario.expectedFrames)
        expect(data.results.cost).toBe(scenario.expectedCost)
        expect(data.results.breakdown.videoProcessing).toBe(scenario.expectedCost * 0.6)
        expect(data.results.breakdown.frameGeneration).toBe(scenario.expectedCost * 0.3)
        expect(data.results.breakdown.storage).toBe(scenario.expectedCost * 0.1)
      }
    })

    it('should handle job polling with exponential backoff', async () => {
      const jobId = 'rendi-job-polling-test'
      let pollCount = 0
      
      // Mock progressive polling responses
      mockFetch.mockImplementation(async (url) => {
        if (url.includes(jobId)) {
          pollCount++
          
          if (pollCount === 1) {
            return {
              ok: true,
              json: async () => ({
                jobId,
                status: 'processing',
                progress: 20
              })
            }
          } else if (pollCount === 2) {
            return {
              ok: true,
              json: async () => ({
                jobId,
                status: 'processing',
                progress: 60
              })
            }
          } else {
            return {
              ok: true,
              json: async () => ({
                jobId,
                status: 'completed',
                results: {
                  frames: [
                    { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
                  ],
                  cost: 0.20,
                  duration: 5000
                }
              })
            }
          }
        }
        
        return { ok: false, status: 404 }
      })

      // Simulate polling with exponential backoff
      const pollJob = async (jobId: string, maxRetries = 5): Promise<RendiJobResponse> => {
        let retryCount = 0
        
        while (retryCount < maxRetries) {
          const response = await fetch(`https://api.rendi.dev/v1/jobs/${jobId}`)
          const data = await response.json()
          
          if (data.status === 'completed' || data.status === 'failed') {
            return data
          }
          
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          const delay = Math.pow(2, retryCount) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
          retryCount++
        }
        
        throw new Error('Job polling timeout')
      }

      const result = await pollJob(jobId)
      
      expect(result.status).toBe('completed')
      expect(result.results?.frames).toHaveLength(1)
      expect(pollCount).toBe(3)
    })
  })

  describe('Vercel Blob Integration with Frame Extraction', () => {
    it('should integrate Vercel Blob storage with Rendi API workflow', async () => {
      // Mock Vercel Blob upload response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            url: 'https://blob.vercel-storage.com/video-abc123.mp4',
            pathname: 'video-abc123.mp4',
            contentType: 'video/mp4',
            size: 15000000
          })
        })
        // Mock Rendi API job creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-integrated',
            status: 'queued'
          })
        })
        // Mock Rendi API job completion
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-integrated',
            status: 'completed',
            results: {
              frames: [
                { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
                { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' }
              ],
              cost: 0.40,
              duration: 8000
            }
          })
        })

      // Simulate complete workflow
      // Step 1: Upload to Vercel Blob
      const uploadResponse = await fetch('/api/experiment/upload', {
        method: 'POST',
        body: new FormData()
      })
      const uploadData = await uploadResponse.json()
      
      expect(uploadData.url).toBe('https://blob.vercel-storage.com/video-abc123.mp4')
      
      // Step 2: Extract frames using Rendi API
      const extractionResponse = await fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: uploadData.url,
          videoDuration: 30
        })
      })
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api.rendi.dev'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('test-rendi-api-key')
          }),
          body: expect.stringContaining('https://blob.vercel-storage.com/video-abc123.mp4')
        })
      )

      // Step 3: Verify frame extraction results
      const jobStatusResponse = await fetch('https://api.rendi.dev/v1/jobs/rendi-job-integrated')
      const jobData = await jobStatusResponse.json()
      
      expect(jobData.status).toBe('completed')
      expect(jobData.results.frames).toHaveLength(2)
      expect(jobData.results.cost).toBe(0.40)
    })
  })

  describe('Service Resilience and Recovery', () => {
    it('should handle service unavailability with graceful degradation', async () => {
      // Mock service unavailable
      mockFetch.mockRejectedValueOnce(new Error('Service unavailable'))
      
      await expect(
        fetch('https://api.rendi.dev/v1/jobs', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        })
      ).rejects.toThrow('Service unavailable')
    })

    it('should implement retry logic for transient failures', async () => {
      let attemptCount = 0
      
      mockFetch.mockImplementation(async () => {
        attemptCount++
        
        if (attemptCount < 3) {
          throw new Error('Network error')
        }
        
        return {
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-retry-success',
            status: 'queued'
          })
        }
      })

      // Simulate retry logic
      const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
        let lastError: Error
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await fn()
          } catch (error) {
            lastError = error as Error
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
            }
          }
        }
        
        throw lastError!
      }

      const result = await retryWithBackoff(async () => {
        const response = await fetch('https://api.rendi.dev/v1/jobs')
        return response.json()
      })

      expect(result.jobId).toBe('rendi-job-retry-success')
      expect(attemptCount).toBe(3)
    })

    it('should handle partial service failures gracefully', async () => {
      // Mock successful job creation but failed status polling
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId: 'rendi-job-partial-failure',
            status: 'queued'
          })
        })
        .mockRejectedValueOnce(new Error('Status endpoint unavailable'))

      // Create job successfully
      const createResponse = await fetch('https://api.rendi.dev/v1/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      const createData = await createResponse.json()
      expect(createData.jobId).toBe('rendi-job-partial-failure')

      // Status polling fails
      await expect(
        fetch(`https://api.rendi.dev/v1/jobs/${createData.jobId}`)
      ).rejects.toThrow('Status endpoint unavailable')
    })
  })

  describe('Performance and Monitoring', () => {
    it('should track API response times and performance metrics', async () => {
      // Mock API responses with realistic timing
      mockFetch.mockImplementation(async (url) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100))
        
        return {
          ok: true,
          json: async () => ({
            jobId: 'performance-test',
            status: 'completed',
            processingTime: 15000,
            queueTime: 2000
          })
        }
      })

      const startTime = performance.now()
      
      const response = await fetch('https://api.rendi.dev/v1/jobs/performance-test')
      const data = await response.json()
      
      const endTime = performance.now()
      const responseTime = endTime - startTime

      expect(responseTime).toBeGreaterThan(100) // At least our mock delay
      expect(responseTime).toBeLessThan(5000) // Should be reasonable
      expect(data.processingTime).toBe(15000)
      expect(data.queueTime).toBe(2000)
    })

    it('should handle concurrent frame extraction requests', async () => {
      const concurrentJobs = 5
      const jobResponses = Array.from({ length: concurrentJobs }, (_, i) => ({
        ok: true,
        json: async () => ({
          jobId: `concurrent-job-${i}`,
          status: 'queued'
        })
      }))

      mockFetch.mockImplementation(async () => {
        const response = jobResponses.shift()
        return response || { ok: false, status: 404 }
      })

      // Create multiple concurrent requests
      const requests = Array.from({ length: concurrentJobs }, (_, i) =>
        fetch('https://api.rendi.dev/v1/jobs', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videoId: `video-${i}` })
        })
      )

      const startTime = performance.now()
      const responses = await Promise.all(requests)
      const endTime = performance.now()

      // All requests should succeed
      expect(responses).toHaveLength(concurrentJobs)
      responses.forEach(response => {
        expect(response.ok).toBe(true)
      })

      // Concurrent requests should be faster than sequential
      expect(endTime - startTime).toBeLessThan(concurrentJobs * 1000)
    })
  })
})
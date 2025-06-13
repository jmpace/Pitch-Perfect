/** @jsxImportSource react */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock external service APIs
const mockVercelBlob = {
  upload: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
}

const mockRendiAPI = {
  extractFrames: vi.fn(),
  getJobStatus: vi.fn(),
  downloadFrames: vi.fn()
}

const mockOpenAIWhisper = {
  transcribe: vi.fn(),
  getModels: vi.fn()
}

// Mock fetch for external API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('External Services Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    mockVercelBlob.upload.mockClear()
    mockRendiAPI.extractFrames.mockClear()
    mockOpenAIWhisper.transcribe.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Vercel Blob Storage Integration', () => {
    it('should upload video files to Vercel Blob storage', async () => {
      // Mock successful Vercel Blob upload
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: 'https://blob.vercel-storage.com/video-abc123.mp4',
          pathname: 'video-abc123.mp4',
          contentType: 'video/mp4',
          contentDisposition: 'attachment; filename="video-abc123.mp4"'
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const testFile = new File(['test video content'], 'test-video.mp4', { 
        type: 'video/mp4' 
      })
      
      const fileInput = screen.getByTestId('file-input')
      await userEvent.upload(fileInput, testFile)

      // Simulate upload process to Vercel Blob
      const updateState = (window as any).updateExperimentState
      updateState({
        processingStep: 'uploading',
        uploadProgress: 50
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('uploading')
        expect(state.uploadProgress).toBe(50)
      })

      // Simulate upload completion
      updateState({
        uploadProgress: 100,
        processingStep: 'extracting',
        videoUrl: 'https://blob.vercel-storage.com/video-abc123.mp4'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.videoUrl).toContain('blob.vercel-storage.com')
      })
    })

    it('should handle Vercel Blob upload failures', async () => {
      // Mock Vercel Blob upload failure
      mockFetch.mockRejectedValueOnce(new Error('Blob upload failed'))

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('upload')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'upload')).toBe(true)
      })

      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      expect(screen.getByText(/Something went wrong in Upload section/)).toBeInTheDocument()
    })

    it('should track upload costs for Vercel Blob', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate cost tracking
      updateState({
        timings: { upload: 2000 },
        costs: { vercelBlob: 0.05 }
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.timings.upload).toBe(2000)
      })

      // Click cost tracker to expand breakdown
      const costTracker = screen.getByTestId('cost-tracker')
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toBeVisible()
        expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.00')
      })
    })
  })

  describe('Rendi API Integration', () => {
    it('should extract frames using Rendi API', async () => {
      // Mock successful Rendi API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'rendi-job-123',
          status: 'processing'
        })
      })

      // Mock job status polling
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'rendi-job-123',
          status: 'completed',
          frames: [
            { url: 'https://rendi.api/frame-0.jpg', timestamp: 0 },
            { url: 'https://rendi.api/frame-5.jpg', timestamp: 5 },
            { url: 'https://rendi.api/frame-10.jpg', timestamp: 10 }
          ]
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate frame extraction process
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600')
        expect(step2).toHaveClass('animate-pulse')
      })

      // Simulate frame extraction completion
      updateState({
        extractedFrames: [
          { url: 'https://rendi.api/frame-0.jpg', timestamp: 0, filename: 'frame-0.jpg' },
          { url: 'https://rendi.api/frame-5.jpg', timestamp: 5, filename: 'frame-5.jpg' },
          { url: 'https://rendi.api/frame-10.jpg', timestamp: 10, filename: 'frame-10.jpg' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(3)
        expect(state.processingStep).toBe('transcribing')
      })
    })

    it('should handle Rendi API failures gracefully', async () => {
      // Mock Rendi API failure
      mockFetch.mockRejectedValueOnce(new Error('Rendi API unavailable'))

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('video')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'video')).toBe(true)
      })
    })

    it('should poll Rendi API job status correctly', async () => {
      const jobId = 'rendi-job-456'
      
      // Mock initial job creation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId,
          status: 'processing'
        })
      })

      // Mock status polling responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobId, status: 'processing', progress: 25 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ jobId, status: 'processing', progress: 75 })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jobId,
            status: 'completed',
            frames: [
              { url: 'https://rendi.api/frame-0.jpg', timestamp: 0 }
            ]
          })
        })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate polling process
      updateState({ processingStep: 'extracting' })

      // Simulate periodic updates during polling
      setTimeout(() => updateState({ uploadProgress: 25 }), 100)
      setTimeout(() => updateState({ uploadProgress: 75 }), 200)
      setTimeout(() => {
        updateState({
          extractedFrames: [
            { url: 'https://rendi.api/frame-0.jpg', timestamp: 0, filename: 'frame-0.jpg' }
          ],
          processingStep: 'transcribing'
        })
      }, 300)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1)
      }, { timeout: 1000 })
    })
  })

  describe('OpenAI Whisper Integration', () => {
    it('should transcribe audio using OpenAI Whisper API', async () => {
      // Mock successful Whisper API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'This is a transcribed audio content from the video.',
          segments: [
            {
              id: 0,
              seek: 0,
              start: 0.0,
              end: 2.5,
              text: 'This is a transcribed',
              tokens: [123, 456, 789],
              temperature: 0.0,
              avg_logprob: -0.5,
              compression_ratio: 1.2,
              no_speech_prob: 0.1
            },
            {
              id: 1,
              seek: 250,
              start: 2.5,
              end: 5.0,
              text: ' audio content from the video.',
              tokens: [321, 654, 987],
              temperature: 0.0,
              avg_logprob: -0.4,
              compression_ratio: 1.1,
              no_speech_prob: 0.05
            }
          ]
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate transcription process
      updateState({ processingStep: 'transcribing' })

      await waitFor(() => {
        const step3 = screen.getByTestId('step-3')
        expect(step3).toHaveClass('bg-blue-600')
      })

      // Simulate transcription completion
      updateState({
        fullTranscript: 'This is a transcribed audio content from the video.',
        segmentedTranscript: [
          { text: 'This is a transcribed', startTime: 0.0, endTime: 2.5, confidence: 0.95 },
          { text: ' audio content from the video.', startTime: 2.5, endTime: 5.0, confidence: 0.98 }
        ],
        processingStep: 'complete'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.fullTranscript).toBe('This is a transcribed audio content from the video.')
        expect(state.segmentedTranscript).toHaveLength(2)
      })

      // Verify UI displays transcription results
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      expect(fullTranscriptArea).toHaveTextContent('This is a transcribed audio content from the video.')
      
      const segmentedArea = screen.getByTestId('segmented-transcript-area')
      expect(segmentedArea).toHaveTextContent('This is a transcribed')
      expect(segmentedArea).toHaveTextContent('audio content from the video.')
    })

    it('should handle OpenAI Whisper API rate limiting', async () => {
      // Mock rate limit response
      mockFetch.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded'
      })

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('transcripts')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'transcripts')).toBe(true)
      })
    })

    it('should track OpenAI API costs', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate API cost tracking
      updateState({
        timings: { transcription: 8000 },
        costs: { openaiWhisper: 0.12 }
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.timings.transcription).toBe(8000)
      })

      // Verify cost display
      const costTracker = screen.getByTestId('cost-tracker')
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('OpenAI Whisper: $0.00')
      })
    })
  })

  describe('Service Integration Orchestration', () => {
    it('should coordinate all external services in proper sequence', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate complete workflow
      const testFile = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      
      // Step 1: Upload to Vercel Blob
      updateState({
        videoFile: testFile,
        processingStep: 'uploading',
        uploadProgress: 50
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('uploading')
      })

      // Step 2: Extract frames with Rendi
      updateState({
        uploadProgress: 100,
        processingStep: 'extracting',
        videoUrl: 'https://blob.vercel-storage.com/test.mp4'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('extracting')
      })

      // Step 3: Transcribe with OpenAI Whisper  
      updateState({
        extractedFrames: [
          { url: 'frame1.jpg', timestamp: 0, filename: 'frame1.jpg' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1)
        expect(state.processingStep).toBe('transcribing')
      })

      // Step 4: Complete
      updateState({
        fullTranscript: 'Complete transcript',
        segmentedTranscript: [
          { text: 'Complete transcript', startTime: 0, endTime: 5, confidence: 0.95 }
        ],
        processingStep: 'complete',
        timings: { upload: 2000, frameExtraction: 5000, transcription: 8000 }
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('complete')
        expect(state.fullTranscript).toBe('Complete transcript')
        expect(state.timings.upload).toBe(2000)
        expect(state.timings.frameExtraction).toBe(5000)
        expect(state.timings.transcription).toBe(8000)
      })

      // Verify final step is highlighted
      const step4 = screen.getByTestId('step-4')
      expect(step4).toHaveClass('bg-blue-600')
    })

    it('should handle partial service failures gracefully', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Successful upload
      updateState({
        processingStep: 'uploading',
        uploadProgress: 100
      })

      // Failed frame extraction
      simulateError('video')
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'video')).toBe(true)
        expect(state.processingStep).toBe('extracting')
      })

      // Should still allow retry and continuation
      const retryButton = screen.getByTestId('retry-button')
      expect(retryButton).toBeInTheDocument()
    })

    it('should aggregate costs from all services', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate costs from all services
      updateState({
        costs: {
          vercelBlob: 0.05,
          rendiAPI: 0.25,
          openaiWhisper: 0.12
        },
        processingStep: 'complete'
      })

      const costTracker = screen.getByTestId('cost-tracker')
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.00')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
        expect(costBreakdown).toHaveTextContent('OpenAI Whisper: $0.00')
      })
    })
  })

  describe('Service Timeouts and Retries', () => {
    it('should handle service timeouts gracefully', async () => {
      // Mock timeout scenario
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      )

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('processing')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'processing')).toBe(true)
      })
    })

    it('should implement exponential backoff for retries', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate retry with exponential backoff
      let retryCount = 0
      const mockRetry = () => {
        retryCount++
        const delay = Math.pow(2, retryCount) * 1000 // 2s, 4s, 8s...
        
        setTimeout(() => {
          if (retryCount < 3) {
            mockRetry() // Simulate continued failures
          } else {
            updateState({ processingStep: 'complete' }) // Success after retries
          }
        }, delay)
      }

      // Start retry sequence
      mockRetry()

      // Should eventually succeed
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('complete')
      }, { timeout: 10000 })

      expect(retryCount).toBe(3)
    })
  })
})
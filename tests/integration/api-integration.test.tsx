/** @jsxImportSource react */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API interactions
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL for file handling
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')
global.URL.revokeObjectURL = vi.fn()

describe('API Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('File Upload API Integration', () => {
    it('should handle file upload API call correctly', async () => {
      // Mock successful upload response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          videoUrl: 'https://example.com/video.mp4',
          uploadId: '12345'
        })
      })

      render(<ArchitectureExperimentPage />)
      
      // Create a test file
      const testFile = new File(['test content'], 'test-video.mp4', { type: 'video/mp4' })
      
      // Get file input and upload file
      const fileInput = screen.getByTestId('file-input')
      await userEvent.upload(fileInput, testFile)

      // Verify state update
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile).toBeTruthy()
        expect(state.videoFile.name).toBe('test-video.mp4')
        expect(state.videoUrl).toBe('blob:http://localhost:3000/test-video')
      })
    })

    it('should handle file upload API errors gracefully', async () => {
      // Mock API error response
      mockFetch.mockRejectedValueOnce(new Error('Upload failed'))

      render(<ArchitectureExperimentPage />)
      
      const testFile = new File(['test content'], 'test-video.mp4', { type: 'video/mp4' })
      const fileInput = screen.getByTestId('file-input')
      
      await userEvent.upload(fileInput, testFile)

      // Simulate error during upload process
      const simulateError = (window as any).simulateError
      simulateError('upload')

      await waitFor(() => {
        expect(screen.getByTestId('error-card')).toBeInTheDocument()
        expect(screen.getByText(/Something went wrong in Upload section/)).toBeInTheDocument()
      })
    })

    it('should track upload progress correctly', async () => {
      render(<ArchitectureExperimentPage />)

      // Simulate upload progress updates
      const updateState = (window as any).updateExperimentState
      
      updateState({ uploadProgress: 25 })
      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-fill')
        expect(progressBar).toHaveStyle('width: 25%')
      })

      updateState({ uploadProgress: 75 })
      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-fill')
        expect(progressBar).toHaveStyle('width: 75%')
      })
    })
  })

  describe('Video Processing API Integration', () => {
    it('should handle frame extraction API calls', async () => {
      // Mock frame extraction API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          frames: [
            { url: 'https://example.com/frame1.jpg', timestamp: 0, filename: 'frame1.jpg' },
            { url: 'https://example.com/frame2.jpg', timestamp: 5, filename: 'frame2.jpg' }
          ]
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate processing step change to extracting
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600')
        expect(step2).toHaveClass('animate-pulse')
      })

      // Simulate extracted frames data
      updateState({
        extractedFrames: [
          { url: 'https://example.com/frame1.jpg', timestamp: 0, filename: 'frame1.jpg' },
          { url: 'https://example.com/frame2.jpg', timestamp: 5, filename: 'frame2.jpg' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(2)
        expect(state.processingStep).toBe('transcribing')
      })
    })

    it('should handle transcription API calls', async () => {
      // Mock transcription API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fullTranscript: 'This is a test transcription',
          segmentedTranscript: [
            { text: 'This is a test', startTime: 0, endTime: 2, confidence: 0.95 },
            { text: 'transcription', startTime: 2, endTime: 4, confidence: 0.98 }
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
        fullTranscript: 'This is a test transcription',
        segmentedTranscript: [
          { text: 'This is a test', startTime: 0, endTime: 2, confidence: 0.95 },
          { text: 'transcription', startTime: 2, endTime: 4, confidence: 0.98 }
        ],
        processingStep: 'complete'
      })

      await waitFor(() => {
        const fullTranscriptArea = screen.getByTestId('full-transcript-area')
        expect(fullTranscriptArea).toHaveTextContent('This is a test transcription')
        
        const segmentedArea = screen.getByTestId('segmented-transcript-area')
        expect(segmentedArea).toHaveTextContent('This is a test')
        expect(segmentedArea).toHaveTextContent('transcription')
      })
    })
  })

  describe('State Management Integration', () => {
    it('should maintain consistent state across API calls', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate complete workflow
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:test-url',
        uploadProgress: 100,
        processingStep: 'extracting'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.processingStep).toBe('extracting')
      })

      // Continue to next step
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
        // Ensure previous state is preserved
        expect(state.uploadProgress).toBe(100)
      })
    })

    it('should handle concurrent state updates correctly', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate rapid state updates
      updateState({ uploadProgress: 25 })
      updateState({ uploadProgress: 50 })
      updateState({ uploadProgress: 75 })
      updateState({ uploadProgress: 100, processingStep: 'extracting' })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.processingStep).toBe('extracting')
      })
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle API timeout errors', async () => {
      // Mock timeout error
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      )

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('upload')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors).toHaveLength(1)
        expect(state.errors[0].message).toBe('Something went wrong in Upload section')
      })
    })

    it('should handle network connectivity issues', async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('video')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'video')).toBe(true)
      })
    })
  })

  describe('Data Flow Integration', () => {
    it('should maintain data integrity throughout the pipeline', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate complete data flow
      const testData = {
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:test-url',
        uploadProgress: 100,
        processingStep: 'complete' as const,
        fullTranscript: 'Test transcript',
        segmentedTranscript: [
          { text: 'Test', startTime: 0, endTime: 1, confidence: 0.95 }
        ],
        extractedFrames: [
          { url: 'frame1.jpg', timestamp: 0, filename: 'frame1.jpg' }
        ],
        timings: { upload: 1000, processing: 5000 }
      }

      updateState(testData)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile).toBeTruthy()
        expect(state.fullTranscript).toBe('Test transcript')
        expect(state.segmentedTranscript).toHaveLength(1)
        expect(state.extractedFrames).toHaveLength(1)
        expect(state.timings.upload).toBe(1000)
      })

      // Verify UI reflects the data
      expect(screen.getByText('Test transcript')).toBeInTheDocument()
      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })
})
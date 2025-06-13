import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

/**
 * Integration Tests: Component Integration for Mux Migration
 * 
 * Tests the integration between components during the Mux workflow:
 * 1. ArchitectureExperimentPage + UploadDropzone interaction
 * 2. State management across components during video processing
 * 3. UI updates in response to Mux API responses
 * 4. Frame display and interaction with Mux URLs
 * 5. Cost breakdown display with Mux pricing
 * 6. Error handling UI integration
 * 
 * This verifies the seams between:
 * - Upload component and main page state
 * - API responses and UI state updates
 * - Frame extraction and video playback components
 * - Error states and retry mechanisms
 * - Cost calculation and display integration
 */

import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL for file handling
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')
global.URL.revokeObjectURL = vi.fn()

// Mock HTMLVideoElement for duration extraction
Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
  get: vi.fn(() => 132.5),
  configurable: true
})

// Mock video element events
const mockVideoElement = {
  duration: 132.5,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  load: vi.fn(),
  preload: 'metadata'
}

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName) => {
    if (tagName === 'video') {
      return mockVideoElement
    }
    return document.createElement.call(document, tagName)
  }),
  configurable: true
})

describe('Integration: Component Integration for Mux Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    
    // Reset global window state
    delete (window as any).experimentState
    delete (window as any).updateExperimentState
    delete (window as any).simulateError
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Upload to Frame Extraction Integration', () => {
    test('should integrate file upload with Mux frame extraction workflow', async () => {
      // Mock successful Mux API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            {
              url: 'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0',
              timestamp: 0,
              filename: 'frame_00m00s.png'
            },
            {
              url: 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5',
              timestamp: 5,
              filename: 'frame_00m05s.png'
            }
          ],
          frameCount: 2,
          cost: 0.025,
          metadata: {
            processingTime: 2500,
            extractionMethod: 'mux_upload',
            playbackId: 'test-playback-id',
            workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
          }
        })
      })

      render(<ArchitectureExperimentPage />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      // Access window functions for state manipulation
      const updateState = (window as any).updateExperimentState

      // Simulate file upload completion triggering frame extraction
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video',
        uploadProgress: 100,
        processingStep: 'extracting'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('extracting')
      })

      // Simulate frame extraction completion
      updateState({
        extractedFrames: [
          {
            url: 'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0',
            timestamp: 0,
            filename: 'frame_00m00s.png'
          },
          {
            url: 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5',
            timestamp: 5,
            filename: 'frame_00m05s.png'
          }
        ],
        processingStep: 'transcribing',
        costs: { rendiApi: 0.025, vercelBlob: 0.01, openaiWhisper: 0.00 }
      })

      // Verify frame images are displayed with Mux URLs
      await waitFor(() => {
        const frameImage1 = screen.getByTestId('frame-image-1')
        expect(frameImage1).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0')
        
        const frameImage2 = screen.getByTestId('frame-image-2')
        expect(frameImage2).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5')
      })

      // Verify cost breakdown shows Mux API
      const costTracker = screen.getByTestId('cost-tracker')
      fireEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Mux API: $0.025')
        expect(costBreakdown).not.toHaveTextContent('Rendi API')
      })
    })

    test('should handle video duration extraction integration', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate video file selection
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video'
      })

      // Mock duration extraction and API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [],
          frameCount: 27, // 132.5 seconds ÷ 5
          cost: 0.025,
          metadata: {
            extractionMethod: 'mux_upload',
            playbackId: 'test-playback-id'
          }
        })
      })

      // Verify video element is present for duration extraction
      await waitFor(() => {
        const videoPlayer = screen.getByTestId('video-player')
        expect(videoPlayer).toBeInTheDocument()
        expect(videoPlayer).toHaveAttribute('src', 'blob:http://localhost:3000/test-video')
      })
    })
  })

  describe('State Management Integration', () => {
    test('should maintain state consistency across component updates', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Sequential state updates to test consistency
      updateState({ processingStep: 'uploading', uploadProgress: 25 })
      
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('uploading')
        expect(state.uploadProgress).toBe(25)
      })

      updateState({ uploadProgress: 100, processingStep: 'extracting' })
      
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.processingStep).toBe('extracting')
      })

      updateState({
        extractedFrames: [
          { url: 'https://image.mux.com/test/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1)
        expect(state.processingStep).toBe('transcribing')
        // Previous state should be preserved
        expect(state.uploadProgress).toBe(100)
      })
    })

    test('should handle concurrent state updates properly', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Rapid concurrent updates
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

  describe('Frame Display Integration', () => {
    test('should display Mux frame URLs correctly in frame grid', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Set up extracted frames with Mux URLs
      const muxFrames = [
        {
          url: 'https://image.mux.com/playback123/frame_00m00s.png?time=0',
          timestamp: 0,
          filename: 'frame_00m00s.png'
        },
        {
          url: 'https://image.mux.com/playback123/frame_00m05s.png?time=5',
          timestamp: 5,
          filename: 'frame_00m05s.png'
        },
        {
          url: 'https://image.mux.com/playback123/frame_00m10s.png?time=10',
          timestamp: 10,
          filename: 'frame_00m10s.png'
        }
      ]

      updateState({
        extractedFrames: muxFrames,
        processingStep: 'complete'
      })

      // Verify frame images display Mux URLs
      await waitFor(() => {
        const frameImage1 = screen.getByTestId('frame-image-1')
        expect(frameImage1).toHaveAttribute('src', muxFrames[0].url)
        
        const frameImage2 = screen.getByTestId('frame-image-2')
        expect(frameImage2).toHaveAttribute('src', muxFrames[1].url)
        
        const frameImage3 = screen.getByTestId('frame-image-3')
        expect(frameImage3).toHaveAttribute('src', muxFrames[2].url)
      })

      // Verify timestamp overlays
      expect(screen.getByTestId('timestamp-overlay-1')).toHaveTextContent('0:00')
      expect(screen.getByTestId('timestamp-overlay-2')).toHaveTextContent('0:05')
      expect(screen.getByTestId('timestamp-overlay-3')).toHaveTextContent('0:10')
    })

    test('should handle frame click interactions', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      updateState({
        extractedFrames: [
          { url: 'https://image.mux.com/test/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' },
          { url: 'https://image.mux.com/test/frame_00m05s.png?time=5', timestamp: 5, filename: 'frame_00m05s.png' }
        ]
      })

      await waitFor(() => {
        expect(screen.getByTestId('frame-image-1')).toBeInTheDocument()
      })

      // Test frame click for seeking
      const frameContainer = screen.getByTestId('frame-container-2')
      fireEvent.click(frameContainer)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.currentVideoTime).toBe(5)
      })
    })

    test('should show frame count indicator for long videos', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Create more than 9 frames (long video)
      const longVideoFrames = Array.from({ length: 27 }, (_, i) => ({
        url: `https://image.mux.com/test/frame_${String(Math.floor(i * 5 / 60)).padStart(2, '0')}m${String((i * 5) % 60).padStart(2, '0')}s.png?time=${i * 5}`,
        timestamp: i * 5,
        filename: `frame_${String(Math.floor(i * 5 / 60)).padStart(2, '0')}m${String((i * 5) % 60).padStart(2, '0')}s.png`
      }))

      updateState({
        extractedFrames: longVideoFrames
      })

      await waitFor(() => {
        const frameIndicator = screen.getByTestId('frame-indicator')
        expect(frameIndicator).toHaveTextContent('Showing first 9 of 27 frames')
      })
    })
  })

  describe('Error Handling Integration', () => {
    test('should display Mux-specific error messages', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate Mux upload error
      updateState({
        errors: [{
          section: 'frames',
          message: 'Mux upload failed - Invalid video format',
          timestamp: Date.now()
        }]
      })

      await waitFor(() => {
        const errorLog = screen.getByTestId('error-log')
        expect(errorLog).toHaveTextContent('Mux upload failed - Invalid video format')
        expect(errorLog).not.toHaveTextContent('Rendi')
        expect(errorLog).not.toHaveTextContent('FFmpeg')
      })

      // Verify retry button appears
      expect(screen.getByTestId('retry-frame-extraction')).toBeInTheDocument()
    })

    test('should handle error recovery workflow', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Set up error state
      updateState({
        errors: [{
          section: 'frames',
          message: 'Mux upload failed',
          timestamp: Date.now()
        }],
        videoUrl: 'blob:test-video'
      })

      await waitFor(() => {
        expect(screen.getByTestId('retry-frame-extraction')).toBeInTheDocument()
      })

      // Mock successful retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            { url: 'https://image.mux.com/test/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' }
          ],
          frameCount: 1,
          cost: 0.025,
          metadata: { extractionMethod: 'mux_upload' }
        })
      })

      // Click retry button
      const retryButton = screen.getByTestId('retry-frame-extraction')
      fireEvent.click(retryButton)

      // Verify error is cleared and retry is in progress
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.filter((e: any) => e.section === 'frames')).toHaveLength(0)
        expect(state.isRetrying).toBe(true)
      })
    })
  })

  describe('Cost Display Integration', () => {
    test('should display Mux API costs in breakdown', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Set Mux costs
      updateState({
        costs: {
          vercelBlob: 0.01,
          rendiApi: 0.025, // Property name maintained for compatibility
          openaiWhisper: 0.05
        }
      })

      // Open cost breakdown
      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toHaveTextContent('$0.085') // Total cost

      fireEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.01')
        expect(costBreakdown).toHaveTextContent('Mux API: $0.025') // Label shows Mux, not Rendi
        expect(costBreakdown).toHaveTextContent('OpenAI Whisper: $0.05')
      })
    })
  })

  describe('Processing Step Integration', () => {
    test('should update processing steps correctly for Mux workflow', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Test step progression
      updateState({ processingStep: 'uploading' })
      
      await waitFor(() => {
        const step1 = screen.getByTestId('step-1')
        expect(step1).toHaveClass('bg-blue-600', 'animate-pulse')
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Uploading video...')
      })

      updateState({ processingStep: 'extracting' })
      
      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600', 'animate-pulse')
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Extracting frames at 5-second intervals...')
      })

      updateState({ processingStep: 'transcribing' })
      
      await waitFor(() => {
        const step3 = screen.getByTestId('step-3')
        expect(step3).toHaveClass('bg-blue-600', 'animate-pulse')
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Transcribing audio...')
      })

      updateState({ processingStep: 'complete' })
      
      await waitFor(() => {
        const step4 = screen.getByTestId('step-4')
        expect(step4).toHaveClass('bg-blue-600', 'animate-pulse')
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Processing complete!')
      })
    })
  })
})
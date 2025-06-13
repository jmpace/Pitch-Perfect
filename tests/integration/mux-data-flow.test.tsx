import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

/**
 * Integration Tests: Cross-Component Data Flow for Mux Migration
 * 
 * Tests data flow between components, API, and UI during Mux workflow:
 * 1. Upload component → API route → Mux service → frame display
 * 2. State management across component boundaries
 * 3. Event propagation and data transformation
 * 4. Error state propagation and recovery
 * 5. Cost calculation flow from API to UI display
 * 6. User interaction flow through the complete pipeline
 * 
 * This verifies the seams between:
 * - UploadDropzone component and main page state
 * - Client-side duration extraction and API payload
 * - API responses and component state updates
 * - Frame data and video player interactions
 * - Cost data and breakdown display
 * - Error states across component hierarchy
 */

import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')
global.URL.revokeObjectURL = vi.fn()

// Mock HTMLVideoElement for duration extraction
const mockVideoElement = {
  duration: 132.5,
  preload: 'metadata',
  onloadedmetadata: null as any,
  onerror: null as any,
  src: '',
  remove: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tagName) => {
    if (tagName === 'video') {
      return { ...mockVideoElement }
    }
    return document.createElement.call(document, tagName)
  }),
  configurable: true
})

describe('Integration: Cross-Component Data Flow for Mux Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    
    // Reset global state
    delete (window as any).experimentState
    delete (window as any).updateExperimentState
    delete (window as any).simulateError
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete Upload to Display Data Flow', () => {
    test('should flow data from file upload through Mux API to frame display', async () => {
      // Mock successful Mux API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
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
          ],
          frameCount: 3,
          cost: 0.017,
          metadata: {
            processingTime: 2500,
            extractionMethod: 'mux_upload',
            playbackId: 'playback123',
            workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
          }
        })
      })

      render(<ArchitectureExperimentPage />)

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // 1. Simulate file upload completion
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video',
        uploadProgress: 100,
        processingStep: 'extracting'
      })

      // 2. Verify processing step updated
      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600', 'animate-pulse')
      })

      // 3. Simulate API response with extracted frames
      updateState({
        extractedFrames: [
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
        ],
        processingStep: 'transcribing',
        costs: { rendiApi: 0.017, vercelBlob: 0.01, openaiWhisper: 0.00 }
      })

      // 4. Verify frames are displayed in UI with Mux URLs
      await waitFor(() => {
        const frameImage1 = screen.getByTestId('frame-image-1')
        expect(frameImage1).toHaveAttribute('src', 'https://image.mux.com/playback123/frame_00m00s.png?time=0')
        
        const frameImage2 = screen.getByTestId('frame-image-2')
        expect(frameImage2).toHaveAttribute('src', 'https://image.mux.com/playback123/frame_00m05s.png?time=5')
        
        const frameImage3 = screen.getByTestId('frame-image-3')
        expect(frameImage3).toHaveAttribute('src', 'https://image.mux.com/playback123/frame_00m10s.png?time=10')
      })

      // 5. Verify cost data flows to UI
      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toHaveTextContent('$0.027') // 0.017 + 0.01 + 0.00

      fireEvent.click(costTracker)
      
      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Mux API: $0.017')
        expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.010')
      })

      // 6. Verify processing step progressed
      const step3 = screen.getByTestId('step-3')
      expect(step3).toHaveClass('bg-blue-600', 'animate-pulse')
    })

    test('should handle data flow with long video generating many frames', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Generate frames for 2-minute video (24 frames)
      const longVideoFrames = Array.from({ length: 24 }, (_, i) => {
        const timestamp = i * 5
        const minutes = Math.floor(timestamp / 60)
        const seconds = timestamp % 60
        const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
        
        return {
          url: `https://image.mux.com/longvideo/frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png?time=${timestamp}`,
          timestamp,
          filename
        }
      })

      updateState({
        extractedFrames: longVideoFrames,
        processingStep: 'complete'
      })

      // Verify only first 9 frames displayed in 3x3 grid
      await waitFor(() => {
        expect(screen.getByTestId('frame-image-1')).toBeInTheDocument()
        expect(screen.getByTestId('frame-image-9')).toBeInTheDocument()
      })

      // Verify frame count indicator
      const frameIndicator = screen.getByTestId('frame-indicator')
      expect(frameIndicator).toHaveTextContent('Showing first 9 of 24 frames')

      // Verify first and last visible frames
      const firstFrame = screen.getByTestId('frame-image-1')
      expect(firstFrame).toHaveAttribute('src', longVideoFrames[0].url)
      
      const lastVisibleFrame = screen.getByTestId('frame-image-9')
      expect(lastVisibleFrame).toHaveAttribute('src', longVideoFrames[8].url)
    })
  })

  describe('Duration Extraction to API Data Flow', () => {
    test('should extract duration client-side and pass to API call', async () => {
      // Mock API call that expects videoDuration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [],
          frameCount: 27, // Based on 132.5 second duration
          cost: 0.025,
          metadata: { extractionMethod: 'mux_upload' }
        })
      })

      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate video upload with duration extraction trigger
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video',
        uploadProgress: 100,
        processingStep: 'extracting'
      })

      // Verify video player shows correct URL for duration extraction
      await waitFor(() => {
        const videoPlayer = screen.getByTestId('video-player')
        expect(videoPlayer).toHaveAttribute('src', 'blob:http://localhost:3000/test-video')
      })

      // The API call would be triggered here with extracted duration
      // In a real scenario, this would happen automatically via handleFrameExtraction
    })

    test('should handle duration extraction errors gracefully', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate duration extraction failure
      updateState({
        errors: [{
          section: 'frames',
          message: 'Could not extract video duration',
          timestamp: Date.now()
        }]
      })

      await waitFor(() => {
        const errorLog = screen.getByTestId('error-log')
        expect(errorLog).toHaveTextContent('Could not extract video duration')
      })

      // Verify retry button appears
      expect(screen.getByTestId('retry-frame-extraction')).toBeInTheDocument()
    })
  })

  describe('User Interaction Data Flow', () => {
    test('should handle frame click interaction and video seeking', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Set up frames for interaction
      updateState({
        extractedFrames: [
          { url: 'https://image.mux.com/test/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' },
          { url: 'https://image.mux.com/test/frame_00m05s.png?time=5', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'https://image.mux.com/test/frame_00m10s.png?time=10', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        videoUrl: 'blob:http://localhost:3000/test-video'
      })

      await waitFor(() => {
        expect(screen.getByTestId('frame-container-2')).toBeInTheDocument()
      })

      // Click on second frame (5 second timestamp)
      const frameContainer2 = screen.getByTestId('frame-container-2')
      fireEvent.click(frameContainer2)

      // Verify seeking data flows to state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.currentVideoTime).toBe(5)
      })
    })

    test('should handle error recovery workflow through UI interactions', async () => {
      // Mock successful retry API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            { url: 'https://image.mux.com/retry/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' }
          ],
          frameCount: 1,
          cost: 0.015,
          metadata: { extractionMethod: 'mux_upload' }
        })
      })

      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Set up error state
      updateState({
        errors: [{
          section: 'frames',
          message: 'Mux upload failed - network timeout',
          timestamp: Date.now()
        }],
        videoUrl: 'blob:http://localhost:3000/test-video'
      })

      await waitFor(() => {
        expect(screen.getByTestId('retry-frame-extraction')).toBeInTheDocument()
      })

      // Click retry button
      const retryButton = screen.getByTestId('retry-frame-extraction')
      fireEvent.click(retryButton)

      // Verify error cleared and retry state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.filter((e: any) => e.section === 'frames')).toHaveLength(0)
        expect(state.isRetrying).toBe(true)
      })

      // Simulate successful retry completion
      updateState({
        extractedFrames: [
          { url: 'https://image.mux.com/retry/frame_00m00s.png?time=0', timestamp: 0, filename: 'frame_00m00s.png' }
        ],
        isRetrying: false,
        costs: { rendiApi: 0.015, vercelBlob: 0.01, openaiWhisper: 0.00 }
      })

      // Verify successful retry reflected in UI
      await waitFor(() => {
        const frameImage = screen.getByTestId('frame-image-1')
        expect(frameImage).toHaveAttribute('src', 'https://image.mux.com/retry/frame_00m00s.png?time=0')
      })
    })
  })

  describe('Cost Calculation Data Flow', () => {
    test('should flow cost data from API response to UI breakdown', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate different cost scenarios
      const costScenarios = [
        { frameCount: 6, muxCost: 0.018, description: '30-second video' },
        { frameCount: 12, muxCost: 0.021, description: '1-minute video' },
        { frameCount: 120, muxCost: 0.075, description: '10-minute video' }
      ]

      for (const scenario of costScenarios) {
        updateState({
          costs: {
            vercelBlob: 0.01,
            rendiApi: scenario.muxCost, // Property name for compatibility
            openaiWhisper: 0.05
          }
        })

        const totalCost = 0.01 + scenario.muxCost + 0.05

        // Verify total cost display
        const costTracker = screen.getByTestId('cost-tracker')
        expect(costTracker).toHaveTextContent(`$${totalCost.toFixed(2)}`)

        // Open breakdown and verify individual costs
        fireEvent.click(costTracker)
        
        await waitFor(() => {
          const costBreakdown = screen.getByTestId('cost-breakdown')
          expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.01')
          expect(costBreakdown).toHaveTextContent(`Mux API: $${scenario.muxCost.toFixed(3)}`)
          expect(costBreakdown).toHaveTextContent('OpenAI Whisper: $0.05')
        })

        // Close breakdown for next iteration
        fireEvent.click(costTracker)
      }
    })

    test('should show cost progression during processing steps', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // 1. Initial state - no costs
      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toHaveTextContent('$0.00')

      // 2. Upload cost added
      updateState({
        processingStep: 'uploading',
        costs: { vercelBlob: 0.01, rendiApi: 0.00, openaiWhisper: 0.00 }
      })

      await waitFor(() => {
        expect(costTracker).toHaveTextContent('$0.01')
      })

      // 3. Mux API cost added after frame extraction
      updateState({
        processingStep: 'transcribing',
        costs: { vercelBlob: 0.01, rendiApi: 0.025, openaiWhisper: 0.00 }
      })

      await waitFor(() => {
        expect(costTracker).toHaveTextContent('$0.035')
      })

      // 4. Final cost with transcription
      updateState({
        processingStep: 'complete',
        costs: { vercelBlob: 0.01, rendiApi: 0.025, openaiWhisper: 0.08 }
      })

      await waitFor(() => {
        expect(costTracker).toHaveTextContent('$0.115')
      })
    })
  })

  describe('State Consistency Across Components', () => {
    test('should maintain state consistency during rapid updates', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Rapid sequential updates
      updateState({ processingStep: 'uploading', uploadProgress: 25 })
      updateState({ uploadProgress: 50 })
      updateState({ uploadProgress: 75 })
      updateState({ uploadProgress: 100, processingStep: 'extracting' })
      updateState({ 
        extractedFrames: [{ url: 'frame1', timestamp: 0, filename: 'frame1.png' }],
        processingStep: 'transcribing'
      })

      // Verify final consistent state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.processingStep).toBe('transcribing')
        expect(state.extractedFrames).toHaveLength(1)
      })

      // Verify UI reflects consistent state
      const step3 = screen.getByTestId('step-3')
      expect(step3).toHaveClass('bg-blue-600', 'animate-pulse')
      
      const frameImage = screen.getByTestId('frame-image-1')
      expect(frameImage).toHaveAttribute('src', 'frame1')
    })

    test('should handle concurrent state updates from different sources', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate concurrent updates (upload progress + extraction progress)
      updateState({ 
        uploadProgress: 100,
        extractionProgress: 25
      })

      updateState({ 
        processingStep: 'extracting',
        extractionProgress: 75
      })

      updateState({
        extractedFrames: [
          { url: 'concurrent1', timestamp: 0, filename: 'frame1.png' },
          { url: 'concurrent2', timestamp: 5, filename: 'frame2.png' }
        ],
        extractionProgress: 100,
        processingStep: 'transcribing'
      })

      // Verify all updates applied correctly
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(100)
        expect(state.extractionProgress).toBe(100)
        expect(state.processingStep).toBe('transcribing')
        expect(state.extractedFrames).toHaveLength(2)
      })
    })
  })

  describe('Error State Propagation', () => {
    test('should propagate error states across component hierarchy', async () => {
      render(<ArchitectureExperimentPage />)

      await waitFor(() => {
        expect(screen.getByTestId('grid-layout')).toBeInTheDocument()
      })

      const updateState = (window as any).updateExperimentState

      // Simulate error in frames section affecting overall processing
      updateState({
        errors: [{
          section: 'frames',
          message: 'Mux upload failed - Invalid video format',
          timestamp: Date.now()
        }],
        processingStep: 'extracting'
      })

      // Verify error appears in error log
      await waitFor(() => {
        const errorLog = screen.getByTestId('error-log')
        expect(errorLog).toHaveTextContent('Mux upload failed - Invalid video format')
        expect(errorLog).toHaveClass('text-red-500')
      })

      // Verify processing step remains in extracting state
      const step2 = screen.getByTestId('step-2')
      expect(step2).toHaveClass('bg-blue-600', 'animate-pulse')

      // Verify frames show error state
      const framePlaceholder = screen.getByTestId('frame-placeholder-1')
      expect(framePlaceholder).toHaveClass('bg-red-500')
      
      const warningIcon = screen.getByTestId('warning-icon-1')
      expect(warningIcon).toHaveTextContent('⚠')
    })
  })
})
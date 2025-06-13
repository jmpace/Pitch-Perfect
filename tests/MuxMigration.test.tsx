import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom'

/**
 * 🔴 RED Phase: Mux Migration Unit Tests
 * 
 * These tests verify the NEW Mux-based functionality and will FAIL with the current Rendi implementation.
 * They test:
 * 1. Component Rendering: Mux URLs displayed in frame images
 * 2. UI Integration: Mux frame URLs used instead of Rendi URLs  
 * 3. Event Handling: Client-side duration extraction triggers API calls with videoDuration
 * 4. State Management: Mux cost calculations displayed instead of Rendi
 * 5. CSS Integration: Mux error states displayed correctly
 * 
 * Expected behavior AFTER migration:
 * - Frame URLs point to https://image.mux.com/{playbackId}/...
 * - API requests include videoDuration from client-side extraction
 * - Cost breakdown shows "Mux API" instead of "Rendi API"
 * - Error messages reference "Mux upload failed" instead of "Rendi command failed"
 * - No polling delays in processing workflow
 */

// Mock the main component
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('🔴 RED Phase: Mux Migration - Frame URL Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
    
    // Reset global state
    Object.defineProperty(window, 'experimentState', {
      value: {
        videoFile: null,
        videoUrl: '',
        uploadProgress: 0,
        processingStep: 'idle',
        fullTranscript: '',
        segmentedTranscript: [],
        extractedFrames: [],
        errors: [],
        timings: {}
      },
      writable: true,
      configurable: true
    })
    
    Object.defineProperty(window, 'updateExperimentState', {
      value: vi.fn(),
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Component Rendering - Mux Frame URLs', () => {
    test('🔴 SHOULD FAIL: frame images display Mux URLs instead of Rendi URLs', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Wait for component to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Simulate frames extracted via Mux (these URLs should appear AFTER migration)
      const mockMuxFrames = [
        {
          url: 'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0',
          timestamp: 0,
          filename: 'frame_00m00s.png'
        },
        {
          url: 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5',
          timestamp: 5,
          filename: 'frame_00m05s.png'
        },
        {
          url: 'https://image.mux.com/test-playback-id/frame_00m10s.png?time=10',
          timestamp: 10,
          filename: 'frame_00m10s.png'
        }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockMuxFrames })
      
      await waitFor(() => {
        // These assertions will FAIL with current Rendi implementation
        // because Rendi returns URLs like https://api.rendi.dev/files/... or picsum URLs
        const frame1 = screen.getByTestId('frame-image-1')
        const frame2 = screen.getByTestId('frame-image-2')
        const frame3 = screen.getByTestId('frame-image-3')
        
        // ❌ WILL FAIL: Current implementation returns Rendi URLs, not Mux URLs
        expect(frame1).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m00s.png?time=0')
        expect(frame2).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5')
        expect(frame3).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m10s.png?time=10')
        
        // Verify Mux-specific URL patterns
        expect(frame1.getAttribute('src')).toMatch(/^https:\/\/image\.mux\.com\/[\w-]+\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)
        expect(frame2.getAttribute('src')).toMatch(/^https:\/\/image\.mux\.com\/[\w-]+\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)
        expect(frame3.getAttribute('src')).toMatch(/^https:\/\/image\.mux\.com\/[\w-]+\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)
      })
    })

    test('🔴 SHOULD FAIL: frame URLs include Mux time parameters', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockMuxFrames = [
        {
          url: 'https://image.mux.com/test-id/frame_01m25s.png?time=85',
          timestamp: 85,
          filename: 'frame_01m25s.png'
        }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockMuxFrames })
      
      await waitFor(() => {
        const frameImage = screen.getByTestId('frame-image-1')
        const srcUrl = frameImage.getAttribute('src')
        
        // ❌ WILL FAIL: Current Rendi URLs don't have ?time= parameters
        expect(srcUrl).toContain('?time=85')
        expect(srcUrl).toContain('image.mux.com')
        expect(srcUrl).not.toContain('rendi.dev')
        expect(srcUrl).not.toContain('picsum.photos')
      })
    })

    test('🔴 SHOULD FAIL: timestamp overlays match Mux URL time parameters', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockMuxFrames = [
        {
          url: 'https://image.mux.com/test-id/frame_02m15s.png?time=135',
          timestamp: 135,
          filename: 'frame_02m15s.png'
        }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockMuxFrames })
      
      await waitFor(() => {
        const timestampOverlay = screen.getByTestId('timestamp-overlay-1')
        
        // ❌ WILL FAIL: Current implementation might not format timestamps correctly for Mux URLs
        expect(timestampOverlay).toHaveTextContent('2:15')
        
        const frameImage = screen.getByTestId('frame-image-1')
        const srcUrl = frameImage.getAttribute('src')
        expect(srcUrl).toContain('time=135')
      })
    })
  })

  describe('Event Handling - Client-Side Duration Extraction', () => {
    test('🔴 SHOULD FAIL: API called with videoDuration from client-side extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock successful Mux API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            {
              url: 'https://image.mux.com/test-id/frame_00m00s.png?time=0',
              timestamp: 0,
              filename: 'frame_00m00s.png'
            }
          ],
          frameCount: 1,
          cost: 0.025,
          metadata: {
            processingTime: 1200,
            extractionMethod: 'mux_upload',
            playbackId: 'test-mux-playback-id'
          }
        })
      })
      
      // Mock video element with duration
      const mockVideo = document.createElement('video')
      Object.defineProperty(mockVideo, 'duration', {
        value: 147.5,
        writable: false
      })
      
      // Mock file upload to trigger frame extraction
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' })
      
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      // Wait for API call
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/experiment/extract-frames',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: expect.stringContaining('videoDuration')
          })
        )
      })
      
      // ❌ WILL FAIL: Current implementation doesn't send videoDuration in request body
      const fetchCall = mockFetch.mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1].body)
      expect(requestBody).toHaveProperty('videoDuration')
      expect(requestBody.videoDuration).toBeGreaterThan(0)
    })

    test('🔴 SHOULD FAIL: frame extraction triggered immediately with client duration', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [],
          frameCount: 0,
          cost: 0.02,
          metadata: { extractionMethod: 'mux_upload' }
        })
      })
      
      // Simulate file upload with immediate duration availability
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      // ❌ WILL FAIL: Current implementation doesn't extract duration client-side
      await waitFor(() => {
        const fetchCall = mockFetch.mock.calls[0]
        const requestBody = JSON.parse(fetchCall[1].body)
        expect(requestBody).toHaveProperty('videoDuration')
        expect(requestBody).toHaveProperty('videoUrl')
        expect(requestBody.videoUrl).toMatch(/^blob:/)
      }, { timeout: 5000 })
    })
  })

  describe('State Management - Mux Cost Calculations', () => {
    test('🔴 SHOULD FAIL: cost breakdown shows "Mux API" instead of "Rendi API"', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Simulate successful Mux frame extraction
      const updateState = (window as any).updateExperimentState
      updateState({
        extractedFrames: [
          { url: 'https://image.mux.com/test-id/frame.png?time=0', timestamp: 0, filename: 'frame.png' }
        ],
        costs: {
          vercelBlob: 0.001,
          rendiApi: 0.025,  // This should be renamed to muxApi after migration
          openaiWhisper: 0.015
        }
      })
      
      // Open cost breakdown
      const costTracker = screen.getByTestId('cost-tracker')
      fireEvent.click(costTracker)
      
      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        
        // ❌ WILL FAIL: Current implementation shows "Rendi API" 
        expect(costBreakdown).toHaveTextContent('Mux API: $0.03')
        expect(costBreakdown).not.toHaveTextContent('Rendi API')
      })
    })

    test('🔴 SHOULD FAIL: Mux cost structure replaces Rendi pricing', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock Mux API response with Mux pricing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [],
          frameCount: 5,
          cost: 0.02, // Mux pricing structure
          metadata: {
            extractionMethod: 'mux_upload',
            playbackId: 'test-id'
          }
        })
      })
      
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      await waitFor(() => {
        const costTracker = screen.getByTestId('cost-tracker')
        
        // ❌ WILL FAIL: Current implementation uses Rendi cost calculation ($0.30 base + $0.01 per frame)
        // Mux should have different pricing structure
        expect(costTracker).toHaveTextContent('$0.02')
        
        fireEvent.click(costTracker)
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Mux API')
        expect(costBreakdown).not.toHaveTextContent('Rendi')
      })
    })
  })

  describe('Error Handling - Mux Error Messages', () => {
    test('🔴 SHOULD FAIL: error messages reference Mux instead of Rendi', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock Mux API failure
      mockFetch.mockRejectedValueOnce(new Error('Mux upload failed'))
      
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      await waitFor(() => {
        const errorLog = screen.getByTestId('error-log')
        
        // ❌ WILL FAIL: Current implementation shows Rendi error messages
        expect(errorLog).toHaveTextContent('Mux')
        expect(errorLog).not.toHaveTextContent('Rendi')
        expect(errorLog).not.toHaveTextContent('polling')
        expect(errorLog).not.toHaveTextContent('FFmpeg')
      })
    })

    test('🔴 SHOULD FAIL: retry button for Mux upload instead of Rendi command', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Simulate Mux error
      const updateState = (window as any).updateExperimentState
      updateState({
        errors: [{
          section: 'frames',
          message: 'Mux upload failed - Invalid video format for Mux processing',
          timestamp: Date.now()
        }]
      })
      
      await waitFor(() => {
        const retryButton = screen.getByTestId('retry-frame-extraction')
        
        // ❌ WILL FAIL: Current implementation might show Rendi-specific retry text
        expect(retryButton).toHaveTextContent('Retry Frame Extraction')
        expect(retryButton).toBeInTheDocument()
        
        const errorLog = screen.getByTestId('error-log')
        expect(errorLog).toHaveTextContent('Mux upload failed')
        expect(errorLog).not.toHaveTextContent('Rendi command failed')
      })
    })
  })

  describe('Processing Workflow - No Rendi Polling', () => {
    test('🔴 SHOULD FAIL: fast Mux processing without polling delays', async () => {
      render(<ArchitectureExperimentPage />)
      
      const startTime = Date.now()
      
      // Mock fast Mux response (no polling)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            { url: 'https://image.mux.com/test-id/frame.png?time=0', timestamp: 0, filename: 'frame.png' }
          ],
          frameCount: 1,
          cost: 0.02,
          metadata: {
            processingTime: 500, // Fast Mux processing
            extractionMethod: 'mux_upload',
            workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
          }
        })
      })
      
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      await waitFor(() => {
        expect(screen.getByTestId('frame-image-1')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      
      // ❌ WILL FAIL: Current Rendi implementation takes longer due to polling delays
      expect(totalTime).toBeLessThan(3000) // Should be much faster than Rendi's 5-second polling
    })

    test('🔴 SHOULD FAIL: processing step transitions directly without polling indicators', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock Mux response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [],
          frameCount: 0,
          cost: 0.02,
          metadata: { extractionMethod: 'mux_upload' }
        })
      })
      
      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      await waitFor(() => {
        const currentStepText = screen.getByTestId('current-step-text')
        
        // ❌ WILL FAIL: Current implementation might still show extracting state longer due to polling
        expect(currentStepText).toHaveTextContent('Transcribing audio...')
        
        const step3 = screen.getByTestId('step-3')
        expect(step3).toHaveClass('bg-blue-600')
        expect(step3).toHaveClass('animate-pulse')
      }, { timeout: 5000 })
    })
  })

  describe('UI Integration - Dynamic Frame Count for Any Video Length', () => {
    test('🔴 SHOULD FAIL: 30-second video generates exactly 6 Mux frames', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock 30-second video with 6 Mux frames (0, 5, 10, 15, 20, 25)
      const mock30SecFrames = Array.from({ length: 6 }, (_, i) => ({
        url: `https://image.mux.com/test-id/frame_00m${(i * 5).toString().padStart(2, '0')}s.png?time=${i * 5}`,
        timestamp: i * 5,
        filename: `frame_00m${(i * 5).toString().padStart(2, '0')}s.png`
      }))
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mock30SecFrames })
      
      await waitFor(() => {
        // First 6 frames should be visible with Mux URLs
        for (let i = 1; i <= 6; i++) {
          const frameImage = screen.getByTestId(`frame-image-${i}`)
          expect(frameImage).toBeInTheDocument()
          
          // ❌ WILL FAIL: Current implementation uses Rendi URLs
          const src = frameImage.getAttribute('src')
          expect(src).toMatch(/^https:\/\/image\.mux\.com/)
          expect(src).toContain('?time=')
        }
        
        // Frames 7-9 should be hidden
        for (let i = 7; i <= 9; i++) {
          const placeholder = screen.getByTestId(`frame-placeholder-${i}`)
          expect(placeholder).toHaveClass('hidden')
        }
      })
    })

    test('🔴 SHOULD FAIL: frame indicator shows Mux-generated frame count', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Mock 47-second video (should generate 10 frames: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45)
      const mock47SecFrames = Array.from({ length: 10 }, (_, i) => ({
        url: `https://image.mux.com/test-id/frame_00m${(i * 5).toString().padStart(2, '0')}s.png?time=${i * 5}`,
        timestamp: i * 5,
        filename: `frame_00m${(i * 5).toString().padStart(2, '0')}s.png`
      }))
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mock47SecFrames })
      
      await waitFor(() => {
        const frameIndicator = screen.getByTestId('frame-indicator')
        
        // ❌ WILL FAIL: Current implementation shows fixed frame count, not dynamic Mux calculation
        expect(frameIndicator).toHaveTextContent('Showing first 9 of 10 frames')
      })
    })
  })
})
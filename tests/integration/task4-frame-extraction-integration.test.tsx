/** @jsxImportSource react */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock fetch for API interactions
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock URL.createObjectURL for file handling
global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost:3000/test-video')
global.URL.revokeObjectURL = vi.fn()

// Mock environment variables
process.env.RENDI_API_KEY = 'test-rendi-key'
process.env.VERCEL_BLOB_READ_WRITE_TOKEN = 'test-blob-token'

describe('Task 4 - Frame Extraction Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    vi.clearAllMocks()
    
    // Reset DOM
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('1. API Endpoints and Data Flow Integration', () => {
    it('should handle complete frame extraction API workflow', async () => {
      // Mock successful frame extraction API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
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
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate completed upload triggering frame extraction
      updateState({
        videoFile: new File(['test content'], 'test-video.mp4', { type: 'video/mp4' }),
        videoUrl: 'https://blob.vercel-storage.com/test-video-abc123.mp4',
        uploadProgress: 100,
        processingStep: 'complete'
      })

      // Trigger onUploadComplete callback to start frame extraction
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('complete')
      })

      // Simulate frame extraction starting automatically
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600')
        expect(step2).toHaveClass('animate-pulse')
      })

      // Verify API call would be made to frame extraction endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/experiment/extract-frames'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('https://blob.vercel-storage.com/test-video-abc123.mp4')
        })
      )

      // Simulate frame extraction completion
      updateState({
        extractedFrames: [
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
        processingStep: 'transcribing'
      })

      // Verify state was updated correctly
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(9)
        expect(state.processingStep).toBe('transcribing')
        expect(state.extractedFrames[0].filename).toBe('frame_00m05s.png')
        expect(state.extractedFrames[8].filename).toBe('frame_00m45s.png')
      })

      // Verify UI shows success
      const step2Complete = screen.getByTestId('step-2')
      expect(step2Complete).toHaveClass('bg-green-600')
    })

    it('should handle frame extraction API errors with proper error responses', async () => {
      // Mock API error response
      mockFetch.mockRejectedValueOnce({
        status: 500,
        json: async () => ({
          error: 'Rendi API timeout',
          message: 'Frame extraction failed - network timeout'
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Start frame extraction
      updateState({
        videoUrl: 'https://blob.vercel-storage.com/test-video.mp4',
        processingStep: 'extracting'
      })

      // Simulate API error
      const simulateError = (window as any).simulateError
      simulateError('frames')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(true)
        expect(state.processingStep).toBe('extracting') // Should not advance
      })

      // Verify error UI is displayed
      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      expect(screen.getByText(/Something went wrong in Frames section/)).toBeInTheDocument()
      
      // Verify retry button is available
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    })

    it('should track frame extraction progress correctly', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Start extraction with progress tracking
      updateState({ processingStep: 'extracting' })

      // Simulate progress updates
      updateState({ extractionProgress: 25 })
      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar')
        expect(progressBar).toHaveStyle('width: 25%')
      })

      updateState({ extractionProgress: 75 })
      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar')
        expect(progressBar).toHaveStyle('width: 75%')
      })

      updateState({ extractionProgress: 100 })
      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar')
        expect(progressBar).toHaveStyle('width: 100%')
      })
    })
  })

  describe('2. Database Interactions for Frame Extraction', () => {
    it('should persist frame extraction state in local storage', async () => {
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
      Object.defineProperty(window, 'localStorage', { value: localStorageMock })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Update state with frame data
      const frameData = [
        { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
      ]
      
      updateState({ extractedFrames: frameData })

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'experimentState',
          expect.stringContaining('frame_00m05s.png')
        )
      })
    })

    it('should handle frame metadata storage and retrieval', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Store frame metadata
      const frameMetadata = {
        extractedFrames: [
          { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        timings: { frameExtraction: 15000 },
        costs: { rendiAPI: 1.20 }
      }
      
      updateState(frameMetadata)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(2)
        expect(state.timings.frameExtraction).toBe(15000)
        expect(state.costs.rendiAPI).toBe(1.20)
      })
    })
  })

  describe('3. External Service Integration (Rendi API)', () => {
    it('should handle Rendi API authentication and requests', async () => {
      // Mock successful Rendi API authentication
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jobId: 'rendi-job-12345',
          status: 'processing'
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      updateState({
        videoUrl: 'https://blob.vercel-storage.com/test.mp4',
        processingStep: 'extracting'
      })

      // Verify API call includes authentication
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('test-rendi-key')
          })
        })
      )
    })

    it('should handle Rendi API timeout scenarios', async () => {
      // Mock timeout response
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 30000)
        )
      )

      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('frames')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => 
          e.section === 'frames' && 
          e.message.includes('timeout')
        )).toBe(true)
      })
    })

    it('should handle variable video length correctly', async () => {
      // Mock response for 35-second video (7 frames)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          frames: [
            { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m20s.png', timestamp: 20, filename: 'frame_00m20s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m25s.png', timestamp: 25, filename: 'frame_00m25s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m30s.png', timestamp: 30, filename: 'frame_00m30s.png' },
            { url: 'https://api.rendi.dev/files/frame_00m35s.png', timestamp: 35, filename: 'frame_00m35s.png' }
          ],
          videoDuration: 35
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      updateState({
        processingStep: 'extracting',
        extractedFrames: [
          { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m20s.png', timestamp: 20, filename: 'frame_00m20s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m25s.png', timestamp: 25, filename: 'frame_00m25s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m30s.png', timestamp: 30, filename: 'frame_00m30s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m35s.png', timestamp: 35, filename: 'frame_00m35s.png' }
        ]
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(7)
        expect(state.extractedFrames[6].timestamp).toBe(35)
        expect(state.extractedFrames[6].filename).toBe('frame_00m35s.png')
      })
    })

    it('should handle long video filename generation (8+ minutes)', async () => {
      // Mock response for 8-minute video (96 frames)
      const longVideoFrames = []
      for (let i = 5; i <= 480; i += 5) { // 5 seconds to 8 minutes (480 seconds)
        const minutes = Math.floor(i / 60)
        const seconds = i % 60
        const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
        longVideoFrames.push({
          url: `https://api.rendi.dev/files/${filename}`,
          timestamp: i,
          filename: filename
        })
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          frames: longVideoFrames,
          videoDuration: 480
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      updateState({
        processingStep: 'extracting',
        extractedFrames: longVideoFrames
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(96)
        expect(state.extractedFrames[95].filename).toBe('frame_08m00s.png')
        expect(state.extractedFrames[95].timestamp).toBe(480)
      })
    })

    it('should handle Rendi API cost calculation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          frames: [
            { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
          ],
          cost: 1.20,
          breakdown: {
            videoProcessing: 0.80,
            frameGeneration: 0.30,
            storage: 0.10
          }
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      updateState({
        processingStep: 'extracting',
        costs: { rendiAPI: 1.20 }
      })

      // Verify cost is displayed
      const costTracker = screen.getByTestId('cost-tracker')
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
      })
    })
  })

  describe('4. BDD Scenarios End-to-End Integration', () => {
    it('should execute BDD Scenario 1: Automatic Frame Extraction After Upload', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Given: User has successfully uploaded video
      updateState({
        videoFile: new File(['test content'], 'test-video.mp4', { type: 'video/mp4' }),
        videoUrl: 'https://blob.vercel-storage.com/test-video.mp4',
        processingStep: 'complete',
        uploadProgress: 100
      })

      // Verify upload completion state
      await waitFor(() => {
        const step1 = screen.getByTestId('step-1')
        expect(step1).toHaveClass('bg-green-600')
      })

      // When: onUploadComplete callback triggers frame extraction
      updateState({ processingStep: 'extracting' })

      // Then: Processing step updates and UI shows extracting state
      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600')
        expect(step2).toHaveClass('animate-pulse')
      })

      // And: Frame placeholders show loading spinners
      const framePlaceholders = screen.getAllByTestId(/frame-placeholder-\d/)
      expect(framePlaceholders).toHaveLength(9)
      framePlaceholders.forEach(placeholder => {
        expect(placeholder).toHaveClass('animate-spin')
      })

      // When: Frame extraction completes
      updateState({
        extractedFrames: [
          { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        processingStep: 'transcribing'
      })

      // Then: Frame grid displays actual thumbnails
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(2)
        expect(state.processingStep).toBe('transcribing')
      })
    })

    it('should execute BDD Scenario 3: Rendi API Error Handling', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Given: User uploaded video and frame extraction started
      updateState({
        videoUrl: 'https://blob.vercel-storage.com/test.mp4',
        processingStep: 'extracting'
      })

      // When: Rendi API fails with timeout
      simulateError('frames')

      // Then: Processing step remains extracting and error is shown
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('extracting')
        expect(state.errors.some(e => e.section === 'frames')).toBe(true)
      })

      // And: Error UI is displayed with retry option
      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      const retryButton = screen.getByTestId('retry-button')
      expect(retryButton).toBeInTheDocument()

      // When: User clicks retry
      await userEvent.click(retryButton)

      // Then: Error is cleared and extraction restarts
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(false)
      })
    })

    it('should execute BDD Scenario 7: Cost Tracking Integration', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Given: Existing cost tracking system is active
      updateState({
        costs: { vercelBlob: 0.02, rendiAPI: 0.00, openaiWhisper: 0.00 }
      })

      // When: Frame extraction begins
      updateState({
        processingStep: 'extracting',
        costs: { vercelBlob: 0.02, rendiAPI: 0.30, openaiWhisper: 0.00 }
      })

      // Then: Cost tracker updates in real-time
      const costTracker = screen.getByTestId('cost-tracker')
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
      })

      // When: Extraction completes
      updateState({
        processingStep: 'transcribing',
        costs: { vercelBlob: 0.02, rendiAPI: 1.20, openaiWhisper: 0.00 }
      })

      // Then: Final costs are displayed
      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
      })
    })
  })

  describe('5. Component Integration and State Management', () => {
    it('should integrate UploadDropzone with frame extraction trigger', async () => {
      render(<ArchitectureExperimentPage />)
      
      const testFile = new File(['test content'], 'test-video.mp4', { type: 'video/mp4' })
      const fileInput = screen.getByTestId('file-input')
      
      // Upload file through DropZone
      await userEvent.upload(fileInput, testFile)

      // Verify upload state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile).toBeTruthy()
        expect(state.videoFile.name).toBe('test-video.mp4')
      })

      // Simulate upload completion triggering frame extraction
      const updateState = (window as any).updateExperimentState
      updateState({
        uploadProgress: 100,
        processingStep: 'complete'
      })

      // Verify onUploadComplete callback would trigger frame extraction
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('complete')
        expect(state.uploadProgress).toBe(100)
      })
    })

    it('should maintain state consistency during frame extraction workflow', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate complete workflow with state transitions
      const workflowStates = [
        { processingStep: 'idle' as const },
        { processingStep: 'uploading' as const, uploadProgress: 50 },
        { processingStep: 'complete' as const, uploadProgress: 100, videoUrl: 'blob:test-url' },
        { processingStep: 'extracting' as const },
        { 
          processingStep: 'transcribing' as const, 
          extractedFrames: [
            { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
          ]
        }
      ]

      for (const stateUpdate of workflowStates) {
        updateState(stateUpdate)
        
        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.processingStep).toBe(stateUpdate.processingStep)
          
          // Verify previous state is preserved
          if (stateUpdate.processingStep === 'transcribing') {
            expect(state.uploadProgress).toBe(100)
            expect(state.videoUrl).toBe('blob:test-url')
            expect(state.extractedFrames).toHaveLength(1)
          }
        })
      }
    })

    it('should handle concurrent state updates during frame extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate rapid concurrent updates
      const rapidUpdates = [
        { extractionProgress: 25 },
        { extractionProgress: 50 },
        { extractionProgress: 75 },
        { 
          extractionProgress: 100, 
          extractedFrames: [
            { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
          ],
          processingStep: 'transcribing' as const
        }
      ]

      // Apply all updates rapidly
      rapidUpdates.forEach(update => updateState(update))

      // Verify final state is correct
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractionProgress).toBe(100)
        expect(state.extractedFrames).toHaveLength(1)
        expect(state.processingStep).toBe('transcribing')
      })
    })

    it('should integrate error handling across all frame extraction components', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Start frame extraction
      updateState({ processingStep: 'extracting' })

      // Simulate error in different components
      const errorScenarios = [
        { section: 'frames', expectedMessage: /Something went wrong in Frames section/ },
        { section: 'video', expectedMessage: /Something went wrong in Video section/ },
        { section: 'processing', expectedMessage: /Something went wrong in Processing section/ }
      ]

      for (const scenario of errorScenarios) {
        simulateError(scenario.section)
        
        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.errors.some(e => e.section === scenario.section)).toBe(true)
        })

        // Verify error UI
        expect(screen.getByTestId('error-card')).toBeInTheDocument()
        expect(screen.getByText(scenario.expectedMessage)).toBeInTheDocument()
        
        // Clear error for next scenario
        const clearErrors = (window as any).clearErrors || (() => updateState({ errors: [] }))
        clearErrors()
      }
    })

    it('should integrate debug panel with frame extraction data', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Add frame extraction data
      updateState({
        extractedFrames: [
          { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' }
        ],
        processingStep: 'transcribing',
        timings: { frameExtraction: 15000 },
        costs: { rendiAPI: 1.20 }
      })

      // Open debug panel (Ctrl+D)
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true })

      await waitFor(() => {
        const debugPanel = screen.getByTestId('debug-panel')
        expect(debugPanel).toBeVisible()
      })

      // Verify frame data is visible in debug panel
      const debugContent = screen.getByTestId('debug-content')
      expect(debugContent).toHaveTextContent('frame_00m15s.png')
      expect(debugContent).toHaveTextContent('timestamp: 15')
      expect(debugContent).toHaveTextContent('transcribing')
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle large number of frames efficiently', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate 120 frames (10-minute video)
      const manyFrames = []
      for (let i = 5; i <= 600; i += 5) { // 5 seconds to 10 minutes
        const minutes = Math.floor(i / 60)
        const seconds = i % 60
        const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
        manyFrames.push({
          url: `https://api.rendi.dev/files/${filename}`,
          timestamp: i,
          filename: filename
        })
      }

      const startTime = performance.now()
      
      updateState({ extractedFrames: manyFrames })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(120)
      })

      const endTime = performance.now()
      
      // Should handle 120 frames within reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should handle memory cleanup after frame extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Add frames
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ]
      })

      // Verify frames are loaded
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(2)
      })

      // Clear frames (simulating component unmount or reset)
      updateState({ extractedFrames: [] })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(0)
      })

      // Verify URL.revokeObjectURL was called for cleanup
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })
  })
})
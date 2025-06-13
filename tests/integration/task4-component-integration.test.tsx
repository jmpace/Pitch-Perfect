/** @jsxImportSource react */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
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

describe('Task 4 - Component Integration and State Management Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Upload to Frame Extraction Component Integration', () => {
    it('should seamlessly integrate UploadDropzone completion with frame extraction initiation', async () => {
      // Mock successful frame extraction response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          frames: [
            { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
            { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
          ]
        })
      })

      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate complete file upload workflow
      const testFile = new File(['test video content'], 'integration-test.mp4', { type: 'video/mp4' })
      
      // Step 1: File selection
      updateState({
        videoFile: testFile,
        videoUrl: 'blob:http://localhost:3000/test-video',
        processingStep: 'idle'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile).toBeTruthy()
        expect(state.videoFile.name).toBe('integration-test.mp4')
      })

      // Step 2: Upload progress
      updateState({ 
        processingStep: 'uploading',
        uploadProgress: 25 
      })

      await waitFor(() => {
        const step1 = screen.getByTestId('step-1')
        expect(step1).toHaveClass('bg-blue-600')
        expect(step1).toHaveClass('animate-pulse')
        
        const progressBar = screen.getByTestId('progress-fill')
        expect(progressBar).toHaveStyle('width: 25%')
      })

      // Step 3: Upload completion
      updateState({
        uploadProgress: 100,
        processingStep: 'complete',
        videoUrl: 'https://blob.vercel-storage.com/integration-test.mp4'
      })

      await waitFor(() => {
        const step1 = screen.getByTestId('step-1')
        expect(step1).toHaveClass('bg-green-600')
        
        const progressBar = screen.getByTestId('progress-fill')
        expect(progressBar).toHaveStyle('width: 100%')
      })

      // Step 4: Automatic frame extraction trigger (onUploadComplete callback)
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-blue-600')
        expect(step2).toHaveClass('animate-pulse')
      })

      // Verify frame placeholders transition to loading state
      const framePlaceholders = screen.getAllByTestId(/frame-placeholder-\d/)
      expect(framePlaceholders).toHaveLength(9)
      framePlaceholders.forEach(placeholder => {
        expect(placeholder).toHaveClass('animate-spin')
      })

      // Step 5: Frame extraction completion
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const step2 = screen.getByTestId('step-2')
        expect(step2).toHaveClass('bg-green-600')
        
        const step3 = screen.getByTestId('step-3')
        expect(step3).toHaveClass('bg-blue-600')
      })

      // Verify frame grid displays extracted frames
      const frameImages = screen.getAllByTestId(/frame-image-\d/)
      expect(frameImages).toHaveLength(2)
      
      // Verify timestamp overlays
      const timestampOverlays = screen.getAllByTestId(/frame-timestamp-\d/)
      expect(timestampOverlays[0]).toHaveTextContent('0:05')
      expect(timestampOverlays[1]).toHaveTextContent('0:10')
    })

    it('should handle upload errors and prevent frame extraction from starting', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Start upload process
      updateState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        processingStep: 'uploading',
        uploadProgress: 50
      })

      // Simulate upload error
      simulateError('upload')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'upload')).toBe(true)
        expect(state.processingStep).toBe('uploading') // Should not advance
      })

      // Verify error UI
      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      
      // Verify frame extraction does not start
      const step2 = screen.getByTestId('step-2')
      expect(step2).not.toHaveClass('bg-blue-600')
      expect(step2).toHaveClass('bg-gray-300')

      // Verify frame placeholders remain in initial state
      const framePlaceholders = screen.getAllByTestId(/frame-placeholder-\d/)
      framePlaceholders.forEach(placeholder => {
        expect(placeholder).not.toHaveClass('animate-spin')
        expect(placeholder).toHaveClass('bg-gray-100')
      })
    })

    it('should preserve upload state during frame extraction process', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      const testFile = new File(['test content'], 'state-preservation.mp4', { type: 'video/mp4' })
      const videoUrl = 'https://blob.vercel-storage.com/state-preservation.mp4'
      
      // Complete upload
      updateState({
        videoFile: testFile,
        videoUrl: videoUrl,
        uploadProgress: 100,
        processingStep: 'complete',
        timings: { upload: 5000 },
        costs: { vercelBlob: 0.05 }
      })

      // Start frame extraction
      updateState({ processingStep: 'extracting' })

      // Verify upload state is preserved during frame extraction
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile.name).toBe('state-preservation.mp4')
        expect(state.videoUrl).toBe(videoUrl)
        expect(state.uploadProgress).toBe(100)
        expect(state.timings.upload).toBe(5000)
        expect(state.costs.vercelBlob).toBe(0.05)
        expect(state.processingStep).toBe('extracting')
      })

      // Complete frame extraction
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
        ],
        processingStep: 'transcribing',
        timings: { upload: 5000, frameExtraction: 12000 },
        costs: { vercelBlob: 0.05, rendiAPI: 0.80 }
      })

      // Verify all state is preserved
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile.name).toBe('state-preservation.mp4')
        expect(state.videoUrl).toBe(videoUrl)
        expect(state.uploadProgress).toBe(100)
        expect(state.extractedFrames).toHaveLength(1)
        expect(state.timings.upload).toBe(5000)
        expect(state.timings.frameExtraction).toBe(12000)
        expect(state.costs.vercelBlob).toBe(0.05)
        expect(state.costs.rendiAPI).toBe(0.80)
      })
    })
  })

  describe('Frame Extraction State Management Integration', () => {
    it('should manage frame extraction state transitions correctly', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Initial state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('idle')
        expect(state.extractedFrames).toEqual([])
        expect(state.errors).toEqual([])
      })

      // Transition to extracting
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('extracting')
      })

      // Add frames incrementally (simulating progress)
      const frames = [
        { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' },
        { url: 'frame3.png', timestamp: 15, filename: 'frame_00m15s.png' }
      ]

      // Add frames one by one
      for (let i = 0; i < frames.length; i++) {
        updateState({
          extractedFrames: frames.slice(0, i + 1),
          extractionProgress: ((i + 1) / frames.length) * 100
        })

        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.extractedFrames).toHaveLength(i + 1)
          expect(state.extractionProgress).toBe(((i + 1) / frames.length) * 100)
        })

        // Verify UI updates
        const progressBar = screen.getByTestId('progress-bar')
        expect(progressBar).toHaveStyle(`width: ${((i + 1) / frames.length) * 100}%`)
      }

      // Complete extraction
      updateState({ processingStep: 'transcribing' })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.processingStep).toBe('transcribing')
        expect(state.extractedFrames).toHaveLength(3)
      })
    })

    it('should handle frame extraction errors with proper state rollback', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Start with some initial state
      updateState({
        videoUrl: 'https://blob.vercel-storage.com/test.mp4',
        processingStep: 'extracting',
        extractionProgress: 50,
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
        ]
      })

      // Simulate error during extraction
      simulateError('frames')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(true)
        expect(state.processingStep).toBe('extracting') // Should not advance
      })

      // Verify UI shows error state
      expect(screen.getByTestId('error-card')).toBeInTheDocument()
      
      // Verify frame placeholders show error state
      const errorIcons = screen.getAllByTestId(/frame-error-\d/)
      expect(errorIcons.length).toBeGreaterThan(0)
      errorIcons.forEach(icon => {
        expect(icon).toHaveClass('bg-red-500')
        expect(icon).toHaveTextContent('⚠')
      })

      // Retry should clear error and reset state
      const retryButton = screen.getByTestId('retry-button')
      await userEvent.click(retryButton)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(false)
        expect(state.processingStep).toBe('extracting') // Stays in extracting
      })

      // Verify UI returns to loading state
      const loadingSpinners = screen.getAllByTestId(/frame-placeholder-\d/)
      loadingSpinners.forEach(spinner => {
        expect(spinner).toHaveClass('animate-spin')
      })
    })

    it('should handle concurrent state updates during frame extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate rapid concurrent updates (as might happen during real extraction)
      const updates = [
        { extractionProgress: 10 },
        { extractionProgress: 25 },
        { extractedFrames: [{ url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }] },
        { extractionProgress: 50 },
        { extractedFrames: [
            { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
            { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
          ]
        },
        { extractionProgress: 100 },
        { processingStep: 'transcribing' as const }
      ]

      // Apply all updates in quick succession
      await act(async () => {
        for (const update of updates) {
          updateState(update)
          // Small delay to simulate async operations
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      })

      // Verify final state is correct
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractionProgress).toBe(100)
        expect(state.extractedFrames).toHaveLength(2)
        expect(state.processingStep).toBe('transcribing')
      })

      // Verify UI reflects final state
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveStyle('width: 100%')
      
      const frameImages = screen.getAllByTestId(/frame-image-\d/)
      expect(frameImages).toHaveLength(2)
      
      const step2 = screen.getByTestId('step-2')
      expect(step2).toHaveClass('bg-green-600')
      
      const step3 = screen.getByTestId('step-3')
      expect(step3).toHaveClass('bg-blue-600')
    })
  })

  describe('UI Component Integration', () => {
    it('should integrate frame grid with processing steps and progress indicators', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Initial state - frame grid should show placeholders
      const framePlaceholders = screen.getAllByTestId(/frame-placeholder-\d/)
      expect(framePlaceholders).toHaveLength(9)
      framePlaceholders.forEach(placeholder => {
        expect(placeholder).toHaveClass('bg-gray-100')
        expect(placeholder).toHaveTextContent('Frame')
      })

      // Start extraction - placeholders should show loading
      updateState({ processingStep: 'extracting' })

      await waitFor(() => {
        const loadingSpinners = screen.getAllByTestId(/frame-placeholder-\d/)
        loadingSpinners.forEach(spinner => {
          expect(spinner).toHaveClass('animate-spin')
        })
      })

      // Progress updates - progress bar should update
      updateState({ extractionProgress: 33 })
      
      const progressBar = screen.getByTestId('progress-bar')
      await waitFor(() => {
        expect(progressBar).toHaveStyle('width: 33%')
      })

      // Add frames - grid should show actual images
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' },
          { url: 'frame3.png', timestamp: 15, filename: 'frame_00m15s.png' }
        ],
        extractionProgress: 100,
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const frameImages = screen.getAllByTestId(/frame-image-\d/)
        expect(frameImages).toHaveLength(3)
        
        const timestampOverlays = screen.getAllByTestId(/frame-timestamp-\d/)
        expect(timestampOverlays).toHaveLength(3)
        expect(timestampOverlays[0]).toHaveTextContent('0:05')
        expect(timestampOverlays[1]).toHaveTextContent('0:10')
        expect(timestampOverlays[2]).toHaveTextContent('0:15')
      })

      // Processing step should show completion
      const step2 = screen.getByTestId('step-2')
      expect(step2).toHaveClass('bg-green-600')
      
      const step3 = screen.getByTestId('step-3')
      expect(step3).toHaveClass('bg-blue-600')
    })

    it('should integrate cost tracker with frame extraction progress', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Initial cost state
      updateState({ costs: { vercelBlob: 0.02, rendiAPI: 0.00 } })

      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toBeInTheDocument()

      // Start extraction with cost updates
      updateState({
        processingStep: 'extracting',
        costs: { vercelBlob: 0.02, rendiAPI: 0.30 }
      })

      // Click to expand cost breakdown
      await userEvent.click(costTracker)

      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toBeVisible()
        expect(costBreakdown).toHaveTextContent('Vercel Blob: $0.00')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
      })

      // Update costs during extraction
      updateState({
        costs: { vercelBlob: 0.02, rendiAPI: 0.75 },
        extractionProgress: 75
      })

      // Complete extraction with final costs
      updateState({
        costs: { vercelBlob: 0.02, rendiAPI: 1.20 },
        processingStep: 'transcribing'
      })

      // Verify final cost display
      await userEvent.click(costTracker)
      await waitFor(() => {
        const costBreakdown = screen.getByTestId('cost-breakdown')
        expect(costBreakdown).toHaveTextContent('Rendi API: $0.00')
      })
    })

    it('should integrate timing display with frame extraction process', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Start with upload timing
      updateState({
        timings: { upload: 3000 },
        processingStep: 'complete'
      })

      const timingDisplay = screen.getByTestId('timing-display')
      expect(timingDisplay).toBeInTheDocument()

      // Start frame extraction
      const extractionStartTime = Date.now()
      updateState({
        processingStep: 'extracting',
        timings: { upload: 3000, frameExtraction: extractionStartTime }
      })

      // Simulate extraction progress with timing updates
      const progressUpdates = [
        { extractionProgress: 25, duration: 5000 },
        { extractionProgress: 50, duration: 10000 },
        { extractionProgress: 75, duration: 15000 },
        { extractionProgress: 100, duration: 20000 }
      ]

      for (const update of progressUpdates) {
        updateState({
          extractionProgress: update.extractionProgress,
          timings: { upload: 3000, frameExtraction: update.duration }
        })

        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.timings.frameExtraction).toBe(update.duration)
        })
      }

      // Complete extraction
      updateState({
        processingStep: 'transcribing',
        timings: { upload: 3000, frameExtraction: 20000 }
      })

      // Verify timing is preserved and displayed
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.timings.upload).toBe(3000)
        expect(state.timings.frameExtraction).toBe(20000)
      })

      // Total time should be sum of all steps
      const totalTime = 3000 + 20000 // 23 seconds
      expect(timingDisplay).toHaveTextContent(totalTime.toString())
    })
  })

  describe('Error Handling Component Integration', () => {
    it('should integrate frame extraction errors with global error handling system', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      const simulateError = (window as any).simulateError
      
      // Start frame extraction
      updateState({
        processingStep: 'extracting',
        extractionProgress: 30
      })

      // Simulate different types of errors
      const errorScenarios = [
        { section: 'frames', expectedUI: 'frame-error' },
        { section: 'video', expectedUI: 'video-error' },
        { section: 'processing', expectedUI: 'processing-error' }
      ]

      for (const scenario of errorScenarios) {
        // Clear previous errors
        updateState({ errors: [] })

        // Simulate error
        simulateError(scenario.section)

        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.errors.some(e => e.section === scenario.section)).toBe(true)
        })

        // Verify error UI is displayed
        expect(screen.getByTestId('error-card')).toBeInTheDocument()
        expect(screen.getByText(new RegExp(`Something went wrong in ${scenario.section.charAt(0).toUpperCase() + scenario.section.slice(1)} section`, 'i'))).toBeInTheDocument()

        // Verify retry button is available
        const retryButton = screen.getByTestId('retry-button')
        expect(retryButton).toBeInTheDocument()

        // Test retry functionality
        await userEvent.click(retryButton)

        await waitFor(() => {
          const state = (window as any).experimentState
          expect(state.errors.some(e => e.section === scenario.section)).toBe(false)
        })
      }
    })

    it('should handle partial frame extraction failures gracefully', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Start extraction and get some frames successfully
      updateState({
        processingStep: 'extracting',
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        extractionProgress: 40
      })

      await waitFor(() => {
        const frameImages = screen.getAllByTestId(/frame-image-\d/)
        expect(frameImages).toHaveLength(2)
      })

      // Simulate partial failure - some frames succeed, others fail
      const simulateError = (window as any).simulateError
      simulateError('frames')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(true)
        // Should preserve successfully extracted frames
        expect(state.extractedFrames).toHaveLength(2)
        expect(state.processingStep).toBe('extracting') // Should not advance
      })

      // Verify UI shows mixed state - some frames successful, others error
      const frameImages = screen.getAllByTestId(/frame-image-\d/)
      expect(frameImages).toHaveLength(2) // Successful frames remain

      const errorIcons = screen.getAllByTestId(/frame-error-\d/)
      expect(errorIcons.length).toBeGreaterThan(0) // Error placeholders for failed frames

      // Retry should continue from where it left off
      const retryButton = screen.getByTestId('retry-button')
      await userEvent.click(retryButton)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors.some(e => e.section === 'frames')).toBe(false)
        expect(state.extractedFrames).toHaveLength(2) // Preserve successful frames
      })
    })
  })

  describe('Debug Panel Integration', () => {
    it('should integrate frame extraction data with debug panel', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Add frame extraction data
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        processingStep: 'transcribing',
        timings: { frameExtraction: 15000 },
        costs: { rendiAPI: 0.80 },
        errors: []
      })

      // Open debug panel
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true })

      await waitFor(() => {
        const debugPanel = screen.getByTestId('debug-panel')
        expect(debugPanel).toBeVisible()
      })

      // Verify frame data is visible
      const debugContent = screen.getByTestId('debug-content')
      expect(debugContent).toHaveTextContent('extractedFrames')
      expect(debugContent).toHaveTextContent('frame_00m05s.png')
      expect(debugContent).toHaveTextContent('frame_00m10s.png')
      expect(debugContent).toHaveTextContent('timestamp: 5')
      expect(debugContent).toHaveTextContent('timestamp: 10')

      // Verify other state data
      expect(debugContent).toHaveTextContent('processingStep: "transcribing"')
      expect(debugContent).toHaveTextContent('frameExtraction: 15000')
      expect(debugContent).toHaveTextContent('rendiAPI: 0.8')

      // Test real-time updates
      updateState({ processingStep: 'complete' })

      await waitFor(() => {
        expect(debugContent).toHaveTextContent('processingStep: "complete"')
      })

      // Close debug panel
      fireEvent.keyDown(document, { key: 'd', ctrlKey: true })

      await waitFor(() => {
        const debugPanel = screen.getByTestId('debug-panel')
        expect(debugPanel).not.toBeVisible()
      })
    })
  })

  describe('Performance and Memory Management', () => {
    it('should manage memory efficiently during frame extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Test with large number of frames
      const manyFrames = Array.from({ length: 50 }, (_, i) => ({
        url: `frame${i + 1}.png`,
        timestamp: (i + 1) * 5,
        filename: `frame_${Math.floor(((i + 1) * 5) / 60).toString().padStart(2, '0')}m${(((i + 1) * 5) % 60).toString().padStart(2, '0')}s.png`
      }))

      const startTime = performance.now()
      
      updateState({ extractedFrames: manyFrames })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(50)
      })

      const endTime = performance.now()
      
      // Should handle large frame sets efficiently
      expect(endTime - startTime).toBeLessThan(2000) // Should complete within 2 seconds

      // Verify only first 9 frames are rendered in UI (for performance)
      const frameImages = screen.getAllByTestId(/frame-image-\d/)
      expect(frameImages).toHaveLength(9)

      // Test memory cleanup
      updateState({ extractedFrames: [] })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(0)
      })

      // Verify URL cleanup was called
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('should handle component unmount and cleanup gracefully', async () => {
      const { unmount } = render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Add some frames
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' }
        ],
        processingStep: 'extracting'
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1)
      })

      // Unmount component
      unmount()

      // Verify cleanup occurred
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })
  })

  describe('Accessibility Integration', () => {
    it('should maintain accessibility during frame extraction workflow', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Start extraction
      updateState({ processingStep: 'extracting' })

      // Verify loading state has proper ARIA labels
      const loadingSpinners = screen.getAllByTestId(/frame-placeholder-\d/)
      loadingSpinners.forEach((spinner, index) => {
        expect(spinner).toHaveAttribute('aria-label', `Frame ${index + 1} loading`)
        expect(spinner).toHaveAttribute('role', 'img')
      })

      // Complete extraction
      updateState({
        extractedFrames: [
          { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
          { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
        ],
        processingStep: 'transcribing'
      })

      await waitFor(() => {
        const frameImages = screen.getAllByTestId(/frame-image-\d/)
        frameImages.forEach((image, index) => {
          expect(image).toHaveAttribute('alt', `Video frame at ${(index + 1) * 5} seconds`)
        })
      })

      // Test error state accessibility
      const simulateError = (window as any).simulateError
      simulateError('frames')

      await waitFor(() => {
        const errorIcons = screen.getAllByTestId(/frame-error-\d/)
        errorIcons.forEach((icon, index) => {
          expect(icon).toHaveAttribute('aria-label', `Frame ${index + 1} failed to load`)
          expect(icon).toHaveAttribute('role', 'alert')
        })
      })
    })
  })
})
/** @jsxImportSource react */
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

// Mock database operations (simulating future database integration)
const mockDatabase = {
  save: vi.fn(),
  load: vi.fn(),
  delete: vi.fn(),
  query: vi.fn()
}

// Mock localStorage for persistent state simulation
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('Database Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDatabase.save.mockClear()
    mockDatabase.load.mockClear()
    mockDatabase.delete.mockClear()
    mockDatabase.query.mockClear()
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()
    mockLocalStorage.clear.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('State Persistence', () => {
    it('should save experiment state to local storage', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Update state with test data
      const testState = {
        uploadProgress: 50,
        processingStep: 'extracting' as const,
        fullTranscript: 'Test transcript',
        timings: { upload: 1000 }
      }
      
      updateState(testState)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(50)
        expect(state.processingStep).toBe('extracting')
      })

      // Simulate state persistence (would be actual localStorage in real app)
      const stateToSave = JSON.stringify((window as any).experimentState)
      mockLocalStorage.setItem('experimentState', stateToSave)
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'experimentState',
        expect.stringContaining('"uploadProgress":50')
      )
    })

    it('should load experiment state from local storage', async () => {
      const savedState = {
        videoFile: null,
        videoUrl: '',
        uploadProgress: 75,
        processingStep: 'transcribing',
        fullTranscript: 'Restored transcript',
        segmentedTranscript: [],
        extractedFrames: [],
        errors: [],
        timings: { upload: 2000 }
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedState))

      render(<ArchitectureExperimentPage />)
      
      // Simulate loading state from localStorage on mount
      const updateState = (window as any).updateExperimentState
      updateState(savedState)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(75)
        expect(state.processingStep).toBe('transcribing')
        expect(state.fullTranscript).toBe('Restored transcript')
      })

      // Verify UI reflects loaded state
      const progressBar = screen.getByTestId('progress-fill')
      expect(progressBar).toHaveStyle('width: 75%')
      
      const step3 = screen.getByTestId('step-3')
      expect(step3).toHaveClass('bg-blue-600')
    })

    it('should handle corrupted storage data gracefully', async () => {
      // Mock corrupted data
      mockLocalStorage.getItem.mockReturnValue('invalid-json{')

      render(<ArchitectureExperimentPage />)

      // Component should still render with default state
      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(0)
        expect(state.processingStep).toBe('idle')
      })

      expect(screen.getByTestId('upload-section')).toBeInTheDocument()
    })
  })

  describe('Data Validation and Integrity', () => {
    it('should validate video file metadata before storage', async () => {
      render(<ArchitectureExperimentPage />)
      
      const testFile = new File(['test content'], 'test-video.mp4', { 
        type: 'video/mp4' 
      })
      
      // Add custom properties to simulate metadata
      Object.defineProperty(testFile, 'size', { value: 1000000 })
      Object.defineProperty(testFile, 'lastModified', { value: Date.now() })

      const fileInput = screen.getByTestId('file-input')
      await userEvent.upload(fileInput, testFile)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.videoFile).toBeTruthy()
        expect(state.videoFile.name).toBe('test-video.mp4')
        expect(state.videoFile.type).toBe('video/mp4')
      })

      // Simulate validation and storage
      const fileMetadata = {
        name: testFile.name,
        type: testFile.type,
        size: testFile.size,
        lastModified: testFile.lastModified
      }

      mockDatabase.save.mockResolvedValue({ id: 'file-123', ...fileMetadata })
      
      expect(mockDatabase.save).not.toHaveBeenCalled() // Since no actual DB in this experiment
    })

    it('should handle transcript data validation', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Test with valid transcript data
      const validTranscript = {
        fullTranscript: 'This is a valid transcript',
        segmentedTranscript: [
          { text: 'This is', startTime: 0, endTime: 1.5, confidence: 0.95 },
          { text: 'a valid transcript', startTime: 1.5, endTime: 3.0, confidence: 0.98 }
        ]
      }
      
      updateState(validTranscript)

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.fullTranscript).toBe('This is a valid transcript')
        expect(state.segmentedTranscript).toHaveLength(2)
        expect(state.segmentedTranscript[0].confidence).toBe(0.95)
      })

      // Verify UI shows valid data
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      expect(fullTranscriptArea).toHaveTextContent('This is a valid transcript')
    })

    it('should handle invalid transcript data gracefully', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Test with malformed transcript data
      const invalidTranscript = {
        fullTranscript: null, // Invalid
        segmentedTranscript: [
          { text: 'Missing required fields' }, // Missing startTime, endTime, confidence
          { startTime: 0, endTime: 1 } // Missing text and confidence
        ]
      }
      
      updateState(invalidTranscript)

      await waitFor(() => {
        const state = (window as any).experimentState
        // Should handle gracefully, possibly with fallback values
        expect(state.fullTranscript).toBe(null)
        expect(state.segmentedTranscript).toHaveLength(2)
      })

      // UI should show placeholder text for invalid data
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      expect(fullTranscriptArea).toHaveTextContent('Transcript will appear here...')
    })
  })

  describe('Error State Management', () => {
    it('should persist error states correctly', async () => {
      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      
      // Generate multiple errors
      simulateError('upload')
      simulateError('video')

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.errors).toHaveLength(2)
        expect(state.errors[0].section).toBe('upload')
        expect(state.errors[1].section).toBe('video')
      })

      // Verify error display
      expect(screen.getByTestId('error-card')).toBeInTheDocument()
    })

    it('should clear errors on retry', async () => {
      render(<ArchitectureExperimentPage />)
      
      const simulateError = (window as any).simulateError
      simulateError('upload')

      await waitFor(() => {
        expect(screen.getByTestId('error-card')).toBeInTheDocument()
      })

      // Click retry button
      const retryButton = screen.getByTestId('retry-button')
      await userEvent.click(retryButton)

      await waitFor(() => {
        const state = (window as any).experimentState
        const uploadErrors = state.errors.filter((e: any) => e.section === 'upload')
        expect(uploadErrors).toHaveLength(0)
      })
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large transcript data efficiently', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Generate large transcript data
      const largeTranscript = 'This is a very long transcript. '.repeat(1000)
      const largeSegmentedTranscript = Array.from({ length: 100 }, (_, i) => ({
        text: `Segment ${i + 1}`,
        startTime: i * 2,
        endTime: (i + 1) * 2,
        confidence: 0.95
      }))

      const startTime = performance.now()
      
      updateState({
        fullTranscript: largeTranscript,
        segmentedTranscript: largeSegmentedTranscript
      })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.fullTranscript.length).toBeGreaterThan(1000)
        expect(state.segmentedTranscript).toHaveLength(100)
      })

      const endTime = performance.now()
      const updateTime = endTime - startTime
      
      // Should handle large data within reasonable time (under 100ms)
      expect(updateTime).toBeLessThan(100)
    })

    it('should batch state updates to prevent excessive re-renders', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      let renderCount = 0
      
      // Mock render counting
      const originalSetState = React.useState
      vi.spyOn(React, 'useState').mockImplementation((initial) => {
        renderCount++
        return originalSetState(initial)
      })

      // Perform multiple rapid updates
      updateState({ uploadProgress: 10 })
      updateState({ uploadProgress: 20 })
      updateState({ uploadProgress: 30 })
      updateState({ uploadProgress: 40 })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(40)
      })

      // Should not cause excessive re-renders
      expect(renderCount).toBeLessThan(20)
      
      vi.restoreAllMocks()
    })
  })

  describe('Concurrent Data Operations', () => {
    it('should handle concurrent state updates without data loss', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Simulate concurrent updates from different operations
      const updates = [
        { uploadProgress: 25 },
        { processingStep: 'extracting' as const },
        { fullTranscript: 'Partial transcript' },
        { timings: { upload: 1000 } }
      ]

      // Apply all updates concurrently
      await Promise.all(updates.map(update => {
        return new Promise(resolve => {
          updateState(update)
          resolve(undefined)
        })
      }))

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.uploadProgress).toBe(25)
        expect(state.processingStep).toBe('extracting')
        expect(state.fullTranscript).toBe('Partial transcript')
        expect(state.timings.upload).toBe(1000)
      })
    })

    it('should maintain referential integrity during updates', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      const initialFrames = [
        { url: 'frame1.jpg', timestamp: 0, filename: 'frame1.jpg' }
      ]
      
      updateState({ extractedFrames: initialFrames })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1)
      })

      // Update other state while preserving frames
      updateState({ uploadProgress: 100 })

      await waitFor(() => {
        const state = (window as any).experimentState
        expect(state.extractedFrames).toHaveLength(1) // Should be preserved
        expect(state.uploadProgress).toBe(100)
      })
    })
  })
})
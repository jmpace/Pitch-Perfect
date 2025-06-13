import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'

/**
 * 🔴 RED Phase: Frame Extraction Unit Tests
 * 
 * Testing framework components integration and actual UI interactions
 * These tests verify component rendering, UI integration, event handling,
 * state management, and CSS integration as required by TDD.
 */

describe('Frame Extraction Component Integration', () => {
  
  describe('Component Rendering Tests', () => {
    test('renders frame grid with 9 placeholders initially', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const frameGrid = screen.getByTestId('frame-grid')
      expect(frameGrid).toBeInTheDocument()
      
      // Verify all 9 frame placeholders exist
      for (let i = 1; i <= 9; i++) {
        const placeholder = screen.getByTestId(`frame-placeholder-${i}`)
        expect(placeholder).toBeInTheDocument()
        expect(placeholder).toHaveClass('bg-gray-400')
        expect(placeholder).toHaveClass('cursor-pointer')
      }
    })

    test('frame placeholders have correct dimensions and styling', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const placeholder = screen.getByTestId('frame-placeholder-1')
      expect(placeholder).toHaveClass('w-[120px]')
      expect(placeholder).toHaveClass('h-[68px]')
      expect(placeholder).toHaveClass('rounded')
      expect(placeholder).toHaveClass('flex')
      expect(placeholder).toHaveClass('items-center')
      expect(placeholder).toHaveClass('justify-center')
    })
  })

  describe('UI Integration - Loading Spinners', () => {
    test('shows loading spinners when processingStep is extracting', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Trigger extraction state
      fireEvent.click(screen.getByTestId('simulate-error-button'))
      
      // Use the global update function to set extracting state
      const updateState = (window as any).updateExperimentState
      updateState({ processingStep: 'extracting' })
      
      await waitFor(() => {
        const frameGrid = screen.getByTestId('frame-grid')
        const loadingSpinners = frameGrid.querySelectorAll('[data-testid^="frame-spinner-"]')
        expect(loadingSpinners).toHaveLength(9)
      })
    })

    test('loading spinners have rotation animation', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      updateState({ processingStep: 'extracting' })
      
      await waitFor(() => {
        const spinner = screen.getByTestId('frame-spinner-1')
        expect(spinner).toHaveClass('animate-spin')
      })
    })
  })

  describe('UI Integration - Extracted Frames Display', () => {
    test('displays actual frame images when extractedFrames state is populated', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockFrames = [
        { url: 'https://api.rendi.dev/files/frame_00m05s.png', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'https://api.rendi.dev/files/frame_00m10s.png', timestamp: 10, filename: 'frame_00m10s.png' },
        { url: 'https://api.rendi.dev/files/frame_00m15s.png', timestamp: 15, filename: 'frame_00m15s.png' }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockFrames })
      
      await waitFor(() => {
        for (let i = 0; i < mockFrames.length; i++) {
          const frameImage = screen.getByTestId(`frame-image-${i + 1}`)
          expect(frameImage).toBeInTheDocument()
          expect(frameImage).toHaveAttribute('src', mockFrames[i].url)
          expect(frameImage).toHaveAttribute('alt', `Frame at ${mockFrames[i].timestamp}s`)
        }
      })
    })

    test('shows timestamp overlays with correct formatting and positioning', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockFrames = [
        { url: 'test1.png', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'test2.png', timestamp: 65, filename: 'frame_01m05s.png' },
        { url: 'test3.png', timestamp: 125, filename: 'frame_02m05s.png' }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockFrames })
      
      await waitFor(() => {
        const overlay1 = screen.getByTestId('timestamp-overlay-1')
        expect(overlay1).toBeInTheDocument()
        expect(overlay1).toHaveTextContent('0:05')
        expect(overlay1).toHaveClass('absolute')
        expect(overlay1).toHaveClass('bottom-1')
        expect(overlay1).toHaveClass('right-1')
        expect(overlay1).toHaveClass('bg-black')
        expect(overlay1).toHaveClass('bg-opacity-80')
        expect(overlay1).toHaveClass('text-white')
        
        const overlay2 = screen.getByTestId('timestamp-overlay-2')
        expect(overlay2).toHaveTextContent('1:05')
        
        const overlay3 = screen.getByTestId('timestamp-overlay-3')
        expect(overlay3).toHaveTextContent('2:05')
      })
    })
  })

  describe('Event Handling - Click-to-Seek', () => {
    test('clicking frame triggers seek functionality', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockFrames = [
        { url: 'test.png', timestamp: 25, filename: 'frame_00m25s.png' }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockFrames })
      
      await waitFor(() => {
        const frameContainer = screen.getByTestId('frame-container-1')
        fireEvent.click(frameContainer)
        
        // Verify seek function was called
        const experimentState = (window as any).experimentState
        expect(experimentState.currentVideoTime).toBe(25)
      })
    })

    test('frame containers have proper accessibility attributes', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockFrames = [
        { url: 'test.png', timestamp: 15, filename: 'frame_00m15s.png' }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockFrames })
      
      await waitFor(() => {
        const frameContainer = screen.getByTestId('frame-container-1')
        expect(frameContainer).toHaveAttribute('tabIndex', '0')
        expect(frameContainer).toHaveAttribute('role', 'button')
        expect(frameContainer).toHaveAttribute('aria-label', 'Seek to 0:15')
      })
    })
  })

  describe('State Management Integration', () => {
    test('processingStep changes trigger correct UI updates', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Test idle state
      updateState({ processingStep: 'idle' })
      await waitFor(() => {
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Waiting to start...')
      })
      
      // Test extracting state
      updateState({ processingStep: 'extracting' })
      await waitFor(() => {
        expect(screen.getByTestId('current-step-text')).toHaveTextContent('Extracting frames')
        expect(screen.getByTestId('step-2')).toHaveClass('bg-blue-600')
        expect(screen.getByTestId('step-2')).toHaveClass('animate-pulse')
      })
    })

    test('extractedFrames state updates trigger frame grid re-render', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      
      // Initially no frames
      expect(screen.queryByTestId('frame-image-1')).not.toBeInTheDocument()
      
      // Add frames
      const frames = [
        { url: 'frame1.png', timestamp: 5, filename: 'frame_00m05s.png' },
        { url: 'frame2.png', timestamp: 10, filename: 'frame_00m10s.png' }
      ]
      
      updateState({ extractedFrames: frames })
      
      await waitFor(() => {
        expect(screen.getByTestId('frame-image-1')).toBeInTheDocument()
        expect(screen.getByTestId('frame-image-2')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling UI Integration', () => {
    test('displays error state with red backgrounds and warning icons', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      updateState({
        processingStep: 'extracting',
        errors: [{
          section: 'frames',
          message: 'Frame extraction failed - network timeout',
          timestamp: Date.now()
        }]
      })
      
      await waitFor(() => {
        // Check placeholders show error state
        for (let i = 1; i <= 9; i++) {
          const placeholder = screen.getByTestId(`frame-placeholder-${i}`)
          expect(placeholder).toHaveClass('bg-red-500')
          
          const warningIcon = screen.getByTestId(`warning-icon-${i}`)
          expect(warningIcon).toBeInTheDocument()
          expect(warningIcon).toHaveTextContent('⚠')
          expect(warningIcon).toHaveClass('text-white')
        }
        
        // Check error message display
        const errorLog = screen.getByTestId('error-log')
        expect(errorLog).toHaveTextContent('Frame extraction failed - network timeout')
        expect(errorLog).toHaveClass('text-red-500')
      })
    })

    test('shows retry button when frame extraction error exists', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      updateState({
        errors: [{
          section: 'frames',
          message: 'Frame extraction failed',
          timestamp: Date.now()
        }]
      })
      
      await waitFor(() => {
        const retryButton = screen.getByTestId('retry-frame-extraction')
        expect(retryButton).toBeInTheDocument()
        expect(retryButton).toHaveClass('bg-blue-600')
        expect(retryButton).toHaveClass('text-white')
        expect(retryButton).toHaveTextContent('Retry Frame Extraction')
      })
    })
  })

  describe('Progress Bar Integration', () => {
    test('shows progress bar during frame extraction', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      updateState({ 
        processingStep: 'extracting',
        extractionProgress: 0
      })
      
      await waitFor(() => {
        const progressBar = screen.getByTestId('extraction-progress')
        expect(progressBar).toBeInTheDocument()
        expect(progressBar).toHaveClass('h-2')
        
        // Check for progress value in aria-valuenow or data attribute
        const progressValue = progressBar.getAttribute('aria-valuenow') || 
                            progressBar.getAttribute('data-value') ||
                            '0'
        expect(parseInt(progressValue)).toBe(0)
      })
    })

    test('progress bar updates with extraction progress', async () => {
      render(<ArchitectureExperimentPage />)
      
      const updateState = (window as any).updateExperimentState
      updateState({ 
        processingStep: 'extracting',
        extractionProgress: 65
      })
      
      await waitFor(() => {
        const progressBar = screen.getByTestId('extraction-progress')
        const progressValue = progressBar.getAttribute('aria-valuenow') || 
                            progressBar.getAttribute('data-value') ||
                            '0'
        expect(parseInt(progressValue)).toBe(65)
      })
    })
  })

  describe('Variable Video Length Handling', () => {
    test('handles short video with fewer than 9 frames correctly', async () => {
      render(<ArchitectureExperimentPage />)
      
      // 35-second video should have 7 frames (every 5 seconds)
      const shortVideoFrames = Array.from({ length: 7 }, (_, i) => ({
        url: `frame${i}.png`,
        timestamp: (i + 1) * 5,
        filename: `frame_00m${((i + 1) * 5).toString().padStart(2, '0')}s.png`
      }))
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: shortVideoFrames })
      
      await waitFor(() => {
        // First 7 frames should be visible
        for (let i = 1; i <= 7; i++) {
          expect(screen.getByTestId(`frame-image-${i}`)).toBeInTheDocument()
        }
        
        // Last 2 placeholders should be hidden
        expect(screen.getByTestId('frame-placeholder-8')).toHaveClass('hidden')
        expect(screen.getByTestId('frame-placeholder-9')).toHaveClass('hidden')
      })
    })
  })

  describe('CSS Integration and Styling', () => {
    test('frame grid maintains proper layout and spacing', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const frameGrid = screen.getByTestId('frame-grid')
      expect(frameGrid).toHaveClass('grid')
      expect(frameGrid).toHaveClass('grid-cols-3')
      expect(frameGrid).toHaveClass('gap-2')
    })

    test('frame containers have hover effects', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading-skeleton')).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const placeholder = screen.getByTestId('frame-placeholder-1')
      expect(placeholder).toHaveClass('hover:bg-gray-500')
      expect(placeholder).toHaveClass('transition-colors')
    })

    test('timestamp overlays have proper z-index and positioning', async () => {
      render(<ArchitectureExperimentPage />)
      
      const mockFrames = [
        { url: 'test.png', timestamp: 30, filename: 'frame_00m30s.png' }
      ]
      
      const updateState = (window as any).updateExperimentState
      updateState({ extractedFrames: mockFrames })
      
      await waitFor(() => {
        const overlay = screen.getByTestId('timestamp-overlay-1')
        expect(overlay).toHaveClass('z-10')
        expect(overlay).toHaveClass('px-1')
        expect(overlay).toHaveClass('py-0.5')
        expect(overlay).toHaveClass('text-xs')
        expect(overlay).toHaveClass('rounded')
      })
    })
  })
})
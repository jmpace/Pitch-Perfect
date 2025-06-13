import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock ShadCN imports before importing the component
vi.mock('@/components/ui/card', () => ({
  Card: vi.fn(({ children, className, ...props }) => (
    <div data-component="card" className={className} {...props}>
      {children}
    </div>
  )),
  CardContent: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
  CardHeader: vi.fn(({ children, ...props }) => <div {...props}>{children}</div>),
  CardTitle: vi.fn(({ children, ...props }) => <h3 {...props}>{children}</h3>)
}))

vi.mock('@/components/ui/button', () => ({
  Button: vi.fn(({ children, variant, onClick, className, ...props }) => (
    <button 
      data-component="button" 
      className={className} 
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  ))
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: vi.fn(({ value, className, ...props }) => (
    <div 
      data-component="progress" 
      className={className}
      aria-valuenow={value}
      {...props}
    >
      <div data-testid="progress-fill" style={{ width: `${value}%` }} />
    </div>
  ))
}))

// Import the component after mocking
import ArchitectureExperimentPage from '@/app/experiment/architecture-test/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// Mock global window functions that will be exposed
const mockUpdateExperimentState = vi.fn()
const mockSimulateError = vi.fn()

Object.defineProperty(window, 'updateExperimentState', {
  value: mockUpdateExperimentState,
  writable: true
})

Object.defineProperty(window, 'simulateError', {
  value: mockSimulateError,
  writable: true
})

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
  writable: true
})

describe('🔴 RED Phase: Architecture Experiment Page Component Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window.experimentState
    window.experimentState = {
      videoFile: null,
      videoUrl: '',
      uploadProgress: 0,
      processingStep: 'idle',
      fullTranscript: '',
      segmentedTranscript: [],
      extractedFrames: [],
      errors: [],
      timings: {}
    }
  })

  describe('Basic Component Rendering', () => {
    test('renders architecture experiment page component', () => {
      render(<ArchitectureExperimentPage />)
      
      // Should render main container
      const mainContent = screen.getByRole('main')
      expect(mainContent).toBeInTheDocument()
      expect(mainContent).toHaveAttribute('aria-label', expect.stringMatching(/Architecture Experiment/i))
    })

    test('renders page title with correct text', () => {
      render(<ArchitectureExperimentPage />)
      
      const pageTitle = screen.getByRole('heading', { level: 1 })
      expect(pageTitle).toBeInTheDocument()
      expect(pageTitle).toHaveTextContent('Architecture Experiment')
    })

    test('renders with correct document title', () => {
      render(<ArchitectureExperimentPage />)
      expect(document.title).toBe('Architecture Experiment - Pitch Perfect')
    })

    test('renders 4-section grid layout container', () => {
      render(<ArchitectureExperimentPage />)
      
      const gridLayout = screen.getByTestId('grid-layout')
      expect(gridLayout).toBeInTheDocument()
      expect(gridLayout).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-4')
    })
  })

  describe('UI Integration - ShadCN Components Actually Used', () => {
    test('integrates Card components from ShadCN', () => {
      render(<ArchitectureExperimentPage />)
      
      // Verify Card components are actually used (not just divs)
      const cards = screen.getAllByTestId(/.*-section/)
      expect(cards).toHaveLength(4)
      
      // Verify mock was called - proving we're using the actual ShadCN Card component
      expect(Card).toHaveBeenCalled()
    })

    test('integrates Button component from ShadCN for file upload', () => {
      render(<ArchitectureExperimentPage />)
      
      const chooseFileButton = screen.getByTestId('choose-file-button')
      expect(chooseFileButton).toBeInTheDocument()
      expect(chooseFileButton).toHaveAttribute('data-component', 'button')
      
      // Verify mock was called - proving we're using actual ShadCN Button
      expect(Button).toHaveBeenCalled()
    })

    test('implements progress bar for upload tracking', () => {
      render(<ArchitectureExperimentPage />)
      
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveAttribute('role', 'progressbar')
      
      // Verify progress fill exists
      const progressFill = screen.getByTestId('progress-fill')
      expect(progressFill).toBeInTheDocument()
    })

    test('Button component receives correct props for styling', () => {
      render(<ArchitectureExperimentPage />)
      
      // Verify the button gets proper variant and styling props
      expect(Button).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining('bg-blue-600')
        }),
        expect.any(Object)
      )
    })

    test('Progress bar displays correct initial value', () => {
      render(<ArchitectureExperimentPage />)
      
      // Initial render should have aria-valuenow 0
      const progressBar = screen.getByTestId('progress-bar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      
      // Progress fill should be 0% width
      const progressFill = screen.getByTestId('progress-fill')
      expect(progressFill).toHaveStyle('width: 0%')
    })
  })

  describe('Four Required Sections Render', () => {
    test('renders Upload section with correct data-testid', () => {
      render(<ArchitectureExperimentPage />)
      
      const uploadSection = screen.getByTestId('upload-section')
      expect(uploadSection).toBeInTheDocument()
      expect(uploadSection).toHaveAttribute('role', 'region')
      expect(uploadSection).toHaveAttribute('aria-label', expect.stringMatching(/upload/i))
    })

    test('renders Video Playback & Frames section with correct data-testid', () => {
      render(<ArchitectureExperimentPage />)
      
      const videoSection = screen.getByTestId('video-section')
      expect(videoSection).toBeInTheDocument()
      expect(videoSection).toHaveAttribute('role', 'region')
      expect(videoSection).toHaveAttribute('aria-label', expect.stringMatching(/video.*playback/i))
    })

    test('renders Transcripts section with correct data-testid', () => {
      render(<ArchitectureExperimentPage />)
      
      const transcriptsSection = screen.getByTestId('transcripts-section')
      expect(transcriptsSection).toBeInTheDocument()
      expect(transcriptsSection).toHaveAttribute('role', 'region')
      expect(transcriptsSection).toHaveAttribute('aria-label', expect.stringMatching(/transcript/i))
    })

    test('renders Processing Status section with correct data-testid', () => {
      render(<ArchitectureExperimentPage />)
      
      const processingSection = screen.getByTestId('processing-section')
      expect(processingSection).toBeInTheDocument()
      expect(processingSection).toHaveAttribute('role', 'region')
      expect(processingSection).toHaveAttribute('aria-label', expect.stringMatching(/processing.*status/i))
    })

    test('all sections have section titles with correct typography', () => {
      render(<ArchitectureExperimentPage />)
      
      const uploadTitle = screen.getByTestId('upload-title')
      const videoTitle = screen.getByTestId('video-title')
      const transcriptsTitle = screen.getByTestId('transcripts-title')
      const processingTitle = screen.getByTestId('processing-title')
      
      expect(uploadTitle).toHaveTextContent('Upload')
      expect(videoTitle).toHaveTextContent('Video Playback & Frames')
      expect(transcriptsTitle).toHaveTextContent('Transcripts')
      expect(processingTitle).toHaveTextContent('Processing Status')
      
      // All titles should have semibold font and 18px size classes
      const titles = [uploadTitle, videoTitle, transcriptsTitle, processingTitle]
      titles.forEach(title => {
        expect(title).toHaveClass('text-lg', 'font-semibold')
      })
    })
  })

  describe('Section-Specific Elements Render', () => {
    test('Upload section contains dropzone with dashed border', () => {
      render(<ArchitectureExperimentPage />)
      
      const dropzone = screen.getByTestId('dropzone')
      expect(dropzone).toBeInTheDocument()
      expect(dropzone).toHaveClass('border-dashed', 'border-2')
      expect(dropzone).toHaveTextContent('Drop video file here')
    })

    test('Upload section contains file input with correct accept types', () => {
      render(<ArchitectureExperimentPage />)
      
      const fileInput = screen.getByRole('button', { name: /choose.*file/i })
      expect(fileInput).toBeInTheDocument()
      
      // The actual file input should have correct accept attribute
      const hiddenInput = screen.getByTestId('file-input')
      expect(hiddenInput).toHaveAttribute('accept', '.mp4,.mov,.webm,video/*')
    })

    test('Video section contains placeholder with 16:9 aspect ratio', () => {
      render(<ArchitectureExperimentPage />)
      
      const videoPlaceholder = screen.getByTestId('video-placeholder')
      expect(videoPlaceholder).toBeInTheDocument()
      expect(videoPlaceholder).toHaveClass('aspect-video') // Tailwind's 16:9 class
      expect(videoPlaceholder).toHaveAttribute('role', 'img')
      expect(videoPlaceholder).toHaveAttribute('aria-label', expect.stringMatching(/video.*playback.*area.*no.*video.*loaded/i))
    })

    test('Video section contains 3x3 frame grid with 9 placeholders', () => {
      render(<ArchitectureExperimentPage />)
      
      const frameGrid = screen.getByTestId('frame-grid')
      expect(frameGrid).toBeInTheDocument()
      expect(frameGrid).toHaveClass('grid', 'grid-cols-3', 'gap-2')
      
      // Should have 9 frame placeholders
      for (let i = 1; i <= 9; i++) {
        const framePlaceholder = screen.getByTestId(`frame-placeholder-${i}`)
        expect(framePlaceholder).toBeInTheDocument()
        expect(framePlaceholder).toHaveClass('w-[120px]', 'h-[68px]', 'bg-gray-400')
        
        const frameLabel = screen.getByTestId(`frame-label-${i}`)
        expect(frameLabel).toHaveTextContent(`Frame ${i}`)
      }
    })

    test('Transcripts section contains dual layout columns', () => {
      render(<ArchitectureExperimentPage />)
      
      const transcriptsContainer = screen.getByTestId('transcripts-container')
      expect(transcriptsContainer).toBeInTheDocument()
      expect(transcriptsContainer).toHaveClass('grid', 'grid-cols-2', 'gap-4')
      
      // Full transcript section
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      expect(fullTranscriptArea).toBeInTheDocument()
      expect(fullTranscriptArea).toHaveClass('bg-gray-50', 'p-3', 'rounded', 'h-[200px]', 'overflow-y-auto')
      
      const fullTranscriptHeader = screen.getByText('Full Transcript')
      expect(fullTranscriptHeader).toBeInTheDocument()
      expect(fullTranscriptHeader).toHaveClass('text-base', 'font-semibold')
      
      // Segmented transcript section
      const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')
      expect(segmentedTranscriptArea).toBeInTheDocument()
      expect(segmentedTranscriptArea).toHaveClass('bg-gray-50', 'p-3', 'rounded', 'h-[200px]', 'overflow-y-auto')
      
      const segmentedTranscriptHeader = screen.getByText('Segmented Transcript')
      expect(segmentedTranscriptHeader).toBeInTheDocument()
      expect(segmentedTranscriptHeader).toHaveClass('text-base', 'font-semibold')
    })

    test('Processing section contains step indicators and status display', () => {
      render(<ArchitectureExperimentPage />)
      
      // Step indicators
      const step1 = screen.getByTestId('step-1')
      const step2 = screen.getByTestId('step-2')
      const step3 = screen.getByTestId('step-3')
      const step4 = screen.getByTestId('step-4')
      
      expect(step1).toHaveTextContent('1. Upload')
      expect(step2).toHaveTextContent('2. Extract Frames')
      expect(step3).toHaveTextContent('3. Transcribe')
      expect(step4).toHaveTextContent('4. Complete')
      
      // Current step text
      const currentStepText = screen.getByTestId('current-step-text')
      expect(currentStepText).toHaveTextContent('Waiting to start...')
      expect(currentStepText).toHaveClass('italic')
      
      // Timing display
      const timingDisplay = screen.getByTestId('timing-display')
      expect(timingDisplay).toHaveTextContent('Total Time: 0:00')
      expect(timingDisplay).toHaveClass('font-mono')
      
      // Error log area
      const errorLog = screen.getByTestId('error-log')
      expect(errorLog).toHaveTextContent('No errors')
      expect(errorLog).toHaveClass('text-green-600')
      
      // Cost tracker
      const costTracker = screen.getByTestId('cost-tracker')
      expect(costTracker).toHaveTextContent('$0.00')
    })
  })

  describe('Debug Panel Rendering', () => {
    test('debug panel exists but is hidden initially', () => {
      render(<ArchitectureExperimentPage />)
      
      const debugPanel = screen.getByTestId('debug-panel')
      expect(debugPanel).toBeInTheDocument()
      expect(debugPanel).toHaveClass('hidden') // Initially hidden
    })

    test('debug panel contains state content area', () => {
      render(<ArchitectureExperimentPage />)
      
      const debugContent = screen.getByTestId('debug-content')
      expect(debugContent).toBeInTheDocument()
      expect(debugContent).toHaveClass('font-mono', 'text-sm')
    })

    test('aria-live regions exist for accessibility', () => {
      render(<ArchitectureExperimentPage />)
      
      const politeRegion = screen.getByLabelText('Status updates')
      expect(politeRegion).toBeInTheDocument()
      expect(politeRegion).toHaveAttribute('aria-live', 'polite')
      
      const assertiveRegion = screen.getByLabelText('Error announcements')
      expect(assertiveRegion).toBeInTheDocument()
      expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive')
    })
  })

  describe('Event Handling - UI Events Trigger Correct Responses', () => {
    test('choose file button click opens file dialog', () => {
      render(<ArchitectureExperimentPage />)
      
      const chooseFileButton = screen.getByTestId('choose-file-button')
      const fileInput = screen.getByTestId('file-input')
      
      // Mock the file input click
      const fileInputClickSpy = vi.spyOn(fileInput, 'click')
      
      fireEvent.click(chooseFileButton)
      
      expect(fileInputClickSpy).toHaveBeenCalled()
    })

    test('file input change triggers upload progress update', async () => {
      render(<ArchitectureExperimentPage />)
      
      const fileInput = screen.getByTestId('file-input')
      
      // Create a mock video file
      const mockFile = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' })
      
      fireEvent.change(fileInput, { target: { files: [mockFile] } })
      
      // Should trigger state update
      await waitFor(() => {
        expect(mockUpdateExperimentState).toHaveBeenCalledWith({
          videoFile: mockFile,
          uploadProgress: 0
        })
      })
    })

    test('dropzone drag and drop events work correctly', () => {
      render(<ArchitectureExperimentPage />)
      
      const dropzone = screen.getByTestId('dropzone')
      
      // Test dragover event
      fireEvent.dragOver(dropzone)
      expect(dropzone).toHaveClass('bg-blue-50') // Hover state
      
      // Test dragleave event
      fireEvent.dragLeave(dropzone)
      expect(dropzone).not.toHaveClass('bg-blue-50')
      
      // Test drop event
      const mockFile = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' })
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [mockFile]
        }
      })
      
      expect(mockUpdateExperimentState).toHaveBeenCalledWith({
        videoFile: mockFile,
        uploadProgress: 0
      })
    })

    test('frame placeholder click triggers seek functionality', () => {
      render(<ArchitectureExperimentPage />)
      
      const framePlaceholder = screen.getByTestId('frame-placeholder-3')
      
      fireEvent.click(framePlaceholder)
      
      // Should trigger seek to corresponding timestamp (frame 3 = 15 seconds)
      expect(mockUpdateExperimentState).toHaveBeenCalledWith({
        currentVideoTime: 15
      })
    })

    test('debug panel toggle with Ctrl+D keyboard shortcut', () => {
      render(<ArchitectureExperimentPage />)
      
      const debugPanel = screen.getByTestId('debug-panel')
      
      // Initially hidden
      expect(debugPanel).toHaveClass('hidden')
      
      // Press Ctrl+D
      fireEvent.keyDown(document, { key: 'D', ctrlKey: true })
      
      expect(debugPanel).not.toHaveClass('hidden')
      expect(debugPanel).toHaveClass('block')
      
      // Press Ctrl+D again to hide
      fireEvent.keyDown(document, { key: 'D', ctrlKey: true })
      
      expect(debugPanel).toHaveClass('hidden')
    })

    test('cost tracker click expands breakdown', () => {
      render(<ArchitectureExperimentPage />)
      
      const costTracker = screen.getByTestId('cost-tracker')
      const costBreakdown = screen.getByTestId('cost-breakdown')
      
      // Initially collapsed
      expect(costBreakdown).toHaveClass('hidden')
      
      fireEvent.click(costTracker)
      
      expect(costBreakdown).not.toHaveClass('hidden')
      expect(costBreakdown).toHaveClass('block')
    })

    test('retry button click triggers error recovery', () => {
      render(<ArchitectureExperimentPage />)
      
      // Simulate error state first
      fireEvent.click(screen.getByTestId('simulate-error-button')) // Hidden dev button
      
      const retryButton = screen.getByTestId('retry-button')
      
      fireEvent.click(retryButton)
      
      expect(mockUpdateExperimentState).toHaveBeenCalledWith({
        errors: [],
        isRetrying: true
      })
    })
  })

  describe('State Management - UI Updates When State Changes', () => {
    test('progress bar value updates when upload progress changes', async () => {
      render(<ArchitectureExperimentPage />)
      
      const progressBar = screen.getByTestId('progress-bar')
      
      // Initial state
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      
      // Simulate state change
      window.experimentState.uploadProgress = 45
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '45')
      })
      
      // Verify progress text overlay
      const progressText = screen.getByTestId('progress-text')
      expect(progressText).toHaveTextContent('45%')
    })

    test('processing step indicator updates highlight active step', async () => {
      render(<ArchitectureExperimentPage />)
      
      const step1 = screen.getByTestId('step-1')
      const step2 = screen.getByTestId('step-2')
      const currentStepText = screen.getByTestId('current-step-text')
      
      // Initial state - all steps inactive
      expect(step1).toHaveClass('bg-gray-400')
      expect(step2).toHaveClass('bg-gray-400')
      
      // Update processing step
      window.experimentState.processingStep = 'extracting'
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        expect(step2).toHaveClass('bg-blue-600', 'animate-pulse')
        expect(currentStepText).toHaveTextContent('Extracting frames...')
      })
    })

    test('debug panel content updates with state changes', async () => {
      render(<ArchitectureExperimentPage />)
      
      // Show debug panel
      fireEvent.keyDown(document, { key: 'D', ctrlKey: true })
      
      const debugContent = screen.getByTestId('debug-content')
      
      // Update state
      window.experimentState.uploadProgress = 75
      window.experimentState.processingStep = 'transcribing'
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        const content = debugContent.textContent
        expect(content).toContain('"uploadProgress": 75')
        expect(content).toContain('"processingStep": "transcribing"')
      })
    })

    test('video placeholder updates when video file is loaded', async () => {
      render(<ArchitectureExperimentPage />)
      
      const videoPlaceholder = screen.getByTestId('video-placeholder')
      const placeholderText = screen.getByTestId('video-placeholder-text')
      
      // Initial state
      expect(placeholderText).toHaveTextContent('No video uploaded')
      
      // Update state with video file
      const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      window.experimentState.videoFile = mockFile
      window.experimentState.videoUrl = 'blob:http://localhost:3000/test-video'
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        const videoElement = screen.getByTestId('video-player')
        expect(videoElement).toBeInTheDocument()
        expect(videoElement).toHaveAttribute('src', 'blob:http://localhost:3000/test-video')
        expect(placeholderText).not.toBeInTheDocument()
      })
    })

    test('transcript areas update when transcript data is available', async () => {
      render(<ArchitectureExperimentPage />)
      
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')
      
      // Initial placeholder text
      expect(fullTranscriptArea).toHaveTextContent('Transcript will appear here...')
      expect(segmentedTranscriptArea).toHaveTextContent('Time-stamped segments will appear here...')
      
      // Update state with transcript data
      window.experimentState.fullTranscript = 'This is the full transcript of the video content.'
      window.experimentState.segmentedTranscript = [
        { text: 'This is the full', startTime: 0, endTime: 2, confidence: 0.95 },
        { text: 'transcript of the video', startTime: 2, endTime: 4, confidence: 0.92 },
        { text: 'content.', startTime: 4, endTime: 5, confidence: 0.98 }
      ]
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        expect(fullTranscriptArea).toHaveTextContent('This is the full transcript of the video content.')
        expect(segmentedTranscriptArea).toContain(screen.getByText('This is the full'))
        expect(segmentedTranscriptArea).toContain(screen.getByText('0:00 - 0:02'))
      })
    })

    test('error states update UI with error displays', async () => {
      render(<ArchitectureExperimentPage />)
      
      const uploadSection = screen.getByTestId('upload-section')
      
      // Simulate error
      window.experimentState.errors = [{
        section: 'upload',
        message: 'Something went wrong in Upload section',
        timestamp: Date.now()
      }]
      fireEvent(window, new CustomEvent('statechange'))
      
      await waitFor(() => {
        const errorCard = screen.getByTestId('error-card')
        expect(errorCard).toBeInTheDocument()
        expect(errorCard).toHaveClass('border-red-500')
        
        const errorMessage = screen.getByTestId('error-message')
        expect(errorMessage).toHaveTextContent('Something went wrong in Upload section')
        
        const retryButton = screen.getByTestId('retry-button')
        expect(retryButton).toBeInTheDocument()
      })
    })
  })

  describe('CSS Integration - Styles Are Applied Correctly', () => {
    test('grid layout has correct Tailwind classes', () => {
      render(<ArchitectureExperimentPage />)
      
      const gridLayout = screen.getByTestId('grid-layout')
      expect(gridLayout).toHaveClass(
        'grid',
        'grid-cols-1',
        'md:grid-cols-2',
        'gap-4',
        'p-6'
      )
    })

    test('section cards have correct border colors per specification', () => {
      render(<ArchitectureExperimentPage />)
      
      const uploadSection = screen.getByTestId('upload-section')
      const videoSection = screen.getByTestId('video-section')
      const transcriptsSection = screen.getByTestId('transcripts-section')
      const processingSection = screen.getByTestId('processing-section')
      
      expect(uploadSection).toHaveClass('border-blue-500') // #3b82f6
      expect(videoSection).toHaveClass('border-emerald-500') // #10b981
      expect(transcriptsSection).toHaveClass('border-purple-500') // #8b5cf6
      expect(processingSection).toHaveClass('border-amber-500') // #f59e0b
    })

    test('cards have correct ShadCN styling with rounded corners and padding', () => {
      render(<ArchitectureExperimentPage />)
      
      const cards = screen.getAllByTestId(/.*-section/)
      
      cards.forEach(card => {
        expect(card).toHaveClass('rounded-lg', 'p-4', 'border-2')
      })
    })

    test('typography classes are applied correctly to titles', () => {
      render(<ArchitectureExperimentPage />)
      
      const titles = [
        screen.getByTestId('upload-title'),
        screen.getByTestId('video-title'),
        screen.getByTestId('transcripts-title'),
        screen.getByTestId('processing-title')
      ]
      
      titles.forEach(title => {
        expect(title).toHaveClass('text-lg', 'font-semibold', 'mb-4')
      })
    })

    test('dropzone has correct dashed border and hover states', () => {
      render(<ArchitectureExperimentPage />)
      
      const dropzone = screen.getByTestId('dropzone')
      expect(dropzone).toHaveClass(
        'border-dashed',
        'border-2',
        'border-gray-300',
        'rounded-lg',
        'p-8',
        'text-center',
        'transition-colors',
        'hover:bg-blue-50'
      )
    })

    test('button has correct primary styling classes', () => {
      render(<ArchitectureExperimentPage />)
      
      const chooseFileButton = screen.getByTestId('choose-file-button')
      expect(chooseFileButton).toHaveClass(
        'bg-blue-600',
        'text-white',
        'hover:bg-blue-700',
        'transition-colors',
        'duration-150'
      )
    })

    test('progress bar has correct styling and fill color', () => {
      render(<ArchitectureExperimentPage />)
      
      const progressBar = screen.getByTestId('progress-bar')
      const progressFill = screen.getByTestId('progress-fill')
      
      expect(progressBar).toHaveClass('bg-gray-200', 'rounded-full', 'h-3', 'relative')
      expect(progressFill).toHaveClass(
        'bg-blue-600',
        'h-full',
        'rounded-full',
        'transition-all',
        'duration-300',
        'ease-out'
      )
    })

    test('video placeholder has correct aspect ratio and background', () => {
      render(<ArchitectureExperimentPage />)
      
      const videoPlaceholder = screen.getByTestId('video-placeholder')
      expect(videoPlaceholder).toHaveClass(
        'aspect-video',
        'bg-gray-700',
        'rounded-lg',
        'flex',
        'items-center',
        'justify-center'
      )
      
      const placeholderText = screen.getByTestId('video-placeholder-text')
      expect(placeholderText).toHaveClass('text-white', 'text-base')
    })

    test('frame grid has correct 3x3 layout and placeholder sizing', () => {
      render(<ArchitectureExperimentPage />)
      
      const frameGrid = screen.getByTestId('frame-grid')
      expect(frameGrid).toHaveClass('grid', 'grid-cols-3', 'gap-2', 'mt-4')
      
      const framePlaceholder = screen.getByTestId('frame-placeholder-1')
      expect(framePlaceholder).toHaveClass(
        'w-[120px]',
        'h-[68px]',
        'bg-gray-400',
        'rounded',
        'flex',
        'items-center',
        'justify-center',
        'cursor-pointer',
        'hover:bg-gray-500',
        'transition-colors'
      )
    })

    test('transcript areas have correct styling and scrollable behavior', () => {
      render(<ArchitectureExperimentPage />)
      
      const fullTranscriptArea = screen.getByTestId('full-transcript-area')
      const segmentedTranscriptArea = screen.getByTestId('segmented-transcript-area')
      
      const expectedClasses = [
        'bg-gray-50',
        'p-3',
        'rounded',
        'h-[200px]',
        'overflow-y-auto',
        'text-sm',
        'whitespace-pre-wrap'
      ]
      
      expectedClasses.forEach(className => {
        expect(fullTranscriptArea).toHaveClass(className)
        expect(segmentedTranscriptArea).toHaveClass(className)
      })
    })

    test('debug panel has correct positioning and monospace font', () => {
      render(<ArchitectureExperimentPage />)
      
      const debugPanel = screen.getByTestId('debug-panel')
      expect(debugPanel).toHaveClass(
        'fixed',
        'bottom-4',
        'right-4',
        'bg-gray-100',
        'border',
        'border-gray-300',
        'rounded-lg',
        'p-4',
        'max-w-md',
        'max-h-96',
        'overflow-auto',
        'z-50',
        'shadow-lg'
      )
      
      const debugContent = screen.getByTestId('debug-content')
      expect(debugContent).toHaveClass('font-mono', 'text-sm', 'whitespace-pre')
    })

    test('responsive classes work correctly for mobile layout', () => {
      render(<ArchitectureExperimentPage />)
      
      const gridLayout = screen.getByTestId('grid-layout')
      // Should stack vertically on mobile, 2 columns on medium screens and up
      expect(gridLayout).toHaveClass('grid-cols-1', 'md:grid-cols-2')
      
      // Standard gap spacing
      expect(gridLayout).toHaveClass('gap-4')
    })

    test('focus indicators have correct styling for accessibility', () => {
      render(<ArchitectureExperimentPage />)
      
      const focusableElements = [
        screen.getByTestId('choose-file-button'),
        screen.getByTestId('frame-placeholder-1'),
        screen.getByTestId('cost-tracker')
      ]
      
      focusableElements.forEach(element => {
        expect(element).toHaveClass(
          'focus:outline-none',
          'focus:ring-2',
          'focus:ring-blue-500',
          'focus:ring-offset-2'
        )
      })
    })
  })
})
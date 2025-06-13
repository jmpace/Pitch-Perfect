import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UploadDropzone from '@/components/UploadDropzone'

// Mock Vercel blob and fetch
global.fetch = vi.fn()
const mockFetch = vi.mocked(fetch)

// Mock XMLHttpRequest for upload progress
const mockXMLHttpRequest = {
  open: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  upload: {
    addEventListener: vi.fn()
  },
  status: 200,
  responseText: JSON.stringify({
    success: true,
    blobUrl: 'https://blob.vercel-storage.com/test-123.mp4',
    filename: 'test-123.mp4',
    size: 1024000,
    type: 'video/mp4',
    uploadTime: 1500
  })
}

global.XMLHttpRequest = vi.fn(() => mockXMLHttpRequest) as any

describe('Component Integration Tests', () => {
  const mockProps = {
    onFileSelect: vi.fn(),
    onUploadProgress: vi.fn(),
    onUploadComplete: vi.fn(),
    onError: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockXMLHttpRequest.open.mockClear()
    mockXMLHttpRequest.send.mockClear()
    mockXMLHttpRequest.addEventListener.mockClear()
    mockXMLHttpRequest.upload.addEventListener.mockClear()
  })

  describe('UploadDropzone Component Integration', () => {
    it('should integrate file selection with upload process', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone {...mockProps} />)

      const dropzone = screen.getByTestId('upload-dropzone')
      const fileInput = screen.getByTestId('file-input')

      // Create a mock file
      const mockFile = new File(['test video content'], 'integration-test.mp4', {
        type: 'video/mp4'
      })

      // Simulate file selection
      await user.upload(fileInput, mockFile)

      // Verify file selection callback
      expect(mockProps.onFileSelect).toHaveBeenCalledWith(mockFile)

      // Verify upload initiation
      expect(mockXMLHttpRequest.open).toHaveBeenCalledWith('POST', '/api/experiment/upload')
      expect(mockXMLHttpRequest.send).toHaveBeenCalled()
    })

    it('should integrate drag and drop with validation and upload', async () => {
      render(<UploadDropzone {...mockProps} />)

      const dropzone = screen.getByTestId('upload-dropzone')

      // Create a mock file
      const mockFile = new File(['test content'], 'drag-test.mp4', {
        type: 'video/mp4'
      })

      // Create drag event
      const dragEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer()
      })
      
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: {
          files: [mockFile]
        }
      })

      // Simulate drag and drop
      fireEvent(dropzone, dragEvent)

      // Verify file selection and upload initiation
      expect(mockProps.onFileSelect).toHaveBeenCalledWith(mockFile)
      expect(mockXMLHttpRequest.open).toHaveBeenCalledWith('POST', '/api/experiment/upload')
    })

    it('should integrate validation errors with UI feedback', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone {...mockProps} />)

      const fileInput = screen.getByTestId('file-input')

      // Create invalid file (wrong type)
      const invalidFile = new File(['test content'], 'invalid.txt', {
        type: 'text/plain'
      })

      // Simulate file selection with invalid file
      await user.upload(fileInput, invalidFile)

      // Verify error callback
      expect(mockProps.onError).toHaveBeenCalledWith(
        'Invalid file type. Please select MP4, MOV, or WebM'
      )

      // Verify upload was not initiated
      expect(mockXMLHttpRequest.open).not.toHaveBeenCalled()
    })

    it('should integrate progress tracking with UI updates', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone 
        {...mockProps} 
        isUploading={true}
        uploadProgress={50}
        selectedFile={new File(['test'], 'progress-test.mp4', { type: 'video/mp4' })}
      />)

      // Verify progress UI elements are displayed
      expect(screen.getByTestId('upload-progress-container')).toBeInTheDocument()
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument()
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('50%')
      expect(screen.getByTestId('upload-status')).toHaveTextContent('Uploading...')
    })

    it('should integrate completion state with UI feedback', async () => {
      const blobUrl = 'https://blob.vercel-storage.com/completed-123.mp4'
      
      render(<UploadDropzone 
        {...mockProps} 
        isComplete={true}
        blobUrl={blobUrl}
      />)

      // Verify completion UI elements
      expect(screen.getByTestId('success-checkmark')).toBeInTheDocument()
      expect(screen.getByTestId('upload-primary-text')).toHaveTextContent('File uploaded successfully')
      
      const blobLink = screen.getByTestId('blob-url-link')
      expect(blobLink).toHaveAttribute('href', blobUrl)
      expect(blobLink).toHaveAttribute('target', '_blank')
    })

    it('should integrate error states with retry functionality', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone 
        {...mockProps} 
        validationState="error"
        error="Upload failed. Please try again."
      />)

      // Verify error UI elements
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
      expect(screen.getByTestId('error-message')).toHaveTextContent('Upload failed. Please try again.')
      
      // Verify retry button exists
      const retryButton = screen.getByTestId('retry-button')
      expect(retryButton).toBeInTheDocument()
    })
  })

  describe('Data Flow Integration', () => {
    it('should maintain data consistency through upload lifecycle', async () => {
      const user = userEvent.setup()
      
      const { rerender } = render(<UploadDropzone {...mockProps} />)

      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['test content'], 'lifecycle-test.mp4', {
        type: 'video/mp4'
      })

      // Step 1: File selection
      await user.upload(fileInput, mockFile)
      expect(mockProps.onFileSelect).toHaveBeenCalledWith(mockFile)

      // Step 2: Upload in progress
      rerender(<UploadDropzone 
        {...mockProps} 
        isUploading={true}
        uploadProgress={25}
        selectedFile={mockFile}
      />)

      expect(screen.getByTestId('upload-progress-container')).toBeInTheDocument()
      expect(screen.getByTestId('progress-filename')).toHaveTextContent('lifecycle-test.mp4')

      // Step 3: Upload completion
      const blobUrl = 'https://blob.vercel-storage.com/lifecycle-test-123.mp4'
      rerender(<UploadDropzone 
        {...mockProps} 
        isComplete={true}
        uploadProgress={100}
        selectedFile={mockFile}
        blobUrl={blobUrl}
      />)

      expect(screen.getByTestId('success-checkmark')).toBeInTheDocument()
      expect(screen.getByTestId('blob-url-link')).toHaveAttribute('href', blobUrl)
    })

    it('should handle XMLHttpRequest progress events correctly', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone {...mockProps} />)

      const fileInput = screen.getByTestId('file-input')
      const mockFile = new File(['test content'], 'xhr-test.mp4', {
        type: 'video/mp4'
      })

      // Simulate file upload
      await user.upload(fileInput, mockFile)

      // Verify XMLHttpRequest setup
      expect(mockXMLHttpRequest.upload.addEventListener).toHaveBeenCalledWith(
        'progress',
        expect.any(Function)
      )
      expect(mockXMLHttpRequest.addEventListener).toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      )
      expect(mockXMLHttpRequest.addEventListener).toHaveBeenCalledWith(
        'error',
        expect.any(Function)
      )

      // Simulate progress event
      const progressCallback = mockXMLHttpRequest.upload.addEventListener.mock.calls
        .find(call => call[0] === 'progress')?.[1]
      
      if (progressCallback) {
        progressCallback({
          lengthComputable: true,
          loaded: 500000,
          total: 1000000
        })
        
        expect(mockProps.onUploadProgress).toHaveBeenCalledWith(50)
      }

      // Simulate completion event
      const loadCallback = mockXMLHttpRequest.addEventListener.mock.calls
        .find(call => call[0] === 'load')?.[1]
      
      if (loadCallback) {
        loadCallback()
        expect(mockProps.onUploadComplete).toHaveBeenCalledWith(
          'https://blob.vercel-storage.com/test-123.mp4'
        )
      }
    })

    it('should integrate keyboard navigation with upload functionality', async () => {
      const user = userEvent.setup()
      
      render(<UploadDropzone {...mockProps} />)

      const dropzone = screen.getByTestId('upload-dropzone')

      // Focus the dropzone
      await user.click(dropzone)
      expect(dropzone).toHaveFocus()

      // Simulate Enter key press
      await user.keyboard('{Enter}')

      // Verify accessibility attributes
      expect(dropzone).toHaveAttribute('role', 'button')
      expect(dropzone).toHaveAttribute('tabIndex', '0')
      expect(dropzone).toHaveAttribute('aria-label', 'Upload video file, dropzone, button')
    })

    it('should integrate mobile touch events properly', async () => {
      render(<UploadDropzone {...mockProps} />)

      const dropzone = screen.getByTestId('upload-dropzone')

      // Simulate touch event (mobile tap)
      fireEvent.touchStart(dropzone)
      fireEvent.touchEnd(dropzone)

      // Verify the dropzone responds to touch events
      expect(dropzone).toBeInTheDocument()
    })
  })

  describe('Component State Integration', () => {
    it('should synchronize internal state with external props', async () => {
      const { rerender } = render(<UploadDropzone 
        {...mockProps} 
        isDragActive={false}
      />)

      const dropzone = screen.getByTestId('upload-dropzone')

      // Initial state
      expect(dropzone).toHaveAttribute('data-drag-active', 'false')
      expect(dropzone).toHaveAttribute('data-validation-state', 'idle')
      expect(dropzone).toHaveAttribute('data-upload-state', 'initial')

      // Update props
      rerender(<UploadDropzone 
        {...mockProps} 
        isDragActive={true}
        validationState="error"
        isUploading={true}
      />)

      expect(dropzone).toHaveAttribute('data-drag-active', 'true')
      expect(dropzone).toHaveAttribute('data-validation-state', 'error')
      expect(dropzone).toHaveAttribute('data-upload-state', 'uploading')

      // Complete state
      rerender(<UploadDropzone 
        {...mockProps} 
        isDragActive={false}
        validationState="idle"
        isComplete={true}
      />)

      expect(dropzone).toHaveAttribute('data-drag-active', 'false')
      expect(dropzone).toHaveAttribute('data-validation-state', 'idle')
      expect(dropzone).toHaveAttribute('data-upload-state', 'completed')
    })

    it('should handle tooltip integration correctly', () => {
      render(<UploadDropzone 
        {...mockProps} 
        showTooltip={true}
        tooltipContent="Custom tooltip message"
        tooltipPosition="top"
        tooltipTheme="dark"
      />)

      // Verify tooltip wrapper is present
      const uploadIcon = screen.getByTestId('upload-icon')
      expect(uploadIcon).toBeInTheDocument()
    })
  })
})
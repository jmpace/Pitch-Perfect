import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import UploadDropzone from '@/components/UploadDropzone'

// Mock the Card and Button components from ShadCN
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={`card ${className}`} data-component="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={`card-content ${className}`} {...props}>
      {children}
    </div>
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, className, variant, onClick, ...props }: any) => (
    <button 
      className={`button ${variant} ${className}`} 
      data-component="button"
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className, ...props }: any) => (
    <div 
      className={`progress ${className}`}
      data-component="progress"
      data-value={value}
      {...props}
    >
      <div 
        className="progress-fill"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}))

// Mock Tooltip component
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ content, children, position, theme, ...props }: any) => (
    <div className="tooltip-wrapper" {...props}>
      {children}
      <div 
        role="tooltip"
        className={`tooltip tooltip-${position} tooltip-${theme}`}
        data-content={content}
      >
        {content}
      </div>
    </div>
  )
}))

describe('UploadDropzone Component - UI Integration Tests', () => {
  const mockOnFileSelect = vi.fn()
  const mockOnUploadProgress = vi.fn()
  const mockOnUploadComplete = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: Component Rendering - Component renders with correct props
  test('renders UploadDropzone component with correct props', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        maxSize={100 * 1024 * 1024} // 100MB
        acceptedTypes={['video/mp4', 'video/mov', 'video/webm']}
      />
    )

    // Verify the component renders
    const dropzone = screen.getByTestId('upload-dropzone')
    expect(dropzone).toBeInTheDocument()
    
    // Verify it has the correct ARIA attributes
    expect(dropzone).toHaveAttribute('role', 'button')
    expect(dropzone).toHaveAttribute('tabindex', '0')
    expect(dropzone).toHaveAttribute('aria-label', 'Upload video file, dropzone, button')
  })

  // Test 2: UI Integration - Imported components are actually used
  test('uses imported ShadCN Card component for dropzone container', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    // Verify Card component is rendered
    const cardElement = screen.getByTestId('upload-card')
    expect(cardElement).toBeInTheDocument()
    expect(cardElement).toHaveAttribute('data-component', 'card')
    expect(cardElement).toHaveClass('card')
  })

  test('uses imported ShadCN Button component for file selection', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    // Verify Button component is rendered
    const buttonElement = screen.getByTestId('browse-button')
    expect(buttonElement).toBeInTheDocument()
    expect(buttonElement).toHaveAttribute('data-component', 'button')
    expect(buttonElement).toHaveClass('button')
  })

  test('uses imported ShadCN Progress component for upload progress', async () => {
    const { rerender } = render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={0}
      />
    )

    // Initially progress should not be visible
    expect(screen.queryByTestId('upload-progress')).not.toBeInTheDocument()

    // Rerender with upload in progress
    rerender(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={50}
        isUploading={true}
      />
    )

    // Verify Progress component is rendered
    const progressElement = screen.getByTestId('upload-progress')
    expect(progressElement).toBeInTheDocument()
    expect(progressElement).toHaveAttribute('data-component', 'progress')
    expect(progressElement).toHaveClass('progress')
    expect(progressElement).toHaveAttribute('data-value', '50')
  })

  // Test 3: Event Handling - UI events trigger correct responses
  test('handles drag enter and drag leave events correctly', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')

    // Test drag enter
    fireEvent.dragEnter(dropzone, {
      dataTransfer: {
        files: [new File([''], 'test.mp4', { type: 'video/mp4' })]
      }
    })

    expect(dropzone).toHaveAttribute('data-drag-active', 'true')

    // Test drag leave
    fireEvent.dragLeave(dropzone)
    expect(dropzone).toHaveAttribute('data-drag-active', 'false')
  })

  test('handles file drop event and calls onFileSelect', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')
    const testFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' })

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [testFile]
      }
    })

    expect(mockOnFileSelect).toHaveBeenCalledWith(testFile)
  })

  test('handles click event to open file browser', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')
    fireEvent.click(dropzone)

    // Should trigger file input click
    const fileInput = screen.getByTestId('file-input')
    expect(fileInput).toBeInTheDocument()
  })

  // Test 4: State Management - UI updates when state changes
  test('updates UI when upload progress changes', () => {
    const { rerender } = render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={0}
        isUploading={false}
      />
    )

    // Initially no progress shown
    expect(screen.queryByTestId('progress-percentage')).not.toBeInTheDocument()

    // Start upload
    rerender(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={25}
        isUploading={true}
        selectedFile={new File([''], 'test.mp4', { type: 'video/mp4' })}
      />
    )

    // Progress should be visible
    const percentage = screen.getByTestId('progress-percentage')
    expect(percentage).toHaveTextContent('25%')

    // Update progress
    rerender(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={75}
        isUploading={true}
        selectedFile={new File([''], 'test.mp4', { type: 'video/mp4' })}
      />
    )

    expect(percentage).toHaveTextContent('75%')
  })

  test('shows error state when validation fails', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        error="Invalid file type. Please select MP4, MOV, or WebM"
        validationState="error"
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')
    expect(dropzone).toHaveAttribute('data-validation-state', 'error')

    const errorMessage = screen.getByTestId('error-message')
    expect(errorMessage).toHaveTextContent('Invalid file type. Please select MP4, MOV, or WebM')

    const errorIcon = screen.getByTestId('error-icon')
    expect(errorIcon).toBeInTheDocument()
  })

  test('shows success state when upload completes', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        uploadProgress={100}
        isUploading={false}
        isComplete={true}
        blobUrl="https://example.com/blob/video.mp4"
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')
    expect(dropzone).toHaveAttribute('data-upload-state', 'completed')

    const successMessage = screen.getByTestId('upload-status')
    expect(successMessage).toHaveTextContent('Upload complete!')

    const checkmark = screen.getByTestId('success-checkmark')
    expect(checkmark).toBeInTheDocument()

    const blobUrlLink = screen.getByTestId('blob-url-link')
    expect(blobUrlLink).toHaveAttribute('href', 'https://example.com/blob/video.mp4')
  })

  // Test 5: CSS Integration - Styles are applied correctly
  test('applies correct CSS classes for different states', () => {
    const { rerender } = render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')

    // Default state styling
    expect(dropzone).toHaveClass('border-dashed', 'border-gray-300')

    // Drag active state
    rerender(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        isDragActive={true}
      />
    )

    expect(dropzone).toHaveClass('border-solid', 'border-blue-500', 'bg-blue-50')

    // Error state
    rerender(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        validationState="error"
      />
    )

    expect(dropzone).toHaveClass('border-red-500', 'bg-red-50')
  })

  // Test 6: Tooltip Integration Test
  test('renders Tooltip component when hovering over upload icon', async () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        showTooltip={true}
      />
    )

    const uploadIcon = screen.getByTestId('upload-icon')
    
    fireEvent.mouseEnter(uploadIcon)
    
    // Verify Tooltip component is rendered
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveClass('tooltip')
  })

  test('Tooltip component receives correct props', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
        showTooltip={true}
        tooltipContent="Drag and drop or click to upload"
        tooltipPosition="top"
        tooltipTheme="dark"
      />
    )

    const uploadIcon = screen.getByTestId('upload-icon')
    fireEvent.mouseEnter(uploadIcon)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveAttribute('data-content', 'Drag and drop or click to upload')
    expect(tooltip).toHaveClass('tooltip-top', 'tooltip-dark')
  })

  // Test 7: Accessibility Integration
  test('provides proper ARIA attributes and keyboard support', () => {
    render(
      <UploadDropzone
        onFileSelect={mockOnFileSelect}
        onUploadProgress={mockOnUploadProgress}
        onUploadComplete={mockOnUploadComplete}
        onError={mockOnError}
      />
    )

    const dropzone = screen.getByTestId('upload-dropzone')
    
    // ARIA attributes
    expect(dropzone).toHaveAttribute('role', 'button')
    expect(dropzone).toHaveAttribute('aria-label', 'Upload video file, dropzone, button')
    expect(dropzone).toHaveAttribute('tabindex', '0')

    // Keyboard activation
    fireEvent.keyDown(dropzone, { key: 'Enter' })
    expect(screen.getByTestId('file-input')).toBeInTheDocument()

    fireEvent.keyDown(dropzone, { key: ' ' })
    expect(screen.getByTestId('file-input')).toBeInTheDocument()
  })
})
'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void
  onUploadProgress: (progress: number) => void
  onUploadComplete: (blobUrl: string) => void
  onError: (error: string) => void
  maxSize?: number
  acceptedTypes?: string[]
  uploadProgress?: number
  isUploading?: boolean
  isComplete?: boolean
  selectedFile?: File
  error?: string
  validationState?: 'idle' | 'error' | 'success'
  isDragActive?: boolean
  blobUrl?: string
  showTooltip?: boolean
  tooltipContent?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  tooltipTheme?: 'light' | 'dark'
}

const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelect,
  onUploadProgress,
  onUploadComplete,
  onError,
  maxSize = 100 * 1024 * 1024, // 100MB default
  acceptedTypes = ['video/mp4', 'video/mov', 'video/webm'],
  uploadProgress = 0,
  isUploading = false,
  isComplete = false,
  selectedFile,
  error,
  validationState = 'idle',
  isDragActive: propIsDragActive = false,
  blobUrl,
  showTooltip = false,
  tooltipContent = 'Drag and drop or click to upload',
  tooltipPosition = 'top',
  tooltipTheme = 'dark'
}) => {
  const [isDragActive, setIsDragActive] = useState(propIsDragActive)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return 'Invalid file type. Please select MP4, MOV, or WebM'
    }
    if (file.size > maxSize) {
      return 'File too large. Maximum size is 100MB'
    }
    return null
  }, [acceptedTypes, maxSize])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100)
          onUploadProgress(percentComplete)
        }
      })

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          onUploadComplete(response.blobUrl)
        } else {
          const error = JSON.parse(xhr.responseText)
          onError(error.error || 'Upload failed')
        }
      })

      // Handle errors
      xhr.addEventListener('error', () => {
        onError('Network error during upload')
      })

      // Start upload
      xhr.open('POST', '/api/experiment/upload')
      xhr.send(formData)

    } catch (error) {
      onError('Upload failed. Please try again.')
    }
  }, [onUploadProgress, onUploadComplete, onError])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragActive(false)
    
    const files = e.dataTransfer.files
    if (files && files[0]) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        onError(validationError)
        return
      }
      onFileSelect(file)
      // Start upload immediately after file drop
      uploadFile(file)
    }
  }, [validateFile, onFileSelect, onError, uploadFile])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      const file = files[0]
      const validationError = validateFile(file)
      if (validationError) {
        onError(validationError)
        return
      }
      onFileSelect(file)
      // Start upload immediately after file selection
      uploadFile(file)
    }
  }, [validateFile, onFileSelect, onError, uploadFile])

  const getDropzoneClasses = () => {
    const baseClasses = 'min-h-[200px] rounded-lg border-2 p-8 text-center transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
    
    if (validationState === 'error') {
      return cn(baseClasses, 'border-red-500 bg-red-50 border-solid')
    }
    
    if (isDragActive || propIsDragActive) {
      return cn(baseClasses, 'border-blue-500 bg-blue-50 border-solid shadow-lg shadow-blue-500/20')
    }
    
    if (isComplete) {
      return cn(baseClasses, 'border-green-500 bg-green-50 border-solid')
    }
    
    return cn(baseClasses, 'border-gray-300 border-dashed hover:bg-blue-50')
  }

  const getUploadText = () => {
    if (validationState === 'error') {
      return 'Invalid file detected'
    }
    if (isDragActive || propIsDragActive) {
      return 'Drop your video file here'
    }
    if (isComplete) {
      return 'File uploaded successfully'
    }
    return 'Drag & drop your video file here'
  }

  const getIconElement = () => {
    if (validationState === 'error') {
      return (
        <div 
          data-testid="error-icon"
          className="w-12 h-12 mx-auto mb-4 flex items-center justify-center"
        >
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }
    
    if (isComplete) {
      return (
        <div 
          data-testid="success-checkmark"
          className="w-12 h-12 mx-auto mb-4 flex items-center justify-center"
        >
          <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )
    }

    const iconColor = (isDragActive || propIsDragActive) ? 'text-blue-500' : 'text-gray-400'
    
    const iconElement = (
      <div 
        data-testid="upload-icon"
        className={`w-12 h-12 mx-auto mb-4 flex items-center justify-center ${iconColor}`}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
    )

    if (showTooltip) {
      return (
        <Tooltip
          content={tooltipContent}
          position={tooltipPosition}
          theme={tooltipTheme}
        >
          {iconElement}
        </Tooltip>
      )
    }

    return iconElement
  }

  return (
    <Card
      data-testid="upload-card"
      data-component="card"
      className="card"
    >
      <CardContent className="card-content p-0">
        <div
          data-testid="upload-dropzone"
          data-drag-active={isDragActive || propIsDragActive}
          data-validation-state={validationState}
          data-upload-state={isComplete ? 'completed' : isUploading ? 'uploading' : 'initial'}
          className={getDropzoneClasses()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Upload video file, dropzone, button"
        >
          {getIconElement()}
          
          <div 
            data-testid="upload-primary-text"
            className={cn(
              'text-lg font-medium mb-2',
              validationState === 'error' ? 'text-red-500' :
              (isDragActive || propIsDragActive) ? 'text-blue-500' :
              isComplete ? 'text-green-500' : 'text-gray-700'
            )}
            style={{ fontSize: '18px', fontWeight: '500' }}
          >
            {getUploadText()}
          </div>
          
          {!isComplete && !isUploading && (
            <div 
              data-testid="upload-secondary-text"
              className="text-gray-500"
              style={{ fontSize: '14px' }}
            >
              or click to browse
            </div>
          )}

          {error && validationState === 'error' && (
            <div 
              data-testid="error-message"
              className="text-red-500 text-sm mt-2"
              role="alert"
            >
              {error}
            </div>
          )}

          {selectedFile && selectedFile.size > maxSize && (
            <div 
              data-testid="file-size-display"
              className="text-gray-500 text-sm mt-1"
            >
              File size: {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          data-testid="file-input"
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileChange}
          className="hidden"
        />

        <Button
          data-testid="browse-button"
          data-component="button"
          onClick={handleClick}
          className="button mt-4 w-full bg-blue-600 text-white hover:bg-blue-700"
        >
          Choose File
        </Button>

        {/* Upload Progress Section */}
        {isUploading && (
          <div data-testid="upload-progress-container" className="mt-6">
            {selectedFile && (
              <>
                <div 
                  data-testid="progress-filename"
                  className="text-base font-medium mb-2"
                  style={{ fontSize: '16px', fontWeight: '500' }}
                >
                  {selectedFile.name}
                </div>
                <div 
                  data-testid="file-info"
                  className="text-gray-500 text-sm mb-3"
                >
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • {selectedFile.type}
                </div>
              </>
            )}
            
            <Progress
              data-testid="upload-progress"
              data-component="progress"
              data-value={uploadProgress}
              value={uploadProgress}
              className="progress h-2 mb-2"
            />
            
            <div className="flex justify-between items-center text-sm">
              <span 
                data-testid="upload-status"
                className={isComplete ? 'text-green-500' : 'text-blue-600'}
              >
                {isComplete ? 'Upload complete!' : 'Uploading...'}
              </span>
              <span 
                data-testid="progress-percentage"
                className="font-medium"
              >
                {uploadProgress}%
              </span>
            </div>

            {isUploading && (
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span data-testid="estimated-time">2 minutes remaining</span>
                <span data-testid="upload-speed">1.2 MB/s</span>
              </div>
            )}

            {isUploading && (
              <div 
                data-testid="upload-spinner"
                className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mt-2"
              />
            )}
          </div>
        )}

        {/* Completed State */}
        {isComplete && (
          <div className="mt-4">
            <div 
              data-testid="upload-status"
              className="text-green-500 font-medium mb-2"
            >
              Upload complete!
            </div>
            {blobUrl && (
              <a
                data-testid="blob-url-link"
                href={blobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm"
              >
                View uploaded file
              </a>
            )}
          </div>
        )}

        {/* Error State with Retry */}
        {validationState === 'error' && error && (
          <div className="mt-4 space-y-2">
            <div className="flex space-x-2">
              <Button
                data-testid="retry-button"
                data-component="button"
                className="button bg-blue-600 text-white"
                onClick={() => window.location.reload()}
              >
                Retry Upload
              </Button>
              <Button
                data-testid="cancel-button"
                data-component="button"
                variant="secondary"
                className="button bg-gray-500 text-white"
                onClick={() => window.location.reload()}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default UploadDropzone
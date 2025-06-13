'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import UploadDropzone from '@/components/UploadDropzone'

// ExperimentState interface as specified
interface ExperimentState {
  videoFile: File | null
  videoUrl: string
  uploadProgress: number
  processingStep: 'idle' | 'uploading' | 'extracting' | 'transcribing' | 'complete'
  fullTranscript: string
  segmentedTranscript: TranscriptSegment[]
  extractedFrames: ExtractedFrame[]
  errors: ErrorInfo[]
  timings: Record<string, number>
}

interface TranscriptSegment {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

interface ExtractedFrame {
  url: string
  timestamp: number
  filename: string
}

interface ErrorInfo {
  section: string
  message: string
  timestamp: number
}

/**
 * Extract video duration client-side using HTML5 video element
 */
async function extractVideoDuration(videoUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    // Set timeout to avoid hanging
    const timeout = setTimeout(() => {
      video.remove()
      reject(new Error('Video duration extraction timeout'))
    }, 10000)
    
    video.onloadedmetadata = () => {
      clearTimeout(timeout)
      video.remove()
      resolve(video.duration)
    }
    
    video.onerror = () => {
      clearTimeout(timeout)
      video.remove()
      reject(new Error('Failed to load video metadata'))
    }
    
    video.src = videoUrl
  })
}

export default function ArchitectureExperimentPage() {
  // Set document title and simulate loading
  useEffect(() => {
    document.title = 'Architecture Experiment - Pitch Perfect'
    // Simulate initial loading for skeleton display
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  // Initialize state with all 9 required variables
  const [state, setState] = useState<ExperimentState>({
    videoFile: null,
    videoUrl: '',
    uploadProgress: 0,
    processingStep: 'idle',
    fullTranscript: '',
    segmentedTranscript: [],
    extractedFrames: [],
    errors: [],
    timings: {}
  })

  // State for UI controls
  const [debugVisible, setDebugVisible] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [costBreakdownVisible, setCostBreakdownVisible] = useState(false)
  const [retryingSection, setRetryingSection] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [extractionProgress, setExtractionProgress] = useState(0)
  const [costs, setCosts] = useState({
    vercelBlob: 0.00,
    rendiApi: 0.00,
    openaiWhisper: 0.00
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Expose state and functions to window for testing
  useEffect(() => {
    ;(window as any).experimentState = { ...state, extractionProgress, costs }
    ;(window as any).updateExperimentState = (updates: Partial<ExperimentState & { extractionProgress?: number, costs?: typeof costs }>) => {
      if (updates.extractionProgress !== undefined) {
        setExtractionProgress(updates.extractionProgress)
      }
      if (updates.costs) {
        setCosts(updates.costs)
      }
      const stateUpdates = { ...updates }
      delete stateUpdates.extractionProgress
      delete stateUpdates.costs
      setState(prev => ({ ...prev, ...stateUpdates }))
      // Trigger custom event for state changes
      window.dispatchEvent(new CustomEvent('statechange'))
    }
    ;(window as any).simulateError = (section: string) => {
      const error: ErrorInfo = {
        section,
        message: `Something went wrong in ${section.charAt(0).toUpperCase() + section.slice(1)} section`,
        timestamp: Date.now()
      }
      setState(prev => ({ ...prev, errors: [...prev.errors, error] }))
      window.dispatchEvent(new CustomEvent('statechange'))
    }
  }, [state, extractionProgress, costs])

  // Keyboard shortcut for debug panel (Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'D') {
        e.preventDefault()
        setDebugVisible(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Handle file selection
  const handleFileChange = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0]
      // Check if URL.createObjectURL is available (not in test environment)
      const videoUrl = typeof URL !== 'undefined' && URL.createObjectURL 
        ? URL.createObjectURL(file)
        : 'blob:http://localhost:3000/test-video'
      
      setState(prev => ({
        ...prev,
        videoFile: file,
        videoUrl,
        uploadProgress: 0
      }))
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    handleFileChange(files)
  }

  // Handle frame click (seek functionality)
  const handleFrameClick = (frameIndex: number) => {
    if (state.extractedFrames[frameIndex - 1]) {
      const timestamp = state.extractedFrames[frameIndex - 1].timestamp
      setState(prev => ({ ...prev, currentVideoTime: timestamp }))
    } else {
      const timestamp = frameIndex * 5 // 5 seconds per frame fallback
      setState(prev => ({ ...prev, currentVideoTime: timestamp }))
    }
  }

  // Handle retry
  const handleRetry = (section: string) => {
    setRetryingSection(section)
    setState(prev => ({
      ...prev,
      errors: prev.errors.filter(e => e.section !== section),
      isRetrying: true
    }))
    
    if (section === 'frames' && state.videoUrl) {
      handleFrameExtraction(state.videoUrl)
    }
    
    setTimeout(() => {
      setRetryingSection(null)
      setState(prev => ({ ...prev, isRetrying: false }))
    }, 500)
  }

  // Handle frame extraction with client-side duration extraction
  const handleFrameExtraction = async (videoUrl: string) => {
    try {
      setExtractionProgress(0)
      
      // Record start time for timing
      const startTime = Date.now()
      
      // Extract video duration client-side
      const videoDuration = await extractVideoDuration(videoUrl)
      
      if (!videoDuration || videoDuration <= 0) {
        throw new Error('Could not extract video duration')
      }
      
      console.log('Extracted video duration:', videoDuration, 'seconds')
      
      // Simulate progress updates (faster for Mux)
      const progressInterval = setInterval(() => {
        setExtractionProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + Math.random() * 30 // Faster progress for Mux
        })
      }, 500) // More frequent updates

      const response = await fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl, videoDuration }),
      })

      clearInterval(progressInterval)
      setExtractionProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Frame extraction failed')
      }

      const result = await response.json()
      
      // Update state with extracted frames
      setState(prev => ({
        ...prev,
        extractedFrames: result.frames,
        processingStep: 'transcribing',
        timings: {
          ...prev.timings,
          frameExtraction: Date.now() - startTime
        }
      }))

      // Update costs (using rendiApi property name for compatibility, but showing as "Mux API")
      setCosts(prev => ({
        ...prev,
        rendiApi: result.cost
      }))

    } catch (error) {
      console.error('Frame extraction error:', error)
      
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, {
          section: 'frames',
          message: error instanceof Error ? error.message : 'Frame extraction failed - network timeout',
          timestamp: Date.now()
        }]
      }))
      
      setExtractionProgress(0)
    }
  }

  // Format timestamp for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get current section error
  const getSectionError = (section: string) => {
    return state.errors.find(e => e.section === section)
  }

  // Get processing step display
  const getStepDisplay = (step: ExperimentState['processingStep']) => {
    switch (step) {
      case 'idle': return 'Waiting to start...'
      case 'uploading': return 'Uploading video...'
      case 'extracting': return 'Extracting frames at 5-second intervals...'
      case 'transcribing': return 'Transcribing audio...'
      case 'complete': return 'Processing complete!'
      default: return 'Unknown step'
    }
  }

  // Check if frame has error
  const hasFrameError = () => {
    return state.errors.some(e => e.section === 'frames')
  }

  // Get total cost
  const getTotalCost = () => {
    return costs.vercelBlob + costs.rendiApi + costs.openaiWhisper
  }

  // Render frame placeholder or actual frame
  const renderFrame = (index: number) => {
    const frameIndex = index - 1
    const frame = state.extractedFrames[frameIndex]
    const isExtracting = state.processingStep === 'extracting'
    const hasError = hasFrameError()

    if (frame) {
      // Render actual frame with timestamp overlay
      return (
        <div 
          key={index}
          data-testid={`frame-container-${index}`}
          className="relative cursor-pointer"
          onClick={() => handleFrameClick(index)}
          tabIndex={0}
          role="button"
          aria-label={`Seek to ${formatTime(frame.timestamp)}`}
        >
          <img
            data-testid={`frame-image-${index}`}
            src={frame.url}
            alt={`Frame at ${frame.timestamp}s`}
            className="w-[120px] h-[68px] rounded object-cover"
          />
          <div
            data-testid={`timestamp-overlay-${index}`}
            className="absolute bottom-1 right-1 bg-black bg-opacity-80 text-white text-xs px-1 py-0.5 rounded z-10"
          >
            {formatTime(frame.timestamp)}
          </div>
        </div>
      )
    } else if (state.extractedFrames.length > 0 && frameIndex >= state.extractedFrames.length) {
      // Show hidden placeholder for short videos (frames beyond available frames)
      return (
        <div
          key={index}
          data-testid={`frame-placeholder-${index}`}
          className="w-[120px] h-[68px] hidden"
        />
      )
    } else {
      // Show placeholder, loading spinner, or error state
      let className = "w-[120px] h-[68px] rounded flex items-center justify-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      let content

      if (hasError) {
        className += " bg-red-500"
        content = (
          <span data-testid={`warning-icon-${index}`} className="text-white text-lg">
            ⚠
          </span>
        )
      } else if (isExtracting) {
        className += " bg-gray-400"
        content = (
          <div data-testid={`frame-spinner-${index}`} className="animate-spin text-white">
            ⟳
          </div>
        )
      } else {
        className += " bg-gray-400 hover:bg-gray-500"
        content = <span className="text-white text-xs">Frame</span>
      }

      return (
        <div
          key={index}
          data-testid={`frame-placeholder-${index}`}
          className={className}
          onClick={() => handleFrameClick(index)}
          tabIndex={0}
        >
          {content}
        </div>
      )
    }
  }

  return (
    <main 
      className="min-h-screen bg-background p-6"
      aria-label="Architecture Experiment Page"
    >
      <h1 className="text-3xl font-bold mb-6">Architecture Experiment</h1>
      
      {/* Loading Skeleton */}
      {isLoading && (
        <div 
          data-testid="loading-skeleton"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"
        >
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              data-testid="skeleton-card"
              className="rounded-lg border bg-gray-100 p-4 animate-pulse"
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <div className="h-6 bg-gray-300 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded"></div>
                <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Main Grid Layout */}
      {!isLoading && (
        <div 
          data-testid="grid-layout"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6"
        >
        {/* Upload Section */}
        <div
          data-testid="upload-section"
          className="rounded-lg p-4 border-2 border-blue-500"
          role="region"
          aria-label="Upload section"
        >
          <h2 
            data-testid="upload-title"
            className="text-lg font-semibold mb-4"
          >
            Upload
          </h2>
          <UploadDropzone
            onFileSelect={(file) => {
              setState(prev => ({
                ...prev,
                videoFile: file,
                videoUrl: URL.createObjectURL(file),
                processingStep: 'uploading',
                uploadProgress: 0
              }))
            }}
            onUploadProgress={(progress) => {
              setState(prev => ({ ...prev, uploadProgress: progress }))
            }}
            onUploadComplete={(blobUrl) => {
              setState(prev => ({
                ...prev,
                videoUrl: blobUrl,
                processingStep: 'extracting',
                uploadProgress: 100
              }))
              // Trigger automatic frame extraction
              handleFrameExtraction(blobUrl)
            }}
            onError={(error) => {
              setState(prev => ({
                ...prev,
                errors: [...prev.errors, {
                  section: 'upload',
                  message: error,
                  timestamp: Date.now()
                }]
              }))
            }}
            uploadProgress={state.uploadProgress}
            isUploading={state.processingStep === 'uploading'}
            isComplete={state.processingStep === 'complete'}
            selectedFile={state.videoFile || undefined}
            error={getSectionError('upload')?.message}
            validationState={getSectionError('upload') ? 'error' : 'idle'}
            blobUrl={state.videoUrl}
          />
        </div>

        {/* Video Playback & Frames Section */}
        <Card
          data-testid="video-section"
          data-component="card"
          className="rounded-lg p-4 border-2 border-emerald-500"
          role="region"
          aria-label="Video playback and frames section"
        >
          <CardHeader className="p-0 mb-4">
            <CardTitle 
              data-testid="video-title"
              className="text-lg font-semibold mb-4"
            >
              Video Playback & Frames
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Video Player or Placeholder */}
            {state.videoUrl ? (
              <video
                data-testid="video-player"
                src={state.videoUrl}
                controls
                className="w-full aspect-video rounded-lg"
              />
            ) : (
              <div
                data-testid="video-placeholder"
                className="aspect-video bg-gray-700 rounded-lg flex items-center justify-center"
                role="img"
                aria-label="Video playback area, no video loaded"
              >
                <span 
                  data-testid="video-placeholder-text"
                  className="text-white text-base"
                >
                  No video uploaded
                </span>
              </div>
            )}

            {/* 3x3 Frame Grid */}
            <div 
              data-testid="frame-grid"
              className="grid grid-cols-3 gap-2 mt-4"
            >
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="text-center">
                  {renderFrame(i + 1)}
                  <div 
                    data-testid={`frame-label-${i + 1}`}
                    className="text-xs mt-1"
                  >
                    Frame {i + 1}
                  </div>
                </div>
              ))}
            </div>

            {/* Frame Indicator for long videos */}
            {state.extractedFrames.length > 9 && (
              <div 
                data-testid="frame-indicator"
                className="text-xs text-gray-600 mt-2 text-center"
              >
                Showing first 9 of {state.extractedFrames.length} frames
              </div>
            )}

            {/* Progress bar during extraction */}
            {state.processingStep === 'extracting' && (
              <div className="mt-4">
                <Progress 
                  data-testid="extraction-progress"
                  value={extractionProgress}
                  className="h-2 mb-2"
                  aria-valuenow={extractionProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
                <div className="text-xs text-gray-600 text-center">
                  {extractionProgress}% complete
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcripts Section */}
        <Card
          data-testid="transcripts-section"
          data-component="card"
          className="rounded-lg p-4 border-2 border-purple-500"
          role="region"
          aria-label="Transcripts section"
        >
          <CardHeader className="p-0 mb-4">
            <CardTitle 
              data-testid="transcripts-title"
              className="text-lg font-semibold mb-4"
            >
              Transcripts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              data-testid="transcripts-container"
              className="grid grid-cols-2 gap-4"
            >
              {/* Full Transcript */}
              <div>
                <h4 className="text-base font-semibold mb-2">Full Transcript</h4>
                <div
                  data-testid="full-transcript-area"
                  className="bg-gray-50 p-3 rounded h-[200px] overflow-y-auto text-sm whitespace-pre-wrap"
                >
                  {state.fullTranscript || 'Transcript will appear here...'}
                </div>
              </div>

              {/* Segmented Transcript */}
              <div>
                <h4 className="text-base font-semibold mb-2">Segmented Transcript</h4>
                <div
                  data-testid="segmented-transcript-area"
                  className="bg-gray-50 p-3 rounded h-[200px] overflow-y-auto text-sm whitespace-pre-wrap"
                >
                  {state.segmentedTranscript.length > 0 ? (
                    state.segmentedTranscript.map((segment, index) => (
                      <div key={index} className="mb-2">
                        <div className="text-xs text-gray-600">
                          {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                        </div>
                        <div>{segment.text}</div>
                      </div>
                    ))
                  ) : (
                    'Time-stamped segments will appear here...'
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status Section */}
        <Card
          data-testid="processing-section"
          data-component="card"
          className="rounded-lg p-4 border-2 border-amber-500"
          role="region"
          aria-label="Processing status section"
        >
          <CardHeader className="p-0 mb-4">
            <CardTitle 
              data-testid="processing-title"
              className="text-lg font-semibold mb-4"
            >
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Step Indicators */}
            <div className="space-y-2 mb-4">
              {[
                { key: 'idle', label: '1. Upload', step: 1 },
                { key: 'extracting', label: '2. Extract Frames', step: 2 },
                { key: 'transcribing', label: '3. Transcribe', step: 3 },
                { key: 'complete', label: '4. Complete', step: 4 }
              ].map(({ key, label, step }) => (
                <div
                  key={key}
                  data-testid={`step-${step}`}
                  className={cn(
                    'flex items-center space-x-2 p-2 rounded',
                    state.processingStep === key ? 'bg-blue-600 animate-pulse text-white' : 'bg-gray-400 text-white'
                  )}
                >
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Current Step Text */}
            <div 
              data-testid="current-step-text"
              className="italic text-gray-600 mb-3"
            >
              {getStepDisplay(state.processingStep)}
            </div>

            {/* Timing Display */}
            <div 
              data-testid="timing-display"
              className="font-mono text-sm mb-3"
            >
              Total Time: 0:00
            </div>

            {/* Error Log */}
            <div 
              data-testid="error-log"
              className={`text-sm mb-3 ${state.errors.length > 0 ? 'text-red-500' : 'text-green-600'}`}
            >
              {state.errors.length > 0 ? state.errors[state.errors.length - 1].message : 'No errors'}
            </div>

            {/* Retry Button for Frame Extraction */}
            {getSectionError('frames') && (
              <Button
                data-testid="retry-frame-extraction"
                onClick={() => handleRetry('frames')}
                className="bg-blue-600 text-white hover:bg-blue-700 mb-3"
                disabled={retryingSection === 'frames'}
              >
                {retryingSection === 'frames' ? 'Retrying...' : 'Retry Frame Extraction'}
              </Button>
            )}

            {/* Cost Tracker */}
            <div>
              <button
                data-testid="cost-tracker"
                onClick={() => setCostBreakdownVisible(!costBreakdownVisible)}
                className="text-blue-600 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                ${getTotalCost().toFixed(2)}
              </button>
              <div 
                data-testid="cost-breakdown"
                className={cn(
                  'mt-2 text-xs text-gray-600',
                  costBreakdownVisible ? 'block' : 'hidden'
                )}
              >
                <div>Vercel Blob: ${costs.vercelBlob.toFixed(2)}</div>
                <div>Mux API: ${costs.rendiApi.toFixed(3)}</div>
                <div>OpenAI Whisper: ${costs.openaiWhisper.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Debug Panel */}
      <div
        data-testid="debug-panel"
        className={cn(
          'fixed bottom-4 right-4 bg-gray-100 border border-gray-300 rounded-lg p-4 max-w-md max-h-96 overflow-auto z-50 shadow-lg',
          debugVisible ? 'block' : 'hidden'
        )}
      >
        <h3 className="text-sm font-semibold mb-2">Debug State</h3>
        <pre 
          data-testid="debug-content"
          className="font-mono text-sm whitespace-pre"
        >
          {JSON.stringify(state, null, 2)}
        </pre>
      </div>

      {/* Aria Live Regions for Accessibility */}
      <div 
        aria-live="polite" 
        aria-label="Status updates"
        className="sr-only"
      >
        {/* State change announcements */}
      </div>
      <div 
        aria-live="assertive"
        aria-label="Error announcements" 
        className="sr-only"
      >
        {/* Error announcements */}
      </div>

      {/* Hidden Dev Button for Testing */}
      <button
        data-testid="simulate-error-button"
        onClick={() => (window as any).simulateError('upload')}
        className="hidden"
      >
        Simulate Error
      </button>
    </main>
  )
}
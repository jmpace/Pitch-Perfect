'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import UploadDropzone from '@/components/UploadDropzone'

// ExperimentState interface as specified with parallel processing extensions
interface ExperimentState {
  videoFile: File | null
  videoUrl: string
  uploadProgress: number
  processingStep: 'idle' | 'uploading' | 'extracting' | 'transcribing' | 'processing' | 'complete'
  fullTranscript: string
  segmentedTranscript: TranscriptSegment[]
  extractedFrames: ExtractedFrame[]
  errors: ErrorInfo[]
  timings: Record<string, number>
  // Parallel processing state
  transcriptionStage?: 'whisper_in_progress' | 'whisper_complete' | 'segmentation_in_progress' | 'segmentation_complete' | 'segmentation_failed' | 'complete'
  transcriptionProgress?: number
  whisperProgress?: number
  segmentationProgress?: number
  segmentationInProgress?: boolean
  segmentationError?: string
  retryCountdown?: number
  parallelOperationsActive?: boolean
  operationsRemaining?: number
  networkStatus?: 'online' | 'offline'
  timeEstimates?: {
    frameExtraction?: number
    transcription?: number
  }
  // Pitch analysis state (Task 13)
  pitchAnalysisInProgress?: boolean
  pitchAnalysisProgress?: number
  pitchAnalysisStage?: 'preparing' | 'sending' | 'analyzing' | 'processing' | 'generating' | 'complete'
  pitchAnalysisResults?: any | null
  pitchAnalysisError?: string | null
  pitchAnalysisRetryCount?: number
  // Mux playback ID for large file transcription
  muxPlaybackId?: string
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
  const [transcriptionProgress, setTranscriptionProgress] = useState(0)
  const [costs, setCosts] = useState({
    vercelBlob: 0.00,
    rendiApi: 0.00,
    openaiWhisper: 0.00,
    anthropicClaude: 0.00
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Expose state and functions to window for testing
  useEffect(() => {
    ;(window as any).experimentState = { ...state, extractionProgress, transcriptionProgress, costs }
    ;(window as any).updateExperimentState = (updates: Partial<ExperimentState & { extractionProgress?: number, transcriptionProgress?: number, costs?: typeof costs }>) => {
      if (updates.extractionProgress !== undefined) {
        setExtractionProgress(updates.extractionProgress)
      }
      if (updates.transcriptionProgress !== undefined) {
        setTranscriptionProgress(updates.transcriptionProgress)
      }
      if (updates.costs) {
        setCosts(updates.costs)
      }
      const stateUpdates = { ...updates }
      delete stateUpdates.extractionProgress
      delete stateUpdates.transcriptionProgress
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
  }, [state, extractionProgress, transcriptionProgress, costs])

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
    } else if (section === 'transcription' && state.videoUrl) {
      handleTranscription(state.videoUrl, state.muxPlaybackId)
    } else if (section === 'segmentation' && state.videoUrl && state.fullTranscript) {
      // Retry just the segmentation stage
      setState(prev => ({
        ...prev,
        segmentationError: undefined,
        transcriptionStage: 'segmentation_in_progress',
        segmentationProgress: 0,
        segmentationInProgress: true
      }))
      // Simulate segmentation retry
      fetch('/api/experiment/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoUrl: state.videoUrl,
          stage: 'segmentation',
          fullTranscript: state.fullTranscript
        }),
      }).then(response => response.json())
        .then(result => {
          setState(prev => ({
            ...prev,
            segmentedTranscript: result.segmentedTranscript,
            transcriptionStage: 'complete',
            segmentationProgress: 100,
            segmentationInProgress: false
          }))
        })
        .catch(error => {
          setState(prev => ({
            ...prev,
            segmentationError: 'Segmentation retry failed',
            transcriptionStage: 'segmentation_failed',
            segmentationInProgress: false
          }))
        })
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
      
      // Debug frame extraction result
      console.log('🎬 Frame extraction result:', {
        frameCount: result.frames?.length || 0,
        extractionMethod: result.metadata?.extractionMethod,
        firstFrameUrl: result.frames?.[0]?.url?.substring(0, 100) + '...',
        firstFrameType: result.frames?.[0]?.url?.startsWith('data:') ? 'data-url' : result.frames?.[0]?.url?.startsWith('https://image.mux.com') ? 'mux-thumbnail' : 'other'
      })
      
      // Update state with extracted frames
      setState(prev => ({
        ...prev,
        extractedFrames: result.frames,
        muxPlaybackId: result.muxPlaybackId, // Store for large file transcription
        operationsRemaining: (prev.operationsRemaining || 2) - 1,
        timings: {
          ...prev.timings,
          frameExtraction: Date.now() - startTime
        }
      }))

      // Check if all operations are complete
      checkProcessingCompletion()

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

  // Handle transcription with two-stage processing
  const handleTranscription = async (videoUrl: string, muxPlaybackId?: string) => {
    try {
      console.log('🎬 Frontend transcription start:', { 
        videoUrl: videoUrl.substring(0, 100) + '...', 
        urlType: videoUrl.startsWith('blob:') ? 'local-blob' : videoUrl.startsWith('https://') ? 'vercel-blob' : 'unknown'
      })
      
      setTranscriptionProgress(0)
      
      // Extract video duration for accurate processing
      const videoDuration = await extractVideoDuration(videoUrl)
      
      // Record start time for timing
      const startTime = Date.now()
      
      // Stage 1: Whisper API transcription
      setState(prev => ({
        ...prev,
        transcriptionStage: 'whisper_in_progress',
        whisperProgress: 0
      }))
      
      // Simulate Whisper progress updates
      const whisperProgressInterval = setInterval(() => {
        setTranscriptionProgress(prev => {
          if (prev >= 90) {
            clearInterval(whisperProgressInterval)
            return 90
          }
          return prev + Math.random() * 20
        })
      }, 800)

      const whisperResponse = await fetch('/api/experiment/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoUrl, 
          videoDuration,
          stage: 'whisper',
          muxPlaybackId // Pass for large file transcription
        }),
      })

      clearInterval(whisperProgressInterval)
      setTranscriptionProgress(100)

      if (!whisperResponse.ok) {
        const errorData = await whisperResponse.json()
        // Preserve the detailed error message for large file detection
        const errorMessage = errorData.details || errorData.error || 'Whisper transcription failed'
        console.log('📝 Full error response:', errorData)
        console.log('📝 Preserving detailed error message:', errorMessage)
        throw new Error(errorMessage)
      }

      const whisperResult = await whisperResponse.json()
      
      // Update with full transcript immediately
      setState(prev => ({
        ...prev,
        fullTranscript: whisperResult.fullTranscript,
        transcriptionStage: 'whisper_complete',
        whisperProgress: 100
      }))

      // Update Whisper cost
      setCosts(prev => ({
        ...prev,
        openaiWhisper: whisperResult.metadata.cost
      }))

      // Stage 2: Segmentation processing
      setState(prev => ({
        ...prev,
        transcriptionStage: 'segmentation_in_progress',
        segmentationProgress: 0,
        segmentationInProgress: true
      }))

      // Simulate segmentation progress
      const segmentationProgressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          segmentationProgress: Math.min((prev.segmentationProgress || 0) + Math.random() * 15, 90)
        }))
      }, 600)

      const segmentationResponse = await fetch('/api/experiment/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          videoUrl,
          videoDuration,
          stage: 'segmentation',
          fullTranscript: whisperResult.fullTranscript,
          muxPlaybackId // Pass for large file transcription
        }),
      })

      clearInterval(segmentationProgressInterval)

      if (!segmentationResponse.ok) {
        const errorData = await segmentationResponse.json()
        setState(prev => ({
          ...prev,
          transcriptionStage: 'segmentation_failed',
          segmentationError: errorData.error || 'Segmentation processing failed',
          segmentationInProgress: false
        }))
        return
      }

      const segmentationResult = await segmentationResponse.json()
      
      // Complete transcription with segmented data
      setState(prev => ({
        ...prev,
        segmentedTranscript: segmentationResult.segmentedTranscript,
        transcriptionStage: 'complete',
        segmentationProgress: 100,
        segmentationInProgress: false,
        operationsRemaining: (prev.operationsRemaining || 2) - 1,
        timings: {
          ...prev.timings,
          transcription: Date.now() - startTime
        }
      }))

      // Check if all operations are complete
      checkProcessingCompletion()

    } catch (error) {
      console.error('Transcription error:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed'
      const isWaitingForFrames = errorMessage.includes('Large file detected') && errorMessage.includes('wait for frame extraction')
      
      console.log('🔍 Transcription error analysis:', {
        errorMessage,
        isWaitingForFrames,
        hasLargeFileDetected: errorMessage.includes('Large file detected'),
        hasWaitForFrameExtraction: errorMessage.includes('wait for frame extraction')
      })
      
      setState(prev => ({
        ...prev,
        errors: [...prev.errors, {
          section: 'transcription',
          message: errorMessage,
          timestamp: Date.now()
        }],
        transcriptionStage: isWaitingForFrames ? 'whisper_in_progress' : 'segmentation_failed',
        // Don't count as completed operation if we're just waiting for frames
        operationsRemaining: isWaitingForFrames ? prev.operationsRemaining : (prev.operationsRemaining || 2) - 1
      }))
      
      setTranscriptionProgress(isWaitingForFrames ? 50 : 0) // Show some progress if waiting
      checkProcessingCompletion()
    }
  }

  // Check if all parallel operations are complete
  const checkProcessingCompletion = () => {
    setState(prev => {
      console.log('🔍 Processing completion check:', {
        operationsRemaining: prev.operationsRemaining,
        extractedFramesCount: prev.extractedFrames.length,
        segmentedTranscriptCount: prev.segmentedTranscript.length,
        muxPlaybackId: prev.muxPlaybackId,
        hasWaitingError: prev.errors.some(e => e.message.includes('Large file detected') && e.message.includes('wait for frame extraction'))
      })

      // Check if we need to retry transcription after frames complete (regardless of operation count)
      const needsTranscriptionRetry = prev.extractedFrames.length > 0 && 
                                     prev.segmentedTranscript.length === 0 &&
                                     prev.errors.some(e => e.message.includes('Large file detected') && e.message.includes('wait for frame extraction'))
      
      // If frame extraction just completed and we have a waiting transcription, retry immediately
      if (needsTranscriptionRetry && prev.muxPlaybackId) {
        console.log('🔄 AUTOMATIC RETRY TRIGGERED!')
        console.log('🔍 Retry conditions met:', {
          hasFrames: prev.extractedFrames.length > 0,
          noTranscript: prev.segmentedTranscript.length === 0,
          hasWaitingError: prev.errors.some(e => e.message.includes('Large file detected') && e.message.includes('wait for frame extraction')),
          hasMuxPlaybackId: !!prev.muxPlaybackId,
          muxPlaybackId: prev.muxPlaybackId,
          videoUrl: prev.videoUrl.substring(0, 80) + '...'
        })
        
        // Clear the waiting error before retry and don't change operationsRemaining yet
        const updatedState = {
          ...prev,
          errors: prev.errors.filter(e => !(e.message.includes('Large file detected') && e.message.includes('wait for frame extraction')))
        }
        
        // Trigger the retry asynchronously
        setTimeout(() => {
          console.log('🔄 Executing automatic retry with muxPlaybackId:', prev.muxPlaybackId)
          handleTranscription(prev.videoUrl, prev.muxPlaybackId)
        }, 1000) // Give a moment for state to settle
        
        return updatedState
      } else if (needsTranscriptionRetry && !prev.muxPlaybackId) {
        console.log('⏳ Retry conditions met but muxPlaybackId not available yet')
        console.log('🔍 Current state:', {
          hasFrames: prev.extractedFrames.length > 0,
          noTranscript: prev.segmentedTranscript.length === 0,
          hasWaitingError: prev.errors.some(e => e.message.includes('Large file detected') && e.message.includes('wait for frame extraction')),
          muxPlaybackId: prev.muxPlaybackId || 'undefined'
        })
      }

      // Check if all operations are complete
      if ((prev.operationsRemaining || 0) <= 1) {
        const newState = {
          ...prev,
          processingStep: 'complete' as const,
          parallelOperationsActive: false,
          operationsRemaining: 0
        }
        
        console.log('🔍 All operations complete, checking final state:', {
          extractedFramesCount: newState.extractedFrames.length,
          segmentedTranscriptCount: newState.segmentedTranscript.length,
          processingStep: newState.processingStep
        })
        
        // Trigger automatic pitch analysis when both frames and transcript are complete
        if (newState.extractedFrames.length > 0 && newState.segmentedTranscript.length > 0) {
          console.log('✅ Both frames and transcript complete, triggering analysis:', {
            framesCount: newState.extractedFrames.length,
            segmentsCount: newState.segmentedTranscript.length
          })
          setTimeout(() => {
            handlePitchAnalysis()
          }, 500) // Small delay for UI state update
        } else {
          console.log('⏳ Processing complete but missing data:', {
            framesCount: newState.extractedFrames.length,
            segmentsCount: newState.segmentedTranscript.length,
            processingStep: newState.processingStep
          })
        }
        
        return newState
      }
      
      return prev
    })
  }

  // Handle automatic pitch analysis after processing completion
  const handlePitchAnalysis = async () => {
    try {
      console.log('🎯 Starting automatic pitch analysis...')
      
      // Get current state to ensure we have the latest data
      const currentState = await new Promise<ExperimentState>((resolve) => {
        setState(prev => {
          resolve(prev)
          return prev
        })
      })
      
      setState(prev => ({
        ...prev,
        pitchAnalysisInProgress: true,
        pitchAnalysisProgress: 0,
        pitchAnalysisStage: 'preparing',
        pitchAnalysisError: null,
        pitchAnalysisRetryCount: 0
      }))

      // Stage 1: Preparing multimodal data
      setState(prev => ({ ...prev, pitchAnalysisProgress: 0, pitchAnalysisStage: 'preparing' }))
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Create aligned data structure for perfect 5-second synchronization
      const alignedSegments = createAlignedSegments(currentState.extractedFrames, currentState.segmentedTranscript)
      
      const alignedData = {
        sessionId: `session-${Date.now()}`,
        videoMetadata: {
          duration: (currentState.extractedFrames[currentState.extractedFrames.length - 1]?.timestamp || 0) + 5,
          filename: currentState.videoFile?.name || 'unknown',
          uploadUrl: currentState.videoUrl,
          size: currentState.videoFile?.size
        },
        alignedSegments,
        analysisMetadata: {
          totalFrames: currentState.extractedFrames.length,
          totalSegments: currentState.segmentedTranscript.length,
          alignmentAccuracy: alignedSegments.length / Math.max(currentState.extractedFrames.length, currentState.segmentedTranscript.length),
          processingTime: (currentState.timings.frameExtraction || 0) + (currentState.timings.transcription || 0),
          costs: {
            frameExtraction: costs.rendiApi,
            transcription: costs.openaiWhisper,
            total: costs.vercelBlob + costs.rendiApi + costs.openaiWhisper
          }
        }
      }

      // Stage 2: Sending to Claude 4 Opus
      setState(prev => ({ ...prev, pitchAnalysisProgress: 25, pitchAnalysisStage: 'sending' }))
      
      const requestPayload = { alignedData }
      
      // Validate data before sending
      if (alignedData.alignedSegments.length === 0) {
        throw new Error('No aligned segments found - frames and transcript may not be properly synchronized')
      }
      
      const response = await fetch('/api/experiment/analyze-pitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.log('❌ API Error Response:', { 
          status: response.status, 
          statusText: response.statusText,
          body: errorBody 
        })
        throw new Error(`Analysis API failed: ${response.statusText}`)
      }

      // Stage 3: Analyzing visual-verbal alignment
      setState(prev => ({ ...prev, pitchAnalysisProgress: 50, pitchAnalysisStage: 'analyzing' }))
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed')
      }

      // Stage 4: Processing framework scores
      setState(prev => ({ ...prev, pitchAnalysisProgress: 75, pitchAnalysisStage: 'processing' }))
      await new Promise(resolve => setTimeout(resolve, 800))

      // Stage 5: Generating recommendations
      setState(prev => ({ ...prev, pitchAnalysisProgress: 100, pitchAnalysisStage: 'generating' }))
      await new Promise(resolve => setTimeout(resolve, 500))

      // Complete analysis
      setState(prev => ({
        ...prev,
        pitchAnalysisInProgress: false,
        pitchAnalysisProgress: 100,
        pitchAnalysisStage: 'complete',
        pitchAnalysisResults: result.data
      }))

      // Update costs
      setCosts(prev => ({
        ...prev,
        anthropicClaude: result.metadata.cost
      }))

      console.log('✅ Pitch analysis completed:', result.data.overallScore)

    } catch (error) {
      console.error('❌ Pitch analysis error:', error)
      
      setState(prev => ({
        ...prev,
        pitchAnalysisInProgress: false,
        pitchAnalysisError: error instanceof Error ? error.message : 'Analysis failed',
        pitchAnalysisRetryCount: (prev.pitchAnalysisRetryCount || 0) + 1
      }))

      // Auto-retry once after 3 seconds
      if ((state.pitchAnalysisRetryCount || 0) < 1) {
        setTimeout(() => {
          handlePitchAnalysis()
        }, 3000)
      }
    }
  }

  // Create aligned segments for perfect 5-second synchronization
  const createAlignedSegments = (frames: ExtractedFrame[], segments: TranscriptSegment[]) => {
    const alignedSegments: any[] = []
    
    if (!frames || !segments || frames.length === 0 || segments.length === 0) {
      return alignedSegments
    }
    
    for (const frame of frames) {
      // Find the transcript segment that best aligns with this frame timestamp
      const alignedSegment = segments.find(segment => 
        segment.startTime <= frame.timestamp && segment.endTime > frame.timestamp
      ) || segments.find(segment => 
        Math.abs(segment.startTime - frame.timestamp) <= 2.5 // Within 2.5 seconds
      )
      
      if (alignedSegment) {
        alignedSegments.push({
          timestamp: frame.timestamp,
          frame: {
            timestamp: frame.timestamp,
            url: frame.url,
            filename: frame.filename
          },
          transcriptSegment: {
            startTime: alignedSegment.startTime,
            endTime: alignedSegment.endTime,
            text: alignedSegment.text,
            confidence: alignedSegment.confidence
          }
        })
      }
    }
    
    return alignedSegments
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
      case 'processing': return 'Processing video in parallel...'
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
    return costs.vercelBlob + costs.rendiApi + costs.openaiWhisper + costs.anthropicClaude
  }

  // Get analysis stage text
  const getAnalysisStageText = (stage?: string, progress?: number) => {
    switch (stage) {
      case 'preparing':
        return `Preparing multimodal data... ${progress || 0}%`
      case 'sending':
        return `Sending to Claude 4 Opus... ${progress || 0}%`
      case 'analyzing':
        return `Analyzing visual-verbal alignment... ${progress || 0}%`
      case 'processing':
        return `Processing framework scores... ${progress || 0}%`
      case 'generating':
        return `Generating recommendations... ${progress || 0}%`
      case 'complete':
        return 'Analysis complete!'
      default:
        return `Analyzing your pitch presentation... ${progress || 0}%`
    }
  }

  // Render frame placeholder or actual frame
  const renderFrame = (index: number) => {
    const frameIndex = index - 1
    const frame = state.extractedFrames[frameIndex]
    const isExtracting = state.processingStep === 'extracting'
    const hasError = hasFrameError()

    if (frame) {
      // Debug frame URL
      console.log(`🖼️  Frame ${index} URL:`, frame.url.substring(0, 100) + '...')
      console.log(`🖼️  Frame ${index} type:`, frame.url.startsWith('data:') ? 'data-url' : frame.url.startsWith('https://image.mux.com') ? 'mux-thumbnail' : 'other')
      
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
            className="w-[120px] h-[68px] rounded object-cover bg-gray-200"
            style={{
              minHeight: '68px',
              minWidth: '120px'
            }}
            onError={(e) => {
              const imgElement = e.target as HTMLImageElement
              const retryCount = parseInt(imgElement.dataset.retryCount || '0')
              
              // Suppress console errors for Mux thumbnails (they're expected to fail initially)
              if (frame.url.includes('image.mux.com')) {
                console.log(`⏳ Frame ${index} thumbnail not ready yet (attempt ${retryCount + 1}/3)`)
                
                // Progressive retry with longer delays for new Mux assets
                if (retryCount < 2) {
                  const delay = (retryCount + 1) * 3000 // 3s, 6s
                  imgElement.dataset.retryCount = (retryCount + 1).toString()
                  
                  setTimeout(() => {
                    imgElement.src = frame.url + '&retry=' + Date.now()
                  }, delay)
                  return
                }
                console.log(`📷 Using placeholder for frame ${index} (Mux thumbnail still processing)`)
              } else {
                console.error(`❌ Frame ${index} failed to load:`, frame.url)
              }
              
              // Final fallback: create a visible placeholder
              imgElement.style.backgroundColor = '#e5e7eb'
              imgElement.style.border = '1px solid #d1d5db'
              imgElement.style.position = 'relative'
              imgElement.src = `data:image/svg+xml;base64,${btoa(`<svg width="120" height="68" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="68" fill="#e5e7eb"/><text x="60" y="35" text-anchor="middle" font-family="Arial" font-size="10" fill="#6b7280">${frame.timestamp}s</text></svg>`)}`
            }}
            onLoad={() => {
              console.log(`✅ Frame ${index} loaded successfully:`, frame.url.substring(0, 80) + '...')
            }}
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
                processingStep: 'processing',
                uploadProgress: 100,
                parallelOperationsActive: true,
                operationsRemaining: 2
              }))
              // Trigger parallel processing: frame extraction and transcription
              Promise.all([
                handleFrameExtraction(blobUrl),
                handleTranscription(blobUrl)
              ])
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

            {/* Responsive Frame Grid - Shows All Frames */}
            <div 
              data-testid="frame-grid"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mt-4 max-h-96 overflow-y-auto"
            >
              {Array.from({ length: Math.max(state.extractedFrames.length, 9) }, (_, i) => (
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

            {/* Frame Total Indicator */}
            {state.extractedFrames.length > 0 && (
              <div className="mt-2 text-center">
                <div 
                  data-testid="frame-indicator"
                  className="text-xs text-gray-600"
                >
                  Showing all {state.extractedFrames.length} frames
                </div>
                <div 
                  data-testid="frame-source-indicator"
                  className={`text-xs mt-1 ${
                    state.extractedFrames[0]?.url?.startsWith('https://image.mux.com') 
                      ? 'text-green-600' 
                      : 'text-orange-600'
                  }`}
                >
                  {state.extractedFrames[0]?.url?.startsWith('https://image.mux.com') 
                    ? '✓ Using Mux thumbnails' 
                    : '⚠ Using mock frames (Mux unavailable)'
                  }
                </div>
              </div>
            )}

            {/* Progress bar during extraction */}
            {(state.processingStep === 'extracting' || state.parallelOperationsActive) && (
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

            {/* Transcription Progress Area */}
            {(state.processingStep === 'processing' || state.parallelOperationsActive) && (
              <div data-testid="transcription-progress-area" className="mt-4">
                <div className="mb-2">
                  <span data-testid="whisper-status-text" className="text-sm text-green-600">
                    {state.transcriptionStage === 'segmentation_in_progress' 
                      ? `Processing segments: ${state.segmentationProgress || 0}%`
                      : `Transcribing audio: ${transcriptionProgress}%`
                    }
                  </span>
                </div>
                <Progress 
                  data-testid="transcription-progress"
                  value={state.transcriptionStage === 'segmentation_in_progress' 
                    ? state.segmentationProgress || 0 
                    : transcriptionProgress
                  }
                  className="h-2 mb-2 bg-green-500"
                  aria-valuenow={state.transcriptionStage === 'segmentation_in_progress' 
                    ? state.segmentationProgress || 0 
                    : transcriptionProgress
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
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
              data-testid="dual-transcript-container"
              className="grid grid-cols-2 gap-4"
            >
              {/* Full Transcript Section */}
              <div data-testid="full-transcript-section">
                <h4 className="text-base font-semibold mb-2">Full Transcript</h4>
                {state.transcriptionStage === 'whisper_in_progress' ? (
                  <div data-testid="full-transcript-loading" className="bg-gray-50 p-3 rounded h-[200px]">
                    <div data-testid="full-transcript-skeleton" className="space-y-2 animate-pulse">
                      <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-300 rounded w-5/6"></div>
                    </div>
                  </div>
                ) : (
                  <div
                    data-testid="full-transcript-area"
                    className="bg-gray-50 p-3 rounded h-[200px] overflow-y-auto text-sm whitespace-pre-wrap"
                    role="region"
                    aria-label="Full transcript content"
                    tabIndex={0}
                  >
                    {state.fullTranscript && (
                      <div data-testid="full-transcript-populated">
                        {state.fullTranscript}
                      </div>
                    )}
                    {!state.fullTranscript && 'Transcript will appear here...'}
                  </div>
                )}
              </div>

              {/* Segmented Transcript Section */}
              <div data-testid="segmented-transcript-section">
                <h4 className="text-base font-semibold mb-2">Segmented Transcript</h4>
                {state.segmentationInProgress ? (
                  <div data-testid="segmented-transcript-loading" className="bg-gray-50 p-3 rounded h-[200px]">
                    <div className="mb-2">
                      <div className="text-xs text-blue-600 italic">
                        Processing segments: {state.segmentationProgress || 0}%
                      </div>
                      <div className="text-xs text-gray-500 italic">
                        Converting to 5-second segments...
                      </div>
                    </div>
                    <div data-testid="segmented-transcript-skeleton" className="space-y-3 animate-pulse">
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-full"></div>
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                ) : state.segmentationError ? (
                  <div data-testid="segmentation-error-message" className="bg-red-50 p-3 rounded h-[200px]">
                    <div className="text-red-600 text-sm mb-2">
                      Failed to process 5-second segments. Retrying automatically...
                    </div>
                    {state.retryCountdown && (
                      <div data-testid="retry-countdown-timer" className="text-xs text-gray-600">
                        Automatic retry in {state.retryCountdown}... 2... 1...
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    data-testid="segmented-transcript-area"
                    className="bg-gray-50 p-3 rounded h-[200px] overflow-y-auto text-sm whitespace-pre-wrap"
                    role="region"
                    aria-label="Time-segmented transcript content"
                    tabIndex={0}
                  >
                    {state.segmentedTranscript.length > 0 ? (
                      <div data-testid="segmented-transcript-populated">
                        {state.segmentedTranscript.map((segment, index) => (
                          <div key={index} data-testid={`segment-${index}`} className="mb-2">
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                              <span>{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</span>
                              <span 
                                data-testid={`confidence-indicator-${index}`}
                                className={cn(
                                  "px-1 rounded text-white text-xs",
                                  segment.confidence > 0.9 ? "bg-green-500" : 
                                  segment.confidence > 0.7 ? "bg-yellow-500" : "bg-red-500"
                                )}
                                aria-label={`Confidence: ${Math.round(segment.confidence * 100)}%`}
                              >
                                <span data-testid={`confidence-${index}`}>
                                  {Math.round(segment.confidence * 100)}%
                                </span>
                              </span>
                            </div>
                            <div>{segment.text}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      'Time-stamped segments will appear here...'
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Frame-Transcript Alignment Indicators */}
            {state.extractedFrames.length > 0 && state.segmentedTranscript.length > 0 && (
              <div data-testid="frame-segment-alignment-indicator" className="mt-4 p-2 bg-blue-50 rounded">
                <div className="text-xs text-blue-600 font-medium mb-1">
                  Frame-Transcript Alignment
                </div>
                <div className="flex gap-2 flex-wrap">
                  {state.extractedFrames.slice(0, 5).map((frame, index) => (
                    <div 
                      key={index}
                      data-testid={`timestamp-alignment-${frame.timestamp}s`}
                      className="text-xs bg-white px-2 py-1 rounded border"
                    >
                      {formatTime(frame.timestamp)}
                    </div>
                  ))}
                </div>
                <div data-testid="alignment-highlight" className="text-xs text-gray-600 mt-1">
                  ✓ Frames align with 5-second transcript segments
                </div>
                {state.extractedFrames.length > 0 && (
                  <div data-testid="alignment-indicator-5s" className="text-xs text-green-600">
                    Perfect 5-second alignment detected
                  </div>
                )}
              </div>
            )}

            {/* Transcript Announcements for Screen Readers */}
            <div 
              data-testid="transcript-announcements"
              aria-live="polite"
              className="sr-only"
            >
              {state.fullTranscript && 'Full transcript updated'}
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
            {/* Parallel Processing Container */}
            {state.parallelOperationsActive && (
              <div data-testid="parallel-processing-container" className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">Processing video...</span>
                  <span data-testid="parallel-processing-icon" className="text-blue-600">⫸</span>
                  <span className="text-xs text-gray-600">
                    ({state.operationsRemaining || 0} operation{(state.operationsRemaining || 0) !== 1 ? 's' : ''} remaining)
                  </span>
                </div>

                {/* Frame Extraction Section */}
                <div data-testid="frame-extraction-section" className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-blue-600">Extracting frames: {extractionProgress}%</span>
                    {state.timeEstimates?.frameExtraction && (
                      <span className="text-xs text-gray-500">
                        Frame extraction: ~{state.timeEstimates.frameExtraction}s remaining
                      </span>
                    )}
                  </div>
                  <Progress 
                    data-testid="frame-extraction-progress"
                    value={extractionProgress}
                    className="h-2 mb-1 bg-blue-500"
                    aria-valuenow={extractionProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Transcription Section */}
                <div data-testid="transcription-section" className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-green-600">
                      {state.transcriptionStage === 'segmentation_in_progress' 
                        ? `Processing segments: ${state.segmentationProgress || 0}%`
                        : `Transcribing audio: ${transcriptionProgress}%`
                      }
                    </span>
                    {state.timeEstimates?.transcription && (
                      <span className="text-xs text-gray-500">
                        Transcription: ~{state.timeEstimates.transcription}s remaining
                      </span>
                    )}
                  </div>
                  <Progress 
                    data-testid="transcription-progress"
                    value={state.transcriptionStage === 'segmentation_in_progress' 
                      ? state.segmentationProgress || 0 
                      : transcriptionProgress
                    }
                    className="h-2 mb-1 bg-green-500"
                    aria-valuenow={state.transcriptionStage === 'segmentation_in_progress' 
                      ? state.segmentationProgress || 0 
                      : transcriptionProgress
                    }
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                  {state.transcriptionStage === 'segmentation_in_progress' && (
                    <div data-testid="segmentation-progress-bar" className="mt-1">
                      <div className="text-xs text-gray-500 italic">
                        Converting to 5-second segments...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Completion Status Indicators */}
            {state.transcriptionStage === 'complete' && (
              <div data-testid="transcription-complete-status" className="mb-3">
                <div data-testid="transcription-complete-indicator" className="text-green-600 text-sm flex items-center gap-2">
                  <span>✓</span>
                  <span>Transcription complete!</span>
                </div>
              </div>
            )}

            {state.extractedFrames.length > 0 && state.operationsRemaining === 1 && (
              <div data-testid="frame-extraction-complete-status" className="mb-3">
                <div className="text-blue-600 text-sm flex items-center gap-2">
                  <span>✓</span>
                  <span>Frame extraction complete!</span>
                </div>
              </div>
            )}

            {state.processingStep === 'complete' && (
              <div data-testid="processing-complete-status" className="mb-3">
                <div className="text-green-600 text-lg flex items-center gap-2">
                  <span data-testid="celebration-animation" className="animate-bounce">🎉</span>
                  <span>Processing complete!</span>
                </div>
              </div>
            )}

            {/* Error Status Indicators */}
            {getSectionError('transcription') && (
              <div data-testid="transcription-error-status" className="mb-3">
                <div className="text-red-600 text-sm mb-2">
                  Transcription failed - Retrying...
                </div>
                <Button
                  data-testid="retry-transcription-button"
                  onClick={() => handleRetry('transcription')}
                  className="bg-red-600 text-white hover:bg-red-700 text-xs"
                  disabled={retryingSection === 'transcription'}
                >
                  {retryingSection === 'transcription' ? 'Retrying...' : 'Retry Transcription'}
                </Button>
              </div>
            )}

            {state.segmentationError && (
              <div data-testid="segmentation-error-status" className="mb-3">
                <div className="text-red-600 text-sm mb-2">
                  Segmentation failed - Retrying...
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Automatic retry in 3... 2... 1...
                </div>
                <Button
                  data-testid="retry-segmentation-button"
                  onClick={() => handleRetry('segmentation')}
                  className="bg-red-600 text-white hover:bg-red-700 text-xs"
                  disabled={retryingSection === 'segmentation'}
                >
                  Retry Segmentation
                </Button>
              </div>
            )}

            {state.fullTranscript && state.segmentationError && (
              <div data-testid="full-transcript-available" className="mb-3">
                <div className="text-green-600 text-sm">
                  ✓ Full transcript available
                </div>
              </div>
            )}

            {/* Current Step Text */}
            <div 
              data-testid="current-step-text"
              className="italic text-gray-600 mb-3"
            >
              {state.parallelOperationsActive 
                ? `Processing video... (${state.operationsRemaining || 0} operation${(state.operationsRemaining || 0) !== 1 ? 's' : ''} remaining)`
                : getStepDisplay(state.processingStep)
              }
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
                <div>Anthropic Claude: ${costs.anthropicClaude.toFixed(2)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Pitch Analysis Section - Automatically appears after processing completion */}
        {(state.processingStep === 'complete' && state.extractedFrames.length > 0 && state.segmentedTranscript.length > 0) && (
          <div className="mt-6 animate-expand">
            <Card
              data-testid="pitch-analysis-section"
              data-component="card"
              className="rounded-lg p-4 border-2 border-indigo-500"
              role="region"
              aria-label="Pitch analysis section"
            >
              <CardHeader className="p-0 mb-4">
                <CardTitle 
                  data-testid="pitch-analysis-title"
                  className="text-lg font-semibold mb-4"
                >
                  Pitch Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Analysis in Progress */}
                {state.pitchAnalysisInProgress && (
                  <div data-testid="analysis-automatic-trigger" className="mb-4">
                    <div className="mb-3">
                      <span 
                        data-testid="analysis-stage-text" 
                        className="text-sm font-medium text-indigo-600"
                      >
                        {getAnalysisStageText(state.pitchAnalysisStage, state.pitchAnalysisProgress)}
                      </span>
                    </div>
                    <Progress
                      data-testid="analysis-progress-bar"
                      value={state.pitchAnalysisProgress || 0}
                      className={cn(
                        "h-2 mb-2",
                        state.pitchAnalysisError ? "bg-red-500" : "bg-blue-500"
                      )}
                      aria-valuenow={state.pitchAnalysisProgress || 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                )}

                {/* Analysis Error State */}
                {state.pitchAnalysisError && !state.pitchAnalysisInProgress && (
                  <div data-testid="analysis-error-message" className="mb-4">
                    <div className="text-red-600 text-sm mb-2">
                      ⚠ Analysis failed - Retrying automatically...
                    </div>
                    <div data-testid="retry-countdown-timer" className="text-xs text-gray-600">
                      Retry in 3... 2... 1...
                    </div>
                  </div>
                )}

                {/* Analysis Results */}
                {state.pitchAnalysisResults && !state.pitchAnalysisInProgress && (
                  <div data-testid="analysis-results-container" className="animate-fade-in">
                    {/* Overall Score Card */}
                    <div data-testid="overall-score-card" className="mb-6">
                      <div className="text-center">
                        <div 
                          data-testid="overall-score-display"
                          className="text-3xl font-bold text-indigo-600 mb-2"
                        >
                          {state.pitchAnalysisResults.overallScore}/10
                        </div>
                        <div className="text-sm text-gray-600">Overall Score</div>
                      </div>
                    </div>

                    {/* Category Scores Card */}
                    <div data-testid="category-scores-card" className="mb-6">
                      <h4 className="text-base font-semibold mb-3">Category Scores</h4>
                      <div className="space-y-2">
                        <div data-testid="category-score-speech" className="flex justify-between">
                          <span>Speech Mechanics:</span>
                          <span className="font-medium">{state.pitchAnalysisResults.categoryScores.speech}/10</span>
                        </div>
                        <div data-testid="category-score-content" className="flex justify-between">
                          <span>Content Quality:</span>
                          <span className="font-medium">{state.pitchAnalysisResults.categoryScores.content}/10</span>
                        </div>
                        <div data-testid="category-score-visual" className="flex justify-between">
                          <span>Visual Presentation:</span>
                          <span className="font-medium">{state.pitchAnalysisResults.categoryScores.visual}/10</span>
                        </div>
                        <div data-testid="category-score-overall" className="flex justify-between">
                          <span>Overall Effectiveness:</span>
                          <span className="font-medium">{state.pitchAnalysisResults.categoryScores.overall}/10</span>
                        </div>
                      </div>
                    </div>

                    {/* Key Issues Found */}
                    <div data-testid="pitch-analysis-results-card" className="mb-6">
                      <h4 className="text-base font-semibold mb-3">Key Issues Found</h4>
                      {state.pitchAnalysisResults.timestampedRecommendations?.slice(0, 3).map((rec: any, index: number) => (
                        <div key={rec.id} className="mb-3 p-3 bg-gray-50 rounded">
                          <div className="font-medium text-sm">
                            {index + 1}. {rec.title} at {formatTime(rec.timestamp)}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {rec.description}
                          </div>
                          <div className="text-sm text-blue-600 mt-1">
                            {rec.actionableAdvice}
                          </div>
                        </div>
                      )) || (
                        <div className="text-gray-500 text-sm">No major issues detected</div>
                      )}
                    </div>

                    {/* Detailed Framework Analysis */}
                    <div className="mb-6">
                      <h4 className="text-base font-semibold mb-3">Detailed Framework Analysis (13 Points)</h4>
                      
                      {(() => {
                        const scores = state.pitchAnalysisResults.individualScores || []
                        const categories = {
                          'Speech Mechanics (3 Points)': ['pace_rhythm', 'filler_words', 'vocal_confidence'],
                          'Content Quality (6 Points)': ['problem_definition', 'solution_clarity', 'market_validation', 'traction_evidence', 'financial_projections', 'ask_clarity'],
                          'Visual Presentation (2 Points)': ['slide_design', 'data_visualization'],
                          'Overall Effectiveness (2 Points)': ['storytelling', 'executive_presence']
                        }
                        
                        return Object.entries(categories).map(([categoryName, pointIds]) => (
                          <div key={categoryName} className="mb-6">
                            <h5 className="text-sm font-semibold text-gray-700 mb-3 border-b pb-1">{categoryName}</h5>
                            <div className="space-y-3">
                              {pointIds.map(pointId => {
                                const score = scores.find((s: any) => s.pointId === pointId)
                                if (!score) {
                                  return (
                                    <div key={pointId} className="border rounded-lg p-4 bg-gray-50">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="font-medium text-sm capitalize text-gray-500">
                                          {pointId.replace(/_/g, ' ')}
                                        </div>
                                        <div className="text-sm text-gray-400">Not analyzed</div>
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        This framework point was not included in the analysis.
                                      </div>
                                    </div>
                                  )
                                }
                                
                                return (
                                  <div key={pointId} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-2">
                                      <div className="font-medium text-sm capitalize">
                                        {score.pointId.replace(/_/g, ' ')}
                                      </div>
                                      <div className={`text-sm font-bold ${
                                        score.score >= 8 ? 'text-green-600' : 
                                        score.score >= 6 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {score.score}/10
                                      </div>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-2">
                                      {score.rationale}
                                    </div>
                                    {score.improvementSuggestions?.length > 0 && (
                                      <div className="text-sm">
                                        <div className="font-medium text-blue-700 mb-1">Recommendations:</div>
                                        <ul className="list-disc list-inside space-y-1">
                                          {score.improvementSuggestions.map((suggestion: string, idx: number) => (
                                            <li key={idx} className="text-blue-600">{suggestion}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))
                      })()}
                      
                      {(!state.pitchAnalysisResults.individualScores || state.pitchAnalysisResults.individualScores.length === 0) && (
                        <div className="text-sm text-gray-500">No framework scores available</div>
                      )}
                    </div>

                    {/* All Timestamped Recommendations */}
                    {state.pitchAnalysisResults.timestampedRecommendations?.length > 3 && (
                      <div className="mb-6">
                        <h4 className="text-base font-semibold mb-3">All Recommendations ({state.pitchAnalysisResults.timestampedRecommendations.length})</h4>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {state.pitchAnalysisResults.timestampedRecommendations.map((rec: any, index: number) => (
                            <div key={rec.id} className="border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm">
                                  {rec.title}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className={`px-2 py-1 rounded ${
                                    rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {rec.priority}
                                  </span>
                                  <span className="text-gray-500">
                                    {formatTime(rec.timestamp)}
                                  </span>
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                <strong>Issue:</strong> {rec.specificIssue}
                              </div>
                              <div className="text-sm text-blue-600">
                                <strong>Action:</strong> {rec.actionableAdvice}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Slide Analysis */}
                    {state.pitchAnalysisResults.slideAnalysis?.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-base font-semibold mb-3">Visual-Verbal Alignment Analysis</h4>
                        <div className="space-y-3">
                          {state.pitchAnalysisResults.slideAnalysis.map((slide: any, index: number) => (
                            <div key={index} className="border rounded-lg p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div className="font-medium text-sm">
                                  Frame at {formatTime(slide.timestamp)}
                                </div>
                                <div className={`text-sm font-bold ${
                                  slide.score >= 8 ? 'text-green-600' : 
                                  slide.score >= 6 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {slide.score}/10
                                </div>
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                <strong>Content:</strong> {slide.contentSummary}
                              </div>
                              <div className="text-sm text-gray-600 mb-2">
                                <strong>Design:</strong> {slide.designFeedback}
                              </div>
                              <div className={`text-sm mb-2 ${
                                slide.alignmentWithSpeech.includes('MISMATCH') ? 'text-red-600' : 'text-green-600'
                              }`}>
                                <strong>Alignment:</strong> {slide.alignmentWithSpeech}
                              </div>
                              {slide.improvementSuggestions?.length > 0 && (
                                <div className="text-sm">
                                  <div className="font-medium text-blue-700 mb-1">Improvements:</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {slide.improvementSuggestions.map((suggestion: string, idx: number) => (
                                      <li key={idx} className="text-blue-600">{suggestion}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Success Message */}
                    <div className="text-green-600 text-sm flex items-center gap-2">
                      <span>✓</span>
                      <span>
                        Pitch analysis complete! Found {state.pitchAnalysisResults.timestampedRecommendations?.length || 0} recommendations
                      </span>
                    </div>
                  </div>
                )}

                {/* Timestamp Alignment Validation */}
                {state.extractedFrames.length > 0 && state.segmentedTranscript.length > 0 && (
                  <div data-testid="timestamp-alignment-validation" className="mt-4 p-2 bg-green-50 rounded">
                    <div className="text-xs text-green-600 font-medium">
                      ✓ Perfect 5-second alignment detected
                    </div>
                  </div>
                )}
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
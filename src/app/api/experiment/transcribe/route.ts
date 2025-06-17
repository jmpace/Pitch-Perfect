import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@ai-sdk/openai'
import { experimental_transcribe } from 'ai'
import OpenAI from 'openai'

/**
 * API Route: Whisper Transcription via Vercel AI SDK
 * 
 * Implements two-stage transcription pipeline:
 * 1. OpenAI Whisper API for full transcript
 * 2. Python-style segmentation processing for 5-second aligned segments
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body once and reuse
    const requestBody = await request.json()
    const { videoUrl, videoDuration, stage = 'whisper', fullTranscript, muxPlaybackId } = requestBody

    if (!videoUrl) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      )
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY
    
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, falling back to mock response')
      return getMockWhisperResponse(videoDuration)
    }

    if (stage === 'whisper') {
      return await handleWhisperTranscription(videoUrl, videoDuration, muxPlaybackId)
    } else if (stage === 'segmentation') {
      return await handleSegmentationProcessing(fullTranscript, videoDuration)
    }

    return NextResponse.json(
      { error: 'Invalid stage parameter' },
      { status: 400 }
    )

  } catch (error) {
    console.error('❌ Transcription error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
      cause: error instanceof Error ? (error as any).cause : undefined
    })
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      { 
        error: 'Internal server error during transcription',
        details: errorMessage,
        stage: 'transcription_failed'
      },
      { status: 500 }
    )
  }
}

/**
 * Handle transcription using Mux audio-only static renditions for all videos
 */
async function handleMuxAudioTranscription(videoUrl: string, videoDuration: number, muxPlaybackId?: string): Promise<NextResponse> {
  console.log(`🎵 Using Mux audio-only transcription for clean, consistent audio processing...`)
  console.log(`🔍 Debug info:`, {
    videoUrl: videoUrl.substring(0, 80) + '...',
    videoDuration,
    muxPlaybackId: muxPlaybackId || 'not provided',
    urlType: videoUrl.startsWith('blob:') ? 'local-blob' : videoUrl.startsWith('https://') ? 'vercel-blob' : 'unknown'
  })
  
  // Use provided muxPlaybackId first, then try to extract from URL
  let playbackId = muxPlaybackId || extractMuxPlaybackId(videoUrl)
  
  if (!playbackId) {
    // If no playback ID available, this means frame extraction is still in progress
    // For parallel processing, we should delay transcription until frames are ready
    console.log(`⏳ No playback ID available - frame extraction likely in progress`)
    
    // Return structured status response instead of throwing fake error
    return NextResponse.json({
      success: false,
      status: 'waiting_for_dependency',
      message: 'Audio extraction in progress',
      dependency: {
        type: 'mux_playback_id',
        required_for: 'audio_file_access',
        description: 'Waiting for Mux to process audio-only static rendition'
      },
      estimated_wait_seconds: 45,
      retry_recommended: true,
      current_step: 'audio_extraction_in_progress',
      progress_percentage: 25
    }, { status: 202 }) // HTTP 202 Accepted - request is being processed
  }
  
  console.log(`✅ Using Mux playback ID: ${playbackId}`)
  
  // Construct Mux audio-only URL using static renditions
  // According to Mux docs: https://docs.mux.com/guides/video/get-images-from-a-video#audio-only-renditions
  const audioOnlyUrl = `https://stream.mux.com/${playbackId}/audio.m4a`
  
  console.log(`🎵 Using Mux audio-only URL: ${audioOnlyUrl}`)
  
  try {
    // Retry fetching the audio file with longer timeouts since static renditions for long videos take time
    let audioResponse: Response | null = null
    let retryAttempts = 0
    const maxRetries = 8 // More attempts for longer videos
    
    while (retryAttempts < maxRetries) {
      console.log(`🎵 Fetching Mux audio-only file (attempt ${retryAttempts + 1}/${maxRetries}): ${audioOnlyUrl}`)
      
      audioResponse = await fetch(audioOnlyUrl)
      console.log(`📥 Mux audio fetch response: ${audioResponse.status} ${audioResponse.statusText}`)
      
      if (audioResponse.ok) {
        console.log(`✅ Mux audio-only file ready after ${retryAttempts + 1} attempts`)
        break
      }
      
      if (audioResponse.status === 404 && retryAttempts < maxRetries - 1) {
        // Static rendition not ready yet, wait longer for longer videos
        const waitTime = Math.min(5000 * Math.pow(1.5, retryAttempts), 30000) // 5s, 7.5s, 11.25s, 16.9s, 25.3s, 30s, 30s, 30s
        console.log(`⏳ Static rendition not ready (404), waiting ${waitTime}ms before retry... (Total video: ${videoDuration}s)`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        retryAttempts++
        continue
      }
      
      // Non-404 error or max retries reached
      console.error(`❌ Mux audio fetch failed: ${audioResponse.status} ${audioResponse.statusText}`)
      throw new Error(`Failed to fetch Mux audio-only file after ${retryAttempts + 1} attempts: ${audioResponse.status} ${audioResponse.statusText}`)
    }
    
    if (!audioResponse || !audioResponse.ok) {
      throw new Error(`Failed to fetch Mux audio-only file after ${maxRetries} attempts. Static rendition may still be processing.`)
    }
    
    const audioArrayBuffer = await audioResponse.arrayBuffer()
    const audioUint8Array = new Uint8Array(audioArrayBuffer)
    const audioSizeMB = Math.round(audioUint8Array.length / 1024 / 1024)
    
    console.log(`✅ Downloaded Mux audio-only file: ${audioSizeMB}MB`)
    
    // Debug: Check the actual file format by examining headers
    const headerBytes = Array.from(audioUint8Array.slice(0, 8))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
    console.log('🔍 File header bytes:', headerBytes)
    
    // Check content type from response
    const contentType = audioResponse.headers.get('content-type')
    console.log('📄 Content-Type from Mux:', contentType)
    
    // Audio-only files are always much smaller than the original video
    console.log(`✅ Mux audio compression successful: ${audioSizeMB}MB audio file`)
    
    // Proceed with Whisper transcription using the compressed audio
    console.log('🔄 Calling OpenAI Whisper API with Mux audio-only file...')
    const startTranscription = Date.now()
    
    // Log additional debugging info
    console.log('🔍 Audio data details:', {
      isUint8Array: audioUint8Array instanceof Uint8Array,
      length: audioUint8Array.length,
      contentType: contentType,
      firstFewBytes: Array.from(audioUint8Array.slice(0, 4)).map(b => `0x${b.toString(16)}`).join(' ')
    })
    
    // Use native OpenAI SDK for more reliable file handling
    const openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Create a File object for the native OpenAI SDK
    const audioFile = new File([audioUint8Array], 'audio.m4a', {
      type: contentType || 'audio/m4a'
    })
    
    console.log('📁 Created audio file for native OpenAI SDK:', {
      name: audioFile.name,
      type: audioFile.type,
      size: audioFile.size
    })
    
    const result = await openaiClient.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1'
    })
    
    console.log(`✅ Whisper API completed in ${Date.now() - startTranscription}ms using audio-only file`)
    
    const transcription = {
      text: result.text,
      language: (result as any).language || 'en',
      duration: (result as any).duration || videoDuration || 60,
      segments: (result as any).segments || []
    }

    const estimatedCost = calculateWhisperCost(videoDuration || 60)

    return NextResponse.json({
      success: true,
      stage: 'whisper_complete',
      fullTranscript: transcription.text,
      whisperData: {
        text: transcription.text,
        language: transcription.language || 'en',
        duration: transcription.duration || videoDuration || 60,
        segments: transcription.segments || []
      },
      metadata: {
        processingTime: Date.now() - startTranscription,
        cost: estimatedCost,
        audioLengthSeconds: transcription.duration || videoDuration || 60,
        transcriptionMethod: 'mux_audio_only_whisper',
        wordCount: transcription.text.split(' ').length,
        audioSizeMB: audioSizeMB,
        audioContentType: contentType,
        muxAudioUrl: audioOnlyUrl
      }
    })
    
  } catch (error) {
    console.error('❌ Mux audio-only transcription failed:', error)
    throw new Error(`Mux audio-only transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Extract Mux playback ID from various URL formats
 */
function extractMuxPlaybackId(url: string): string | null {
  try {
    // Handle various Mux URL formats:
    // - https://stream.mux.com/{PLAYBACK_ID}/...
    // - Vercel blob URLs that contain Mux playback IDs
    // - Direct Mux asset references
    
    const patterns = [
      /stream\.mux\.com\/([^\/]+)/,  // Direct Mux stream URLs
      /playback[-_]id[=:]([^&\s]+)/i, // URLs with playback_id parameter
      /mux[_-]([a-zA-Z0-9]+)/i       // Generic Mux ID patterns
    ]
    
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        console.log(`🎯 Extracted Mux playback ID: ${match[1]} from URL: ${url.substring(0, 100)}...`)
        return match[1]
      }
    }
    
    console.warn(`⚠️ Could not extract Mux playback ID from URL: ${url.substring(0, 100)}...`)
    return null
  } catch (error) {
    console.error('Error extracting Mux playback ID:', error)
    return null
  }
}

/**
 * Stage 1: Handle Whisper API transcription
 */
async function handleWhisperTranscription(videoUrl: string, videoDuration?: number, muxPlaybackId?: string) {
  const startTime = Date.now()
  
  console.log('🎬 Whisper transcription request:', { 
    videoUrl: videoUrl.substring(0, 100) + '...', 
    videoDuration,
    urlType: videoUrl.startsWith('blob:') ? 'local-blob' : videoUrl.startsWith('https://') ? 'vercel-blob' : 'unknown'
  })
  
  // Check if this is a local blob URL that can't be fetched server-side
  if (videoUrl.startsWith('blob:')) {
    console.log('⚠️ Received local blob URL, falling back to mock response')
    return getMockWhisperResponse(videoDuration)
  }
  
  
  // Check if OpenAI API key is available for real transcription
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_API_KEY) {
    console.log('🔄 No OpenAI API key found, using mock response')
    return getMockWhisperResponse(videoDuration)
  }
  
  try {
    // Fetch the video file from the blob URL
    let audioBuffer: Buffer
    
    try {
      // Add timeout for video fetch (30 seconds)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      
      const videoResponse = await fetch(videoUrl, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to fetch video: ${videoResponse.status}`)
      }
      
      const arrayBuffer = await videoResponse.arrayBuffer()
      audioBuffer = Buffer.from(arrayBuffer)
      
      console.log('✅ Successfully fetched video data:', audioBuffer.length, 'bytes')
    } catch (fetchError) {
      console.error('❌ Video fetch failed:', {
        error: fetchError,
        url: videoUrl.substring(0, 100) + '...',
        message: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      })
      // For production with real OpenAI API, we need actual audio data
      throw new Error(`Cannot fetch video from URL: ${videoUrl.substring(0, 50)}... Error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
    }

    // Validate buffer before creating File
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Audio buffer is empty or invalid')
    }

    console.log('📁 Preparing audio file for Whisper:', {
      bufferLength: audioBuffer.length,
      bufferType: typeof audioBuffer,
      isBuffer: Buffer.isBuffer(audioBuffer)
    })

    // Convert Buffer to Uint8Array for AI SDK compatibility
    const uint8Array = new Uint8Array(audioBuffer)
    console.log('🔄 Converted to Uint8Array:', {
      length: uint8Array.length,
      constructor: uint8Array.constructor.name
    })

    // Always use Mux audio-only static renditions for consistent, clean transcription workflow
    // This provides better audio quality, smaller file sizes, and eliminates file size limits
    const fileSizeMB = Math.round(uint8Array.length / 1024 / 1024)
    console.log(`🎵 Using Mux audio-only transcription for all videos (original: ${fileSizeMB}MB)`)
    
    return await handleMuxAudioTranscription(videoUrl, videoDuration || 60, muxPlaybackId)

  } catch (error) {
    console.error('Whisper API error:', error)
    
    // Mock response for development/testing when Whisper API is not available
    if (error instanceof Error && error.message.includes('fetch')) {
      return getMockWhisperResponse(videoDuration)
    }
    
    throw error
  }
}

/**
 * Stage 2: Handle segmentation processing (Python-style processing)
 */
async function handleSegmentationProcessing(fullTranscript: string, videoDuration: number) {
  const startTime = Date.now()
  
  try {
    // Simulate Python segmentation script processing
    // In a real implementation, this would call a Python microservice
    const segments = await processTranscriptInto5SecondSegments(fullTranscript, videoDuration)
    
    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      stage: 'segmentation_complete',
      segmentedTranscript: segments,
      metadata: {
        processingTime,
        segmentCount: segments.length,
        processingMethod: 'javascript_simulation_of_python_segmentation',
        averageConfidence: segments.reduce((acc, seg) => acc + seg.confidence, 0) / segments.length
      }
    })

  } catch (error) {
    console.error('Segmentation processing error:', error)
    throw error
  }
}

/**
 * Simulate Python segmentation script that processes Whisper output
 * into 5-second aligned segments
 */
async function processTranscriptInto5SecondSegments(
  fullTranscript: string, 
  videoDuration: number
): Promise<Array<{
  text: string
  startTime: number
  endTime: number
  confidence: number
}>> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const words = fullTranscript.split(' ')
  const segments = []
  const segmentDuration = 5 // 5 seconds per segment
  const totalSegments = Math.ceil(videoDuration / segmentDuration)
  
  for (let i = 0; i < totalSegments; i++) {
    const startTime = i * segmentDuration
    const endTime = Math.min(startTime + segmentDuration, videoDuration)
    
    // Don't create segments beyond video duration
    if (startTime >= videoDuration) break
    
    // Calculate word allocation for this segment
    const segmentProgress = i / totalSegments
    const nextSegmentProgress = (i + 1) / totalSegments
    
    const startWordIndex = Math.floor(segmentProgress * words.length)
    const endWordIndex = Math.floor(nextSegmentProgress * words.length)
    
    const segmentWords = words.slice(startWordIndex, endWordIndex)
    const segmentText = segmentWords.join(' ')
    
    // Simulate confidence scoring (would come from actual Whisper word-level data)
    const confidence = 0.85 + (Math.random() * 0.15) // Random between 0.85-1.0
    
    if (segmentText.trim()) {
      segments.push({
        text: segmentText.trim(),
        startTime,
        endTime,
        confidence: Math.round(confidence * 100) / 100
      })
    }
  }
  
  return segments
}

/**
 * Calculate OpenAI Whisper API cost
 * Pricing: $0.006 per minute
 */
function calculateWhisperCost(durationSeconds: number): number {
  const durationMinutes = durationSeconds / 60
  const costPerMinute = 0.006
  return Math.round(durationMinutes * costPerMinute * 100) / 100
}

/**
 * Mock Whisper response for development/testing
 */
function getMockWhisperResponse(videoDuration?: number) {
  const mockDuration = videoDuration || 120 // Default 2 minutes
  const mockTranscript = "Hello everyone, welcome to our presentation today. We will be discussing the future of artificial intelligence and its applications in modern software development. This comprehensive overview will cover multiple topics including machine learning algorithms, neural networks, and practical implementation strategies. We'll explore how AI is transforming various industries and examine the ethical considerations that come with these technological advances."
  
  console.log('🔄 Using mock Whisper response - Configure OPENAI_API_KEY for production transcription')
  
  return NextResponse.json({
    success: true,
    stage: 'whisper_complete',
    fullTranscript: mockTranscript,
    whisperData: {
      text: mockTranscript,
      language: 'en',
      duration: mockDuration,
      segments: []
    },
    metadata: {
      processingTime: 2500,
      cost: 0, // No cost for mock response
      audioLengthSeconds: mockDuration,
      transcriptionMethod: 'mock_whisper_fallback',
      wordCount: mockTranscript.split(' ').length,
      notice: '⚠️ This is a mock response. Set OPENAI_API_KEY for real transcription.'
    }
  })
}

/**
 * GET endpoint for health check
 */
export async function GET() {
  return NextResponse.json({
    message: 'Whisper transcription API is ready',
    endpoint: '/api/experiment/transcribe',
    method: 'POST',
    stages: ['whisper', 'segmentation'],
    requiredFields: ['videoUrl', 'videoDuration'],
    environmentCheck: {
      openaiApiKey: !!process.env.OPENAI_API_KEY
    }
  })
}
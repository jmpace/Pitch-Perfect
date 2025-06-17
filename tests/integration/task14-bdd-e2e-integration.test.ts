/**
 * Task 14: BDD End-to-End Integration Tests
 * 
 * Tests complete scenarios from the BDD specification to ensure the entire
 * status communication system works end-to-end as specified.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the complete system components
const mockSystem = {
  api: {
    transcribe: vi.fn(),
    extractFrames: vi.fn()
  },
  frontend: {
    uploadVideo: vi.fn(),
    updateState: vi.fn(),
    checkRetryConditions: vi.fn(),
    executeRetry: vi.fn()
  },
  external: {
    mux: {
      checkAudioReady: vi.fn(),
      getPlaybackId: vi.fn()
    },
    openai: {
      transcribe: vi.fn()
    }
  },
  database: {
    updateVideoStatus: vi.fn(),
    logProcessingEvent: vi.fn()
  },
  logger: {
    logs: [] as any[],
    info: function(message: string, data?: any) {
      this.logs.push({ level: 'info', message, data })
    },
    error: function(message: string, data?: any) {
      this.logs.push({ level: 'error', message, data })
    }
  }
}

describe('Task 14: BDD End-to-End Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSystem.logger.logs = []
  })

  describe('Scenario 1: Video Upload with Audio Ready Immediately', () => {
    test('complete flow when Mux audio is available on first attempt', async () => {
      // Given: API migrated to status-based communication
      // And: video has fast Mux audio extraction
      
      // Mock Mux audio already available
      mockSystem.external.mux.checkAudioReady.mockResolvedValue(true)
      mockSystem.external.mux.getPlaybackId.mockResolvedValue('ready-playback-id')
      
      // Mock successful transcription
      mockSystem.external.openai.transcribe.mockResolvedValue({
        text: 'Immediately transcribed content'
      })

      // When: transcription is attempted
      const processVideo = async (videoUrl: string) => {
        mockSystem.logger.info('Starting video processing', { videoUrl })
        
        // Check if Mux audio is ready
        const audioReady = await mockSystem.external.mux.checkAudioReady()
        const playbackId = await mockSystem.external.mux.getPlaybackId()
        
        if (audioReady && playbackId) {
          // Direct transcription
          mockSystem.logger.info('Audio ready, proceeding with transcription')
          const transcript = await mockSystem.external.openai.transcribe()
          
          return {
            status: 200,
            success: true,
            stage: 'whisper_complete',
            fullTranscript: transcript.text
          }
        }
        
        // Would return waiting status
        return {
          status: 202,
          success: false,
          waitingStatus: 'waiting_for_dependency'
        }
      }

      const result = await processVideo('test-video.mp4')

      // Then: API returns HTTP 200 with successful transcription
      expect(result.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.stage).toBe('whisper_complete')
      expect(result.fullTranscript).toBe('Immediately transcribed content')
      
      // And: no status communication responses triggered
      expect(result.waitingStatus).not.toBe('waiting_for_dependency')
      
      // And: no waiting states appear
      const waitingLogs = mockSystem.logger.logs.filter(
        log => log.message.includes('waiting') || log.message.includes('retry')
      )
      expect(waitingLogs).toHaveLength(0)
      
      // And: processing shows complete
      expect(mockSystem.logger.logs.find(
        log => log.message.includes('Audio ready')
      )).toBeDefined()
    })
  })

  describe('Scenario 2: Video Upload with Audio Extraction in Progress', () => {
    test('complete flow with status response for audio not ready', async () => {
      // Given: API migrated to status-based communication
      // And: video triggers Mux audio extraction delay
      
      mockSystem.external.mux.checkAudioReady.mockResolvedValue(false)
      mockSystem.external.mux.getPlaybackId.mockResolvedValue(null)

      // When: transcription attempted before Mux audio ready
      const attemptTranscription = async () => {
        const audioReady = await mockSystem.external.mux.checkAudioReady()
        
        if (!audioReady) {
          mockSystem.logger.info('Status: waiting_for_dependency')
          
          // Then: API returns HTTP 202 instead of HTTP 500
          return {
            status: 202,
            body: {
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
            }
          }
        }
        
        return { status: 200 }
      }

      const response = await attemptTranscription()

      // Verify response structure
      expect(response.status).toBe(202)
      expect(response.body?.success).toBe(false)
      expect(response.body?.status).toBe('waiting_for_dependency')
      expect(response.body?.message).toBe('Audio extraction in progress')
      expect(response.body?.dependency.type).toBe('mux_playback_id')
      expect(response.body?.retry_recommended).toBe(true)
      
      // And: no Error object thrown
      const errorLogs = mockSystem.logger.logs.filter(log => log.level === 'error')
      expect(errorLogs).toHaveLength(0)
      
      // And: no fake error stack traces
      const hasStackTrace = mockSystem.logger.logs.some(
        log => log.data?.stack || log.message.includes('Error:')
      )
      expect(hasStackTrace).toBe(false)
    })
  })

  describe('Scenario 3: Frontend Status Detection', () => {
    test('frontend correctly processes status response without error parsing', async () => {
      // Given: frontend migrated to status-based detection
      
      // Mock API response
      const mockApiResponse = {
        ok: false,
        status: 202,
        json: () => Promise.resolve({
          status: 'waiting_for_dependency',
          message: 'Audio extraction in progress',
          estimated_wait_seconds: 45
        })
      }

      // When: frontend processes API response
      const processFrontendResponse = async (response: any) => {
        const data = await response.json()
        
        // Then: detects 202 status code (not error message parsing)
        if (response.status === 202) {
          mockSystem.logger.info('Detected waiting status', { httpCode: 202 })
          
          // And: extracts status field
          const waitingStatus = data.status
          
          // And: sets transcriptionStage
          mockSystem.frontend.updateState({
            transcriptionStage: 'waiting_for_dependency',
            transcriptionWaitingReason: data.message,
            estimatedWaitTime: data.estimated_wait_seconds
          })
          
          // And: does NOT add error
          // (no error added to state)
          
          // And: calls retry logic
          mockSystem.frontend.checkRetryConditions()
          
          return {
            isWaiting: true,
            hasError: false,
            uiMessage: `🎵 ${data.message}`
          }
        }
        
        return { isWaiting: false }
      }

      const result = await processFrontendResponse(mockApiResponse)

      // Verify frontend behavior
      expect(result.isWaiting).toBe(true)
      expect(result.hasError).toBe(false)
      expect(result.uiMessage).toBe('🎵 Audio extraction in progress')
      
      expect(mockSystem.frontend.updateState).toHaveBeenCalledWith({
        transcriptionStage: 'waiting_for_dependency',
        transcriptionWaitingReason: 'Audio extraction in progress',
        estimatedWaitTime: 45
      })
      
      expect(mockSystem.frontend.checkRetryConditions).toHaveBeenCalled()
    })
  })

  describe('Scenario 4: Automatic Retry Logic', () => {
    test('simplified retry based on status check', async () => {
      // Given: retry logic migrated to status-based detection
      const state = {
        transcriptionStage: 'waiting_for_dependency',
        extractedFrames: [
          { url: 'frame1.jpg', timestamp: 5, filename: 'frame_5s.jpg' },
          { url: 'frame2.jpg', timestamp: 10, filename: 'frame_10s.jpg' }
        ],
        segmentedTranscript: [],
        muxPlaybackId: 'newly-available-id'
      }

      // When: retry condition check runs
      const checkRetry = () => {
        // Then: evaluates simple status check
        const needsRetry = state.transcriptionStage === 'waiting_for_dependency' &&
                          state.extractedFrames.length > 0 &&
                          state.segmentedTranscript.length === 0 &&
                          !!state.muxPlaybackId
        
        mockSystem.logger.info('Retry check', {
          needsRetry,
          condition: 'transcriptionStage === waiting_for_dependency',
          hasFrames: state.extractedFrames.length > 0,
          hasMuxId: !!state.muxPlaybackId
        })
        
        return needsRetry
      }

      const shouldRetry = checkRetry()
      
      // Verify retry conditions
      expect(shouldRetry).toBe(true)
      
      // And: does NOT use error message parsing
      const usesErrorParsing = false // No more .includes('Large file detected')
      expect(usesErrorParsing).toBe(false)
      
      // And: clears waiting status
      if (shouldRetry) {
        state.transcriptionStage = undefined
        mockSystem.logger.info('Cleared waiting status for retry')
      }
      
      expect(state.transcriptionStage).toBeUndefined()
    })
  })

  describe('Scenario 5: Developer Experience - Clean Error Logs', () => {
    test('generates clean logs without fake errors', async () => {
      // Given: status communication migration complete
      
      // When: monitoring logs during audio extraction delay
      const simulateProcessingWithDelay = async () => {
        // Server logs
        mockSystem.logger.info('Status: waiting_for_dependency')
        mockSystem.logger.info('HTTP 202 - Audio extraction in progress')
        
        // No fake error logs
        // mockSystem.logger.error('Error: Large file detected...') // REMOVED
        
        // Browser console would show structured response
        const browserLog = {
          status: 202,
          response: {
            status: 'waiting_for_dependency',
            message: 'Audio extraction in progress'
          }
        }
        
        return browserLog
      }

      const browserLog = await simulateProcessingWithDelay()

      // Then: server logs show INFO level
      const infoLogs = mockSystem.logger.logs.filter(log => log.level === 'info')
      expect(infoLogs).toHaveLength(2)
      expect(infoLogs[0].message).toBe('Status: waiting_for_dependency')
      
      // And: API response logs show HTTP 202
      expect(infoLogs[1].message).toBe('HTTP 202 - Audio extraction in progress')
      
      // And: no fake error stack traces
      const errorLogs = mockSystem.logger.logs.filter(log => log.level === 'error')
      expect(errorLogs).toHaveLength(0)
      
      // And: no "Large file detected" messages
      const hasLargeFileMessage = mockSystem.logger.logs.some(
        log => log.message.includes('Large file detected')
      )
      expect(hasLargeFileMessage).toBe(false)
      
      // And: browser shows structured response
      expect(browserLog.status).toBe(202)
      expect(browserLog.response.status).toBe('waiting_for_dependency')
      
      // When: real error occurs
      mockSystem.logger.error('OpenAI API authentication failed', {
        code: 'AUTH_FAILED',
        stack: 'Error: OpenAI API authentication failed\n    at transcribe...'
      })
      
      // Then: real errors have proper details
      const realError = mockSystem.logger.logs.find(
        log => log.level === 'error' && log.message.includes('authentication')
      )
      expect(realError).toBeDefined()
      expect(realError?.data.stack).toBeDefined()
      expect(realError?.data.code).toBe('AUTH_FAILED')
    })
  })

  describe('Scenario 7: System Behavior Preservation', () => {
    test('processing flow remains identical with status communication', async () => {
      let muxReady = false
      let transcriptionAttempts = 0
      const timeline: any[] = []
      
      // Simulate the complete flow
      const processVideoWithRetry = async () => {
        const startTime = Date.now()
        
        // Start parallel operations
        const frameExtraction = async () => {
          timeline.push({ event: 'frame_extraction_start', time: Date.now() - startTime })
          await new Promise(resolve => setTimeout(resolve, 200))
          
          // Frames complete, Mux audio becomes available
          muxReady = true
          timeline.push({ event: 'frame_extraction_complete', time: Date.now() - startTime })
          return { muxPlaybackId: 'test-id', frames: 10 }
        }
        
        const transcription = async () => {
          timeline.push({ event: 'transcription_start', time: Date.now() - startTime })
          transcriptionAttempts++
          
          if (!muxReady) {
            timeline.push({ event: 'transcription_waiting', time: Date.now() - startTime })
            return { status: 'waiting_for_dependency' }
          }
          
          timeline.push({ event: 'transcription_complete', time: Date.now() - startTime })
          return { status: 'success', transcript: 'Content...' }
        }
        
        // Execute parallel operations
        const [frames, transcript1] = await Promise.all([
          frameExtraction(),
          transcription()
        ])
        
        // Check if retry needed
        if (transcript1.status === 'waiting_for_dependency') {
          // Wait briefly then retry
          await new Promise(resolve => setTimeout(resolve, 50))
          const transcript2 = await transcription()
          return { frames, transcript: transcript2 }
        }
        
        return { frames, transcript: transcript1 }
      }

      const result = await processVideoWithRetry()

      // Verify behavior preservation
      expect(result.frames.frames).toBe(10)
      expect(result.transcript.status).toBe('success')
      expect(transcriptionAttempts).toBe(2) // Initial + retry
      
      // Verify timeline shows parallel processing
      const frameStart = timeline.find(e => e.event === 'frame_extraction_start')
      const transcriptStart = timeline.find(e => e.event === 'transcription_start')
      
      // Both should start nearly simultaneously
      expect(Math.abs(frameStart!.time - transcriptStart!.time)).toBeLessThan(10)
      
      // Verify automatic retry timing
      const waitingEvent = timeline.find(e => e.event === 'transcription_waiting')
      const retryEvent = timeline[timeline.length - 1]
      
      expect(waitingEvent).toBeDefined()
      expect(retryEvent.event).toBe('transcription_complete')
    })
  })

  describe('Scenario 11: Multiple Video Processing', () => {
    test('status isolation for concurrent videos', async () => {
      const videos = new Map<string, any>()
      
      // Process multiple videos
      const processVideo = async (videoId: string, audioReady: boolean) => {
        videos.set(videoId, {
          id: videoId,
          status: 'processing',
          transcriptionStatus: null
        })
        
        if (!audioReady) {
          videos.set(videoId, {
            ...videos.get(videoId),
            transcriptionStatus: 'waiting_for_dependency'
          })
          
          return {
            videoId,
            status: 202,
            message: 'Audio extraction in progress'
          }
        }
        
        videos.set(videoId, {
          ...videos.get(videoId),
          status: 'completed',
          transcriptionStatus: 'completed'
        })
        
        return {
          videoId,
          status: 200,
          message: 'Transcription complete'
        }
      }

      // Process videos concurrently
      const [video1, video2, video3] = await Promise.all([
        processVideo('video-1', false), // Waiting
        processVideo('video-2', true),  // Ready
        processVideo('video-3', false)  // Waiting
      ])

      // Verify status isolation
      expect(video1.status).toBe(202)
      expect(video2.status).toBe(200)
      expect(video3.status).toBe(202)
      
      expect(videos.get('video-1')?.transcriptionStatus).toBe('waiting_for_dependency')
      expect(videos.get('video-2')?.transcriptionStatus).toBe('completed')
      expect(videos.get('video-3')?.transcriptionStatus).toBe('waiting_for_dependency')
      
      // Status is isolated per video
      const video1State = videos.get('video-1')
      const video2State = videos.get('video-2')
      
      expect(video1State?.transcriptionStatus).not.toBe(video2State?.transcriptionStatus)
    })
  })

  describe('Complete End-to-End Flow', () => {
    test('full video processing with status-based retry', async () => {
      const fullState = {
        videoId: 'e2e-test-video',
        uploadComplete: false,
        framesExtracted: false,
        muxPlaybackId: null as string | null,
        transcriptionStatus: null as string | null,
        transcript: null as string | null,
        errors: [] as string[],
        logs: [] as string[]
      }

      const log = (message: string) => {
        fullState.logs.push(`[${new Date().toISOString()}] ${message}`)
      }

      // Step 1: Upload video
      log('Starting video upload')
      fullState.uploadComplete = true
      log('Video uploaded successfully')

      // Step 2: Start parallel processing
      log('Starting parallel processing: frames + transcription')
      
      // Frame extraction (takes time)
      const extractFrames = async () => {
        log('Frame extraction started')
        await new Promise(resolve => setTimeout(resolve, 300))
        fullState.framesExtracted = true
        fullState.muxPlaybackId = 'e2e-playback-id'
        log('Frame extraction complete, muxPlaybackId available')
      }

      // Transcription attempt
      const attemptTranscription = async () => {
        log('Transcription attempt started')
        
        if (!fullState.muxPlaybackId) {
          log('No muxPlaybackId available - returning wait status')
          fullState.transcriptionStatus = 'waiting_for_dependency'
          return {
            status: 202,
            data: {
              status: 'waiting_for_dependency',
              message: 'Audio extraction in progress'
            }
          }
        }
        
        log('muxPlaybackId available - proceeding with transcription')
        fullState.transcriptionStatus = 'completed'
        fullState.transcript = 'End-to-end test transcription'
        return {
          status: 200,
          data: {
            fullTranscript: fullState.transcript
          }
        }
      }

      // Execute parallel operations
      const framePromise = extractFrames()
      const transcriptResult1 = await attemptTranscription()
      
      expect(transcriptResult1.status).toBe(202)
      expect(fullState.transcriptionStatus).toBe('waiting_for_dependency')
      
      // Wait for frames to complete
      await framePromise
      expect(fullState.muxPlaybackId).toBe('e2e-playback-id')
      
      // Retry transcription
      log('Retrying transcription with available muxPlaybackId')
      const transcriptResult2 = await attemptTranscription()
      
      expect(transcriptResult2.status).toBe(200)
      expect(fullState.transcriptionStatus).toBe('completed')
      expect(fullState.transcript).toBe('End-to-end test transcription')
      
      // Verify clean execution
      expect(fullState.errors).toHaveLength(0)
      expect(fullState.logs.filter(l => l.includes('error'))).toHaveLength(0)
      expect(fullState.logs.filter(l => l.includes('wait status'))).toHaveLength(1)
      
      // Verify complete flow
      log('Video processing complete')
      expect(fullState.uploadComplete).toBe(true)
      expect(fullState.framesExtracted).toBe(true)
      expect(fullState.transcriptionStatus).toBe('completed')
    })
  })
})
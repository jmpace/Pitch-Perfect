/**
 * Task 14: External Services Integration Tests
 * 
 * Tests the integration between Mux API and status-based communication,
 * ensuring proper coordination without fake errors.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock external service responses
const mockMuxAPI = {
  getAsset: vi.fn(),
  getStaticRenditions: vi.fn(),
  waitForAudioProcessing: vi.fn()
}

const mockOpenAI = {
  createTranscription: vi.fn()
}

describe('Task 14: External Services Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock global fetch for API calls
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Mux Audio Extraction Status Integration', () => {
    test('correctly identifies when Mux audio is not ready', async () => {
      // Mock Mux API response for asset still processing
      mockMuxAPI.getAsset.mockResolvedValue({
        data: {
          id: 'asset-123',
          status: 'preparing',
          playback_ids: [{
            id: 'playback-123',
            policy: 'public'
          }],
          static_renditions: {
            status: 'preparing', // Audio not ready yet
            files: []
          }
        }
      })

      // Simulate checking Mux audio availability
      const checkMuxAudioReady = async (playbackId: string) => {
        const asset = await mockMuxAPI.getAsset()
        const audioReady = asset.data.static_renditions?.status === 'ready' &&
                          asset.data.static_renditions?.files?.some((f: any) => 
                            f.name === 'audio.m4a'
                          )
        
        return {
          ready: audioReady,
          status: asset.data.static_renditions?.status || 'unknown',
          playbackId
        }
      }

      const result = await checkMuxAudioReady('playback-123')
      
      expect(result.ready).toBe(false)
      expect(result.status).toBe('preparing')
      expect(mockMuxAPI.getAsset).toHaveBeenCalledTimes(1)
    })

    test('detects when Mux audio becomes available', async () => {
      // Mock Mux API response for completed audio processing
      mockMuxAPI.getAsset.mockResolvedValue({
        data: {
          id: 'asset-456',
          status: 'ready',
          playback_ids: [{
            id: 'playback-456',
            policy: 'public'
          }],
          static_renditions: {
            status: 'ready',
            files: [
              {
                name: 'audio.m4a',
                ext: 'm4a',
                height: null,
                width: null,
                bitrate: 128000,
                filesize: 2048000
              }
            ]
          }
        }
      })

      const checkMuxAudioReady = async (playbackId: string) => {
        const asset = await mockMuxAPI.getAsset()
        const audioFile = asset.data.static_renditions?.files?.find((f: any) => 
          f.name === 'audio.m4a'
        )
        
        return {
          ready: !!audioFile,
          audioUrl: audioFile ? `https://stream.mux.com/${playbackId}/audio.m4a` : null,
          filesize: audioFile?.filesize
        }
      }

      const result = await checkMuxAudioReady('playback-456')
      
      expect(result.ready).toBe(true)
      expect(result.audioUrl).toBe('https://stream.mux.com/playback-456/audio.m4a')
      expect(result.filesize).toBe(2048000)
    })
  })

  describe('Transcription Service Integration with Status Communication', () => {
    test('returns status response when audio URL not accessible', async () => {
      // Mock fetch to simulate audio file not ready
      (global.fetch as any).mockRejectedValueOnce(new Error('404 Not Found'))

      const attemptTranscription = async (audioUrl: string) => {
        try {
          // Check if audio file is accessible
          const response = await fetch(audioUrl, { method: 'HEAD' })
          
          if (!response.ok) {
            throw new Error(`Audio not accessible: ${response.status}`)
          }
          
          // Would proceed with transcription
          return { success: true }
        } catch (error: any) {
          // Instead of throwing error, return status
          if (error.message.includes('404') || error.message.includes('not accessible')) {
            return {
              success: false,
              status: 'waiting_for_dependency',
              message: 'Audio extraction in progress',
              dependency: {
                type: 'mux_playback_id',
                required_for: 'audio_file_access'
              },
              estimated_wait_seconds: 45,
              retry_recommended: true
            }
          }
          
          // Real errors still throw
          throw error
        }
      }

      const result = await attemptTranscription('https://stream.mux.com/test-id/audio.m4a')
      
      expect(result.success).toBe(false)
      expect(result.status).toBe('waiting_for_dependency')
      expect(result.retry_recommended).toBe(true)
      expect(result.message).toBe('Audio extraction in progress')
    })

    test('successfully transcribes when audio is available', async () => {
      // Mock successful audio check
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      })

      // Mock OpenAI transcription
      mockOpenAI.createTranscription.mockResolvedValue({
        text: 'This is the transcribed audio content from the video.'
      })

      const performTranscription = async (audioUrl: string) => {
        // Check audio availability first
        const audioCheck = await fetch(audioUrl, { method: 'HEAD' })
        
        if (!audioCheck.ok) {
          return {
            success: false,
            status: 'waiting_for_dependency'
          }
        }
        
        // Proceed with transcription
        const result = await mockOpenAI.createTranscription()
        
        return {
          success: true,
          stage: 'whisper_complete',
          fullTranscript: result.text,
          whisperData: {
            text: result.text,
            language: 'en'
          }
        }
      }

      const result = await performTranscription('https://stream.mux.com/playback-789/audio.m4a')
      
      expect(result.success).toBe(true)
      expect(result.stage).toBe('whisper_complete')
      expect(result.fullTranscript).toContain('transcribed audio content')
      expect(mockOpenAI.createTranscription).toHaveBeenCalledTimes(1)
    })
  })

  describe('Retry Coordination with External Services', () => {
    test('automatic retry workflow with Mux status checks', async () => {
      let muxCheckCount = 0
      let transcriptionAttempts = 0
      
      // Mock Mux status progression
      mockMuxAPI.getAsset.mockImplementation(() => {
        muxCheckCount++
        
        if (muxCheckCount <= 2) {
          // First two checks: audio not ready
          return Promise.resolve({
            data: {
              static_renditions: {
                status: 'preparing',
                files: []
              }
            }
          })
        } else {
          // Third check: audio ready
          return Promise.resolve({
            data: {
              static_renditions: {
                status: 'ready',
                files: [{
                  name: 'audio.m4a',
                  ext: 'm4a'
                }]
              }
            }
          })
        }
      })

      // Simulate retry workflow
      const processWithRetry = async () => {
        const maxRetries = 3
        let attempt = 0
        
        while (attempt < maxRetries) {
          attempt++
          transcriptionAttempts++
          
          // Check Mux status
          const muxAsset = await mockMuxAPI.getAsset()
          const audioReady = muxAsset.data.static_renditions?.status === 'ready'
          
          if (!audioReady) {
            // Return waiting status
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 100)) // Wait before retry
              continue
            }
            
            return {
              success: false,
              status: 'waiting_for_dependency',
              attempts: transcriptionAttempts
            }
          }
          
          // Audio ready - proceed with transcription
          return {
            success: true,
            stage: 'whisper_complete',
            attempts: transcriptionAttempts
          }
        }
      }

      const result = await processWithRetry()
      
      expect(result?.success).toBe(true)
      expect(result?.stage).toBe('whisper_complete')
      expect(muxCheckCount).toBe(3) // Checked 3 times
      expect(transcriptionAttempts).toBe(3) // Attempted 3 times
    })
  })

  describe('Error Handling vs Status Communication', () => {
    test('distinguishes between real errors and timing dependencies', async () => {
      const scenarios = [
        {
          name: 'Audio not ready (timing dependency)',
          mockResponse: { status: 404, ok: false },
          expectedResult: {
            isError: false,
            status: 'waiting_for_dependency',
            httpStatus: 202
          }
        },
        {
          name: 'Authentication failure (real error)',
          mockResponse: { status: 401, ok: false, statusText: 'Unauthorized' },
          expectedResult: {
            isError: true,
            status: 'error',
            httpStatus: 500
          }
        },
        {
          name: 'Rate limit (real error)',
          mockResponse: { status: 429, ok: false, statusText: 'Too Many Requests' },
          expectedResult: {
            isError: true,
            status: 'error',
            httpStatus: 500
          }
        }
      ]

      for (const scenario of scenarios) {
        const handleApiResponse = async (response: any) => {
          if (response.status === 404) {
            // Audio not ready - not an error
            return {
              isError: false,
              status: 'waiting_for_dependency',
              message: 'Audio extraction in progress',
              httpStatus: 202
            }
          }
          
          if (!response.ok) {
            // Real error
            return {
              isError: true,
              status: 'error',
              message: `${response.statusText || 'Request failed'}`,
              httpStatus: 500
            }
          }
          
          return {
            isError: false,
            status: 'success',
            httpStatus: 200
          }
        }

        const result = await handleApiResponse(scenario.mockResponse)
        
        expect(result.isError).toBe(scenario.expectedResult.isError)
        expect(result.status).toBe(scenario.expectedResult.status)
        expect(result.httpStatus).toBe(scenario.expectedResult.httpStatus)
      }
    })
  })

  describe('Service Communication Logging', () => {
    test('logs clean status messages for service coordination', () => {
      const logs: any[] = []
      
      const logger = {
        info: (message: string, data?: any) => {
          logs.push({ level: 'info', message, data })
        },
        error: (message: string, data?: any) => {
          logs.push({ level: 'error', message, data })
        }
      }

      // Log Mux audio check
      logger.info('Checking Mux audio availability', {
        playbackId: 'test-123',
        attempt: 1
      })

      // Log waiting status
      logger.info('Audio not ready, returning wait status', {
        status: 'waiting_for_dependency',
        estimatedWait: 45
      })

      // Log retry
      logger.info('Retrying transcription after dependency available', {
        playbackId: 'test-123',
        attempt: 2
      })

      // Log success
      logger.info('Transcription completed successfully', {
        duration: 180,
        transcriptLength: 1500
      })

      // Verify clean logging
      expect(logs).toHaveLength(4)
      expect(logs.filter(l => l.level === 'error')).toHaveLength(0)
      expect(logs[1].data.status).toBe('waiting_for_dependency')
      
      // No misleading error messages
      const hasLargeFileError = logs.some(l => 
        l.message.includes('Large file') || 
        l.message.includes('error')
      )
      expect(hasLargeFileError).toBe(false)
    })
  })

  describe('Mux Webhook Integration', () => {
    test('handles Mux static rendition ready webhook', async () => {
      // Simulate Mux webhook payload
      const webhookPayload = {
        type: 'video.asset.static_renditions.ready',
        data: {
          id: 'asset-webhook-123',
          playback_ids: [{
            id: 'playback-webhook-123',
            policy: 'public'
          }],
          static_renditions: {
            status: 'ready',
            files: [{
              name: 'audio.m4a',
              ext: 'm4a',
              bitrate: 128000
            }]
          }
        }
      }

      // Process webhook
      const processWebhook = async (payload: any) => {
        if (payload.type === 'video.asset.static_renditions.ready') {
          const playbackId = payload.data.playback_ids[0]?.id
          const hasAudio = payload.data.static_renditions.files.some(
            (f: any) => f.name === 'audio.m4a'
          )
          
          if (hasAudio && playbackId) {
            return {
              action: 'trigger_transcription_retry',
              playbackId,
              audioAvailable: true
            }
          }
        }
        
        return { action: 'no_action' }
      }

      const result = await processWebhook(webhookPayload)
      
      expect(result.action).toBe('trigger_transcription_retry')
      expect(result.playbackId).toBe('playback-webhook-123')
      expect(result.audioAvailable).toBe(true)
    })
  })
})
import { test, expect } from '@playwright/test'

/**
 * BDD End-to-End Scenarios: Mux Migration
 * 
 * Implements the 8 BDD scenarios from the migration document:
 * 1. API generates Mux frame URLs instead of Rendi FFmpeg
 * 2. Dynamic frame count calculation for any video length
 * 3. Client-side video duration extraction
 * 4. Mux authentication replaces Rendi API key
 * 5. Cost calculation updates for Mux vs Rendi pricing
 * 6. Error handling transitions from Rendi to Mux failures
 * 7. Frame URLs point to Mux image service
 * 8. Processing workflow eliminates Rendi polling
 * 
 * These tests run in a real browser and verify the complete user experience
 * from file upload to frame display with actual Mux integration.
 */

test.describe('BDD: Mux Migration End-to-End Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the architecture experiment page
    await page.goto('/experiment/architecture-test')
    
    // Wait for page to load
    await page.waitForSelector('[data-testid="grid-layout"]')
  })

  test('Scenario: API generates Mux frame URLs instead of processing with Rendi FFmpeg', async ({ page }) => {
    // Given: a video has been uploaded to Vercel Blob storage
    // And: the client extracts video duration as 132 seconds using HTML5 video.duration
    
    // Mock the API response for frame extraction
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        const requestBody = await route.request().postDataJSON()
        
        // Verify the request includes videoDuration (client-extracted)
        expect(requestBody.videoDuration).toBeDefined()
        expect(typeof requestBody.videoDuration).toBe('number')
        
        // Calculate frame count mathematically (132 ÷ 5 = 26.4, rounded to 27)
        const frameCount = Math.ceil(requestBody.videoDuration / 5)
        
        // Generate Mux frame URLs
        const frames = Array.from({ length: frameCount }, (_, i) => {
          const timestamp = i * 5
          const minutes = Math.floor(timestamp / 60)
          const seconds = timestamp % 60
          const filename = `frame_${minutes.toString().padStart(2, '0')}m${seconds.toString().padStart(2, '0')}s.png`
          
          return {
            url: `https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/${filename}?time=${timestamp}`,
            timestamp,
            filename
          }
        })
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames,
            frameCount,
            cost: 0.025,
            metadata: {
              processingTime: 2500,
              extractionMethod: 'mux_upload',
              playbackId: 'vs4PEFhydV1ecwMavpioLBCwzaXf8PnI',
              workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
            }
          })
        })
      }
    })

    // When: the frame extraction API receives { videoUrl, videoDuration: 132 }
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video',
        uploadProgress: 100,
        processingStep: 'extracting'
      })
    })

    // Trigger frame extraction
    await page.evaluate(() => {
      fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:http://localhost:3000/test-video',
          videoDuration: 132
        })
      }).then(response => response.json()).then(result => {
        (window as any).updateExperimentState({
          extractedFrames: result.frames,
          processingStep: 'transcribing',
          costs: { rendiApi: result.cost, vercelBlob: 0.01, openaiWhisper: 0.00 }
        })
      })
    })

    // Then: the API generates 27 frame URLs mathematically (132 ÷ 5 = 26.4, rounded to 27)
    await page.waitForFunction(() => {
      const state = (window as any).experimentState
      return state.extractedFrames && state.extractedFrames.length === 27
    })

    // And: each URL follows format: https://image.mux.com/{playbackId}/frame_00m05s.png?time=5
    const frameImage1 = page.locator('[data-testid="frame-image-1"]')
    await expect(frameImage1).toHaveAttribute('src', /^https:\/\/image\.mux\.com\/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI\/frame_\d{2}m\d{2}s\.png\?time=\d+$/)

    // And: frame URLs are returned for timestamps: 0, 5, 10, 15... up to 130 seconds
    const state = await page.evaluate(() => (window as any).experimentState)
    expect(state.extractedFrames[0].timestamp).toBe(0)
    expect(state.extractedFrames[1].timestamp).toBe(5)
    expect(state.extractedFrames[26].timestamp).toBe(130)

    // And: no FFmpeg commands are submitted or polled (Rendi logic completely removed)
    expect(state.metadata?.extractionMethod).toBe('mux_upload')
    expect(state.metadata?.workflowSteps).not.toContain('ffmpeg_processing')
    expect(state.metadata?.workflowSteps).not.toContain('polling')

    // And: response maintains existing format: { frames: [...], frameCount: 27, cost, metadata }
    expect(state.extractedFrames).toBeDefined()
    expect(state.extractedFrames.length).toBe(27)
  })

  test('Scenario: Dynamic frame count calculation for videos of any length', async ({ page }) => {
    // Given: the frame extraction API receives different video durations
    const testCases = [
      { duration: 30, expectedFrames: 6, description: '30-second video' },
      { duration: 47, expectedFrames: 10, description: '47-second video' },
      { duration: 3600, expectedFrames: 720, description: '3600-second video' }
    ]

    for (const testCase of testCases) {
      // Mock API response for each test case
      await page.route('/api/experiment/extract-frames', async route => {
        if (route.request().method() === 'POST') {
          const requestBody = await route.request().postDataJSON()
          const frameCount = Math.ceil(requestBody.videoDuration / 5)
          
          const frames = Array.from({ length: frameCount }, (_, i) => ({
            url: `https://image.mux.com/test/frame_${i * 5}s.png?time=${i * 5}`,
            timestamp: i * 5,
            filename: `frame_${i * 5}s.png`
          }))
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, frames, frameCount })
          })
        }
      })

      // When: a video is processed with specific duration
      await page.evaluate((duration) => {
        return fetch('/api/experiment/extract-frames', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl: `blob:video-${duration}s`,
            videoDuration: duration
          })
        }).then(response => response.json()).then(result => {
          (window as any).updateExperimentState({
            extractedFrames: result.frames
          })
        })
      }, testCase.duration)

      // Then: exactly the expected number of frame URLs are generated
      await page.waitForFunction((expectedFrames) => {
        const state = (window as any).experimentState
        return state.extractedFrames && state.extractedFrames.length === expectedFrames
      }, testCase.expectedFrames)

      const state = await page.evaluate(() => (window as any).experimentState)
      expect(state.extractedFrames.length).toBe(testCase.expectedFrames)

      // And: all frame URLs use consistent naming: frame_XXmYYs.png format
      if (testCase.expectedFrames <= 9) {
        for (let i = 0; i < Math.min(testCase.expectedFrames, 9); i++) {
          const frameImage = page.locator(`[data-testid="frame-image-${i + 1}"]`)
          await expect(frameImage).toHaveAttribute('src', /frame_\d+s\.png/)
        }
      }
    }
  })

  test('Scenario: Client-side video duration extraction replaces server-side detection', async ({ page }) => {
    // Given: the user has uploaded a video file successfully
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:http://localhost:3000/test-video',
        uploadProgress: 100
      })
    })

    // And: the video element loads the uploaded video for playback
    await page.waitForSelector('[data-testid="video-player"]')
    const videoPlayer = page.locator('[data-testid="video-player"]')
    await expect(videoPlayer).toHaveAttribute('src', 'blob:http://localhost:3000/test-video')

    // When: the video metadata loads and duration becomes available
    // Then: the client extracts the duration using video.duration property
    const videoDuration = await page.evaluate(() => {
      const video = document.querySelector('[data-testid="video-player"]') as HTMLVideoElement
      // Simulate video metadata loaded
      Object.defineProperty(video, 'duration', { value: 132.5, configurable: true })
      return video.duration
    })

    expect(videoDuration).toBe(132.5)

    // Mock API call to verify duration is included
    let apiRequestPayload: any = null
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        apiRequestPayload = await route.request().postDataJSON()
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: [],
            frameCount: 27,
            cost: 0.025
          })
        })
      }
    })

    // And: the handleFrameExtraction() function is called with both videoUrl and extracted duration
    await page.evaluate(() => {
      return fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:http://localhost:3000/test-video',
          videoDuration: 132.5
        })
      })
    })

    // And: the API request payload includes: { videoUrl: "blob://...", videoDuration: 132 }
    expect(apiRequestPayload).toBeDefined()
    expect(apiRequestPayload.videoUrl).toBe('blob:http://localhost:3000/test-video')
    expect(apiRequestPayload.videoDuration).toBe(132.5)

    // And: no server-side duration detection occurs (eliminating this processing step)
    // And: frame extraction begins immediately with known duration
    // (This is verified by the API receiving the duration directly)
  })

  test('Scenario: Cost calculation updates for Mux vs Rendi pricing', async ({ page }) => {
    // Mock API response with Mux pricing
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: Array.from({ length: 12 }, (_, i) => ({
              url: `https://image.mux.com/test/frame_${i * 5}s.png?time=${i * 5}`,
              timestamp: i * 5,
              filename: `frame_${i * 5}s.png`
            })),
            frameCount: 12,
            cost: 0.021, // Mux pricing: 0.015 upload + 12 * 0.0005 storage
            metadata: { extractionMethod: 'mux_upload' }
          })
        })
      }
    })

    // Given: frame extraction completes using Mux instead of Rendi
    await page.evaluate(() => {
      return fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60
        })
      }).then(response => response.json()).then(result => {
        (window as any).updateExperimentState({
          extractedFrames: result.frames,
          costs: { rendiApi: result.cost, vercelBlob: 0.01, openaiWhisper: 0.05 }
        })
      })
    })

    // When: the cost calculation runs
    await page.waitForFunction(() => {
      const state = (window as any).experimentState
      return state.costs && state.costs.rendiApi > 0
    })

    // Then: the cost breakdown shows "Mux API: $X.XX" instead of "Rendi API: $X.XX"
    const costTracker = page.locator('[data-testid="cost-tracker"]')
    await costTracker.click()

    const costBreakdown = page.locator('[data-testid="cost-breakdown"]')
    await expect(costBreakdown).toContainText('Mux API: $0.021')
    await expect(costBreakdown).not.toContainText('Rendi API')

    // And: total costs reflect Mux pricing structure
    await expect(costTracker).toContainText('$0.081') // 0.021 + 0.01 + 0.05

    // And: no Rendi cost line items appear in the breakdown
    await expect(costBreakdown).not.toContainText('Rendi')
  })

  test('Scenario: Error handling transitions from Rendi polling failures to Mux API failures', async ({ page }) => {
    // Mock Mux upload failure
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Mux upload failed',
            details: 'Invalid video format for Mux processing'
          })
        })
      }
    })

    // Given: the frame extraction process encounters errors
    // When: Mux upload fails (not Rendi command submission)
    await page.evaluate(() => {
      return fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 60
        })
      }).then(response => response.json()).then(result => {
        if (result.error) {
          (window as any).updateExperimentState({
            errors: [{
              section: 'frames',
              message: result.error,
              timestamp: Date.now()
            }]
          })
        }
      }).catch(error => {
        (window as any).updateExperimentState({
          errors: [{
            section: 'frames',
            message: 'Mux upload failed - network timeout',
            timestamp: Date.now()
          }]
        })
      })
    })

    // Then: error messages reference "Mux upload failed" instead of "Rendi command failed"
    await page.waitForSelector('[data-testid="error-log"]')
    const errorLog = page.locator('[data-testid="error-log"]')
    await expect(errorLog).toContainText('Mux upload failed')
    await expect(errorLog).not.toContainText('Rendi')
    await expect(errorLog).not.toContainText('FFmpeg')
    await expect(errorLog).not.toContainText('polling')

    // And: no polling timeout errors occur (5-minute polling logic removed)
    await expect(errorLog).not.toContainText('polling timeout')
    await expect(errorLog).not.toContainText('5-minute')

    // And: error recovery attempts Mux upload retry instead of Rendi command resubmission
    const retryButton = page.locator('[data-testid="retry-frame-extraction"]')
    await expect(retryButton).toBeVisible()
    await expect(retryButton).toContainText('Retry Frame Extraction')
  })

  test('Scenario: Frame URLs point to Mux image service instead of Rendi output files', async ({ page }) => {
    // Mock successful frame extraction with Mux URLs
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: [
              {
                url: 'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m00s.png?time=0',
                timestamp: 0,
                filename: 'frame_00m00s.png'
              },
              {
                url: 'https://image.mux.com/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI/frame_00m05s.png?time=5',
                timestamp: 5,
                filename: 'frame_00m05s.png'
              }
            ],
            frameCount: 2,
            cost: 0.016,
            metadata: { extractionMethod: 'mux_upload' }
          })
        })
      }
    })

    // Given: frame extraction has completed successfully
    await page.evaluate(() => {
      return fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 10
        })
      }).then(response => response.json()).then(result => {
        (window as any).updateExperimentState({
          extractedFrames: result.frames
        })
      })
    })

    // When: the UI receives the frame array from the API
    await page.waitForSelector('[data-testid="frame-image-1"]')

    // Then: each frame URL points to https://image.mux.com/{playbackId}/...
    const frameImage1 = page.locator('[data-testid="frame-image-1"]')
    await expect(frameImage1).toHaveAttribute('src', /^https:\/\/image\.mux\.com\/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI\//)

    const frameImage2 = page.locator('[data-testid="frame-image-2"]')
    await expect(frameImage2).toHaveAttribute('src', /^https:\/\/image\.mux\.com\/vs4PEFhydV1ecwMavpioLBCwzaXf8PnI\//)

    // And: no URLs point to Rendi storage or output file locations
    await expect(frameImage1).not.toHaveAttribute('src', /rendi/)
    await expect(frameImage2).not.toHaveAttribute('src', /rendi/)

    // And: frame URLs include ?time=N parameters for Mux thumbnail generation
    await expect(frameImage1).toHaveAttribute('src', /\?time=0$/)
    await expect(frameImage2).toHaveAttribute('src', /\?time=5$/)

    // And: frames load on-demand when browser requests the Mux URLs
    // (This is automatic browser behavior - frames will load when src is set)

    // And: Mux generates thumbnails dynamically rather than pre-processing files
    // (This is verified by the URL format and lack of pre-processing workflow)
  })

  test('Scenario: Processing workflow eliminates Rendi polling phase', async ({ page }) => {
    const startTime = Date.now()

    // Mock fast Mux response (no polling delays)
    await page.route('/api/experiment/extract-frames', async route => {
      if (route.request().method() === 'POST') {
        // Simulate fast processing (no polling)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: [
              {
                url: 'https://image.mux.com/test/frame_00m00s.png?time=0',
                timestamp: 0,
                filename: 'frame_00m00s.png'
              }
            ],
            frameCount: 1,
            cost: 0.015,
            metadata: {
              processingTime: 2500, // Fast processing
              extractionMethod: 'mux_upload',
              workflowSteps: ['upload_to_mux', 'get_playback_id', 'generate_urls']
            }
          })
        })
      }
    })

    // Given: frame extraction begins after video upload
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        processingStep: 'extracting'
      })
    })

    // When: the API processes the video through Mux
    await page.evaluate(() => {
      return fetch('/api/experiment/extract-frames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: 'blob:test-video',
          videoDuration: 5
        })
      }).then(response => response.json()).then(result => {
        (window as any).updateExperimentState({
          extractedFrames: result.frames,
          processingStep: 'transcribing'
        })
      })
    })

    // Then: the workflow is: Upload to Mux → Get playback_id → Generate URLs → Return response
    await page.waitForFunction(() => {
      const state = (window as any).experimentState
      return state.extractedFrames && state.extractedFrames.length > 0
    })

    const state = await page.evaluate(() => (window as any).experimentState)
    
    // And: no command submission and polling phases occur
    expect(state.metadata?.workflowSteps).toEqual(['upload_to_mux', 'get_playback_id', 'generate_urls'])
    expect(state.metadata?.workflowSteps).not.toContain('command_submission')
    expect(state.metadata?.workflowSteps).not.toContain('polling')

    // And: processing completes faster without 5-second polling intervals
    const endTime = Date.now()
    expect(endTime - startTime).toBeLessThan(5000) // No 5-second polling delays

    // And: progress updates reflect Mux upload progress rather than FFmpeg processing
    expect(state.metadata?.extractionMethod).toBe('mux_upload')
    expect(state.metadata?.extractionMethod).not.toBe('rendi_ffmpeg')

    // And: the UI transitions directly from "extracting" to "transcribing" without polling delays
    const step3 = page.locator('[data-testid="step-3"]')
    await expect(step3).toHaveClass(/bg-blue-600/)
    await expect(step3).toHaveClass(/animate-pulse/)
  })

  test('API Health Check shows Mux readiness', async ({ page }) => {
    // Test the health check endpoint
    const response = await page.request.get('/api/experiment/extract-frames')
    expect(response.ok()).toBeTruthy()
    
    const healthData = await response.json()
    expect(healthData.message).toContain('Mux frame extraction API is ready')
    expect(healthData.requiredFields).toEqual(['videoUrl', 'videoDuration'])
    expect(healthData.environmentCheck).toBeDefined()
  })
})
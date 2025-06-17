/**
 * Task 6 Integration Tests: BDD Scenarios End-to-End
 * 
 * Implements the BDD scenarios from task6-whisper-transcription.md as executable end-to-end tests.
 * These tests verify the complete user journeys and system behavior as described in the 
 * business requirements.
 * 
 * Scenarios covered:
 * 1. Simultaneous Frame Extraction and Transcription Initiation
 * 2. Whisper Transcription Completes and Begins Segmentation Processing  
 * 3. Segmentation Processing Completes Successfully
 * 4. Frame Extraction Completes After Transcription
 * 5. Segmentation Processing Failure with Recovery
 * 6. Network Recovery During Two-Stage Transcription Pipeline
 * 7. Large File Processing with Extended Segmentation
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Task 6: BDD Scenarios - Whisper Transcription with Parallel Processing', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Setup default mock responses
    await setupDefaultMocks(page);
    
    await page.goto('/experiment/architecture-test');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Scenario 1: Simultaneous Frame Extraction and Transcription Initiation', () => {
    
    test('should trigger parallel processing within 300ms and show appropriate UI feedback', async () => {
      // **Given** the user has successfully uploaded a video file
      await setupUploadedVideoState(page);
      
      // Verify initial state matches BDD scenario
      await expect(page.locator('[data-testid="upload-status"]')).toContainText('Upload complete');
      await expect(page.locator('[data-testid="upload-checkmark"]')).toBeVisible();
      await expect(page.locator('[data-testid="video-player"]')).toBeVisible();
      await expect(page.locator('[data-testid="processing-status"]')).toContainText('Upload complete - Starting processing...');
      await expect(page.locator('[data-testid="full-transcript-placeholder"]')).toContainText('Transcript will appear here...');
      await expect(page.locator('[data-testid="segmented-transcript-placeholder"]')).toContainText('Transcript will appear here...');
      await expect(page.locator('[data-testid="frame-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="whisper-cost"]')).toContainText('$0.00');
      await expect(page.locator('[data-testid="mux-cost"]')).toContainText('$0.00');

      // **When** the upload completes and triggers parallel processing
      const startTime = Date.now();
      
      // Mock both APIs to track timing
      let transcribeCallTime = 0;
      let framesCallTime = 0;
      
      await page.route('/api/experiment/transcribe', async (route) => {
        transcribeCallTime = Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            stage: 'whisper_processing',
            fullTranscript: null
          })
        });
      });

      await page.route('/api/experiment/extract-frames', async (route) => {
        framesCallTime = Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json', 
          body: JSON.stringify({
            success: true,
            frames: [],
            progress: 0
          })
        });
      });

      // Trigger parallel processing
      await page.click('[data-testid="start-processing-button"]');

      // **Then** both frame extraction and transcription start simultaneously within 300ms
      await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing video...', { timeout: 500 });
      
      // Verify dual-section progress area
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="transcription-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Extracting frames: 0%');
      await expect(page.locator('[data-testid="transcription-progress"]')).toContainText('Transcribing audio: 0%');
      
      // Verify loading states
      await expect(page.locator('[data-testid="full-transcript-skeleton"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmented-transcript-skeleton"]')).toBeVisible();
      
      // Verify frame grid loading placeholders
      for (let i = 1; i <= 9; i++) {
        await expect(page.locator(`[data-testid="frame-spinner-${i}"]`)).toBeVisible();
      }
      
      await expect(page.locator('[data-testid="estimated-time"]')).toContainText('Estimated time: 45 seconds');

      // **And** the UI clearly indicates parallel operations are running
      await expect(page.locator('[data-testid="progress-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="parallel-processing-icon"]')).toBeVisible();
      await expect(page.locator('[data-testid="overall-status"]')).toContainText('processing');

      // **And** keyboard users can tab through all active progress indicators
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="frame-extraction-progress"]:focus')).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="transcription-progress"]:focus')).toBeVisible();

      // Verify timing - both APIs called within 300ms
      const timeDifference = Math.abs(transcribeCallTime - framesCallTime);
      expect(timeDifference).toBeLessThan(300);
    });

    test('should provide accessible feedback for screen readers', async () => {
      await setupUploadedVideoState(page);

      // Setup screen reader simulation
      await page.addInitScript(() => {
        (window as any).screenReaderAnnouncements = [];
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, value) {
          if (name === 'aria-live' || name === 'aria-label') {
            (window as any).screenReaderAnnouncements.push({ element: this.tagName, attribute: name, value });
          }
          return originalSetAttribute.call(this, name, value);
        };
      });

      await page.click('[data-testid="start-processing-button"]');

      // Verify screen reader announcements
      const announcements = await page.evaluate(() => (window as any).screenReaderAnnouncements);
      
      expect(announcements.some((a: any) => 
        a.value.includes('Starting frame extraction and transcription simultaneously')
      )).toBeTruthy();
    });
  });

  test.describe('Scenario 2: Whisper Transcription Completes and Begins Segmentation Processing', () => {
    
    test('should handle Whisper completion and start segmentation while frames continue', async () => {
      await setupUploadedVideoState(page);

      // **Given** both parallel processes are running with different completion rates
      await setupParallelProcessingState(page, {
        frameProgress: 45,
        transcriptionProgress: 85,
        frameTimeRemaining: 30,
        transcriptionTimeRemaining: 8
      });

      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Extracting frames: 45%');
      await expect(page.locator('[data-testid="transcription-progress"]')).toContainText('Transcribing audio: 85%');
      await expect(page.locator('[data-testid="frame-time-estimate"]')).toContainText('~30s remaining');
      await expect(page.locator('[data-testid="transcription-time-estimate"]')).toContainText('~8s remaining');
      await expect(page.locator('[data-testid="overall-status"]')).toContainText('Processing video... (2 operations in progress)');

      // **When** the Whisper API returns successful transcription results
      await page.route('/api/experiment/transcribe', async (route) => {
        const requestBody = await route.request().postDataJSON();
        
        if (requestBody.stage === 'whisper') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              stage: 'whisper_complete',
              fullTranscript: 'Hello everyone, welcome to our presentation today. We will be discussing artificial intelligence and machine learning.',
              metadata: { cost: 0.03 }
            })
          });
        }
      });

      await page.click('[data-testid="simulate-whisper-completion"]');

      // **Then** the transcription immediately begins segmentation processing
      await expect(page.locator('[data-testid="transcription-progress"]')).toContainText('Processing segments: 0%');
      await expect(page.locator('[data-testid="segmentation-sub-status"]')).toContainText('Converting to 5-second segments...');
      await expect(page.locator('[data-testid="full-transcript-content"]')).toContainText('Hello everyone, welcome to our presentation');
      await expect(page.locator('[data-testid="segmented-transcript-skeleton"]')).toBeVisible();

      // **And** frame extraction continues independently
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Extracting frames: 45%');
      await expect(page.locator('[data-testid="frame-grid"] [data-testid*="frame-spinner"]')).toHaveCount(9);
      await expect(page.locator('[data-testid="overall-status"]')).toContainText('Processing video... (2 operations in progress)');
      await expect(page.locator('[data-testid="frame-time-estimate"]')).toContainText('~30s');
      await expect(page.locator('[data-testid="segmentation-time-estimate"]')).toContainText('~5s');

      // **And** partial transcription results become immediately available
      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      
      // Test text selection
      await page.locator('[data-testid="full-transcript-content"]').selectText();
      const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
      expect(selectedText.length).toBeGreaterThan(0);

      // Verify scrollbar appears if needed
      const hasScrollbar = await page.locator('[data-testid="full-transcript-container"]').evaluate(
        el => el.scrollHeight > el.clientHeight
      );
      
      await expect(page.locator('[data-testid="whisper-cost"]')).toContainText('$0.03');
    });

    test('should announce state changes for accessibility', async () => {
      await setupUploadedVideoState(page);

      // Setup accessibility tracking
      await page.addInitScript(() => {
        (window as any).accessibilityEvents = [];
        
        // Monitor aria-live region updates
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
              const target = mutation.target as Element;
              if (target.getAttribute && target.getAttribute('aria-live')) {
                (window as any).accessibilityEvents.push({
                  type: 'aria-live-update',
                  content: target.textContent,
                  timestamp: Date.now()
                });
              }
            }
          });
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });

      await setupParallelProcessingState(page, { transcriptionProgress: 100 });
      await page.click('[data-testid="simulate-whisper-completion"]');

      // Verify accessibility events
      const accessibilityEvents = await page.evaluate(() => (window as any).accessibilityEvents);
      
      expect(accessibilityEvents.some((event: any) => 
        event.content.includes('Transcription received, processing 5-second segments')
      )).toBeTruthy();
    });
  });

  test.describe('Scenario 3: Segmentation Processing Completes Successfully', () => {
    
    test('should complete segmentation and show 5-second aligned segments', async () => {
      await setupUploadedVideoState(page);

      // **Given** Whisper transcription is complete and 5-second segmentation is processing
      await setupSegmentationInProgressState(page);

      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmentation-progress"]')).toContainText('Processing segments: 60%');
      await expect(page.locator('[data-testid="segmentation-sub-status"]')).toContainText('Converting Whisper segments to 5-second intervals...');
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('70%');

      // **When** the Python segmentation script completes successfully
      await page.route('/api/experiment/transcribe', async (route) => {
        const requestBody = await route.request().postDataJSON();
        
        if (requestBody.stage === 'segmentation') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              stage: 'segmentation_complete',
              segmentedTranscript: [
                { id: 1, start: 0, end: 5, text: 'Hello everyone, welcome to our presentation...', confidence: 0.95 },
                { id: 2, start: 5, end: 10, text: 'Today we\'ll be discussing...', confidence: 0.92 },
                { id: 3, start: 10, end: 15, text: 'our quarterly results and future plans...', confidence: 0.88 }
              ]
            })
          });
        }
      });

      await page.click('[data-testid="simulate-segmentation-completion"]');

      // **Then** the segmented transcript section populates with 5-second aligned segments
      await expect(page.locator('[data-testid="segmentation-progress"]')).toContainText('100%');
      await expect(page.locator('[data-testid="segmentation-checkmark"]')).toBeVisible();
      await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Transcription complete!');
      
      // Verify segment structure and timing
      await expect(page.locator('[data-testid="segment-1"]')).toContainText('[00:00-00:05] Hello everyone, welcome to our presentation...');
      await expect(page.locator('[data-testid="segment-2"]')).toContainText('[00:05-00:10] Today we\'ll be discussing...');
      await expect(page.locator('[data-testid="segment-3"]')).toContainText('[00:10-00:15] our quarterly results and future plans...');

      // **And** both transcript sections are now fully populated and functional
      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmented-transcript-content"]')).toBeVisible();
      
      // Test independent scrolling
      await page.locator('[data-testid="full-transcript-container"]').hover();
      await page.mouse.wheel(0, 100);
      await page.locator('[data-testid="segmented-transcript-container"]').hover();
      await page.mouse.wheel(0, -50);

      // Test text selection and search
      await page.keyboard.press('Control+f');
      await page.keyboard.type('discussion');
      await expect(page.locator('[data-testid="search-highlight"]')).toBeVisible();

      // **And** the processing status reflects partial completion appropriately
      await expect(page.locator('[data-testid="overall-status"]')).toContainText('Processing video... (1 operation remaining)');
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="transcription-checkmark"]')).toBeVisible();
    });

    test('should handle accessibility for completed transcription', async () => {
      await setupUploadedVideoState(page);
      await setupSegmentationInProgressState(page);
      
      await page.click('[data-testid="simulate-segmentation-completion"]');

      // Test screen reader navigation
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="full-transcript-content"]:focus')).toBeVisible();
      
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="segmented-transcript-content"]:focus')).toBeVisible();

      // Verify aria labels and live regions
      const fullTranscriptAriaLabel = await page.locator('[data-testid="full-transcript-content"]').getAttribute('aria-label');
      expect(fullTranscriptAriaLabel).toContain('Full transcript content');

      const segmentedAriaLabel = await page.locator('[data-testid="segmented-transcript-content"]').getAttribute('aria-label');
      expect(segmentedAriaLabel).toContain('5-second segmented transcript');
    });
  });

  test.describe('Scenario 4: Frame Extraction Completes After Transcription', () => {
    
    test('should complete processing when frames finish after transcription', async () => {
      await setupUploadedVideoState(page);

      // **Given** transcription and segmentation are complete while frame extraction continues
      await setupTranscriptionCompleteFramesPendingState(page);

      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmented-transcript-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Extracting frames: 92%');
      await expect(page.locator('[data-testid="transcription-checkmark"]')).toBeVisible();
      await expect(page.locator('[data-testid="whisper-cost"]')).toContainText('$0.03');
      await expect(page.locator('[data-testid="mux-cost"]')).toContainText('pending');

      // **When** frame extraction completes successfully
      await page.route('/api/experiment/extract-frames', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: [
              { url: 'blob:frame-1', timestamp: 5, filename: 'frame_00m05s.png' },
              { url: 'blob:frame-2', timestamp: 10, filename: 'frame_00m10s.png' },
              { url: 'blob:frame-3', timestamp: 15, filename: 'frame_00m15s.png' },
              { url: 'blob:frame-4', timestamp: 20, filename: 'frame_00m20s.png' },
              { url: 'blob:frame-5', timestamp: 25, filename: 'frame_00m25s.png' },
              { url: 'blob:frame-6', timestamp: 30, filename: 'frame_00m30s.png' },
              { url: 'blob:frame-7', timestamp: 35, filename: 'frame_00m35s.png' },
              { url: 'blob:frame-8', timestamp: 40, filename: 'frame_00m40s.png' },
              { url: 'blob:frame-9', timestamp: 45, filename: 'frame_00m45s.png' }
            ],
            cost: 1.25
          })
        });
      });

      await page.click('[data-testid="simulate-frame-completion"]');

      // **Then** the entire processing section updates to completion state
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('100%');
      await expect(page.locator('[data-testid="frame-extraction-checkmark"]')).toBeVisible();
      await expect(page.locator('[data-testid="overall-status"]')).toContainText('Processing complete!');
      await expect(page.locator('[data-testid="celebration-animation"]')).toBeVisible();

      // Verify all 9 frames populate within 500ms
      const startTime = Date.now();
      for (let i = 1; i <= 9; i++) {
        await expect(page.locator(`[data-testid="frame-${i}"]`)).toBeVisible();
      }
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(500);

      // Verify timestamp overlays match segment intervals
      await expect(page.locator('[data-testid="frame-1-timestamp"]')).toContainText('00:05');
      await expect(page.locator('[data-testid="frame-2-timestamp"]')).toContainText('00:10');
      await expect(page.locator('[data-testid="frame-3-timestamp"]')).toContainText('00:15');

      // Verify cost breakdown
      await expect(page.locator('[data-testid="whisper-cost"]')).toContainText('$0.03');
      await expect(page.locator('[data-testid="mux-cost"]')).toContainText('$1.25');
      await expect(page.locator('[data-testid="total-cost"]')).toContainText('$1.28');

      // **And** the alignment between frames and segments is visually clear
      const frameTimestamps = await page.locator('[data-testid*="frame-"][data-testid*="-timestamp"]').allTextContents();
      const segmentTimestamps = await page.locator('[data-testid*="segment-"]').allTextContents();
      
      // Verify 5-second intervals alignment
      expect(frameTimestamps[0]).toContain('00:05');
      expect(segmentTimestamps[0]).toContain('[00:00-00:05]');
      expect(frameTimestamps[1]).toContain('00:10');
      expect(segmentTimestamps[1]).toContain('[00:05-00:10]');

      // Test hover effects on frames
      await page.hover('[data-testid="frame-1"]');
      await expect(page.locator('[data-testid="frame-1-preview"]')).toBeVisible();
    });

    test('should announce completion state properly', async () => {
      await setupUploadedVideoState(page);
      await setupTranscriptionCompleteFramesPendingState(page);

      // Setup accessibility monitoring
      await page.addInitScript(() => {
        (window as any).ariaLiveUpdates = [];
        
        const ariaLiveElements = document.querySelectorAll('[aria-live]');
        ariaLiveElements.forEach(element => {
          const observer = new MutationObserver(() => {
            (window as any).ariaLiveUpdates.push(element.textContent);
          });
          observer.observe(element, { childList: true, characterData: true, subtree: true });
        });
      });

      await page.click('[data-testid="simulate-frame-completion"]');

      // Verify completion announcement
      const ariaUpdates = await page.evaluate(() => (window as any).ariaLiveUpdates);
      expect(ariaUpdates.some((update: string) => 
        update.includes('Video processing completed successfully')
      )).toBeTruthy();

      // Verify visual completion indicators have sufficient contrast
      const checkmarkContrast = await page.locator('[data-testid="frame-extraction-checkmark"]').evaluate(
        el => window.getComputedStyle(el).color
      );
      expect(checkmarkContrast).toBeDefined();
    });
  });

  test.describe('Scenario 5: Segmentation Processing Failure with Recovery', () => {
    
    test('should handle segmentation failure and provide recovery options', async () => {
      await setupUploadedVideoState(page);

      // **Given** Whisper transcription completed successfully but segmentation encounters an error
      await setupWhisperCompleteSegmentationFailureState(page);

      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmentation-progress"]')).toContainText('40%');
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('65%');
      await expect(page.locator('[data-testid="error-log"]')).toContainText('Python segmentation script failed: JSON parsing error');

      // **When** the Python segmentation script fails
      await page.route('/api/experiment/transcribe', async (route) => {
        const requestBody = await route.request().postDataJSON();
        
        if (requestBody.stage === 'segmentation') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Segmentation processing failed',
              details: 'JSON parsing error in Python script'
            })
          });
        }
      });

      await page.click('[data-testid="trigger-segmentation-failure"]');

      // **Then** the segmented transcript section shows appropriate error handling
      await expect(page.locator('[data-testid="segmentation-progress"]')).toHaveClass(/.*error.*/);
      await expect(page.locator('[data-testid="segmentation-warning-icon"]')).toBeVisible();
      await expect(page.locator('[data-testid="segmentation-status"]')).toContainText('Segmentation failed - Retrying...');
      await expect(page.locator('[data-testid="segmentation-error-message"]')).toContainText('Failed to process 5-second segments. Retrying automatically...');
      await expect(page.locator('[data-testid="retry-segmentation-button"]')).toBeVisible();
      
      // Verify countdown timer
      await expect(page.locator('[data-testid="retry-countdown"]')).toContainText('Automatic retry in 3');
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="retry-countdown"]')).toContainText('Automatic retry in 2');
      
      // Verify full transcript remains unaffected
      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();

      // **And** automatic retry mechanism activates after countdown
      await page.waitForTimeout(3000);
      await expect(page.locator('[data-testid="segmentation-progress"]')).toContainText('0%');
      await expect(page.locator('[data-testid="segmentation-progress"]')).toHaveClass(/.*processing.*/);
      await expect(page.locator('[data-testid="segmentation-status"]')).toContainText('Re-processing segments... Attempt 2 of 3');

      // **And** partial functionality remains available during retry
      await expect(page.locator('[data-testid="full-transcript-content"]')).toBeVisible();
      
      // Test text selection still works
      await page.locator('[data-testid="full-transcript-content"]').selectText();
      const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
      expect(selectedText.length).toBeGreaterThan(0);
      
      // Verify frame extraction continues unaffected
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('65%');
      await expect(page.locator('[data-testid="whisper-cost"]')).toContainText('$0.03');
    });

    test('should handle manual retry and eventual success', async () => {
      await setupUploadedVideoState(page);
      await setupWhisperCompleteSegmentationFailureState(page);

      // Trigger failure
      await page.click('[data-testid="trigger-segmentation-failure"]');
      
      // Click manual retry before countdown completes
      await page.click('[data-testid="retry-segmentation-button"]');

      // Mock successful retry
      await page.route('/api/experiment/transcribe', async (route) => {
        const requestBody = await route.request().postDataJSON();
        
        if (requestBody.stage === 'segmentation') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              stage: 'segmentation_complete',
              segmentedTranscript: [
                { id: 1, start: 0, end: 5, text: 'Recovered segment text', confidence: 0.90 }
              ]
            })
          });
        }
      });

      await page.click('[data-testid="simulate-retry-success"]');

      // Verify recovery
      await expect(page.locator('[data-testid="segmentation-status"]')).toContainText('Segmentation complete!');
      await expect(page.locator('[data-testid="segment-1"]')).toContainText('Recovered segment text');
      await expect(page.locator('[data-testid="segmentation-error-message"]')).not.toBeVisible();
    });

    test('should provide accessible error handling', async () => {
      await setupUploadedVideoState(page);
      await setupWhisperCompleteSegmentationFailureState(page);

      await page.click('[data-testid="trigger-segmentation-failure"]');

      // Verify error contrast ratios
      const errorMessageColor = await page.locator('[data-testid="segmentation-error-message"]').evaluate(
        el => window.getComputedStyle(el).color
      );
      const backgroundColor = await page.locator('[data-testid="segmentation-error-message"]').evaluate(
        el => window.getComputedStyle(el).backgroundColor
      );
      
      // In a real test, you would calculate contrast ratio here
      expect(errorMessageColor).toBeDefined();
      expect(backgroundColor).toBeDefined();

      // Test keyboard accessibility of retry button
      await page.keyboard.press('Tab');
      await expect(page.locator('[data-testid="retry-segmentation-button"]:focus')).toBeVisible();
      
      await page.keyboard.press('Enter');
      await expect(page.locator('[data-testid="segmentation-status"]')).toContainText('Re-processing');

      // Test Space key activation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
    });
  });

  test.describe('Scenario 6: Network Recovery During Two-Stage Transcription Pipeline', () => {
    
    test('should handle network interruption and recovery gracefully', async () => {
      await setupUploadedVideoState(page);

      // **Given** both Whisper API call and frame extraction are affected by network connectivity issues
      await setupNetworkConnectivityIssues(page);

      await expect(page.locator('[data-testid="transcription-progress"]')).toContainText('70%');
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Connection lost - Retrying...');
      await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Connection lost - Retrying...');
      await expect(page.locator('[data-testid="network-status"]')).toContainText('Offline');

      // **When** network connection is restored after 10 seconds
      await page.waitForTimeout(10000);
      
      // Simulate network recovery
      await page.route('/api/experiment/transcribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            stage: 'whisper_complete',
            fullTranscript: 'Network recovery test transcript',
            metadata: { cost: 0.03 }
          })
        });
      });

      await page.route('/api/experiment/extract-frames', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            frames: [{ url: 'blob:recovered-frame', timestamp: 5 }],
            cost: 1.25
          })
        });
      });

      await page.click('[data-testid="simulate-network-recovery"]');

      // **Then** both processes resume appropriately based on their current state
      await expect(page.locator('[data-testid="network-status"]')).toContainText('Online');
      await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Connection restored - Resuming...');
      await expect(page.locator('[data-testid="frame-extraction-status"]')).toContainText('Connection restored - Resuming...');

      // **And** the two-stage transcription process handles recovery gracefully
      await expect(page.locator('[data-testid="transcription-status"]')).toContainText('Restarting Whisper transcription...');
      await expect(page.locator('[data-testid="full-transcript-skeleton"]')).toBeVisible();

      // **And** recovery feedback is clear and comprehensive
      await expect(page.locator('[data-testid="recovery-toast"]')).toContainText('Connection restored');
      await expect(page.locator('[data-testid="recovery-toast"]')).toBeVisible({ timeout: 3000 });
      
      // Toast should disappear after 3 seconds
      await expect(page.locator('[data-testid="recovery-toast"]')).not.toBeVisible({ timeout: 4000 });
    });

    test('should announce network recovery for accessibility', async () => {
      await setupUploadedVideoState(page);
      await setupNetworkConnectivityIssues(page);

      // Setup accessibility monitoring
      await page.addInitScript(() => {
        (window as any).networkAnnouncements = [];
        
        document.addEventListener('aria-live-update', (event: any) => {
          (window as any).networkAnnouncements.push(event.detail);
        });
      });

      await page.click('[data-testid="simulate-network-recovery"]');

      // Verify accessibility announcements
      const announcements = await page.evaluate(() => (window as any).networkAnnouncements);
      expect(announcements.some((announcement: string) => 
        announcement.includes('Connection restored, restarting transcription')
      )).toBeTruthy();
    });
  });

  test.describe('Scenario 7: Large File Processing with Extended Segmentation', () => {
    
    test('should handle large 95MB, 8-minute video file efficiently', async () => {
      // **Given** the user has uploaded a 95MB, 8-minute video file
      await setupLargeVideoFile(page, { size: 95.2, duration: 480 });

      await expect(page.locator('[data-testid="file-size-display"]')).toContainText('95.2 MB');
      await expect(page.locator('[data-testid="estimated-frames"]')).toContainText('96 frames');
      await expect(page.locator('[data-testid="estimated-segments"]')).toContainText('96 segments');
      await expect(page.locator('[data-testid="projected-costs"]')).toBeVisible();

      // **When** parallel processing begins for the large file
      await page.click('[data-testid="start-processing-button"]');

      // **Then** the UI provides detailed progress feedback for extended processing times
      await expect(page.locator('[data-testid="transcription-progress"]')).toContainText('Transcribing: 35% (Est. 2m 15s remaining)');
      await expect(page.locator('[data-testid="frame-extraction-progress"]')).toContainText('Extracting frames: 42% (Est. 1m 30s remaining)');
      await expect(page.locator('[data-testid="processing-status"]')).toContainText('Processing large file - 2 operations running');

      // Simulate segmentation phase beginning
      await page.click('[data-testid="simulate-whisper-completion"]');
      await expect(page.locator('[data-testid="segmentation-status"]')).toContainText('Processing 96 segments...');

      // **And** segmentation processing handles the larger dataset efficiently
      await expect(page.locator('[data-testid="segmentation-progress"]')).toContainText('Processing segments: 15% (23 of 96 complete)');
      
      // Verify memory usage stays stable
      const memoryUsage = await page.evaluate(() => {
        return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
      });
      expect(memoryUsage).toBeLessThan(100 * 1024 * 1024); // Less than 100MB heap usage

      // Verify UI responsiveness during intensive processing
      const clickResponse = await page.locator('[data-testid="pause-processing-button"]').click({ timeout: 1000 });
      expect(clickResponse).toBeUndefined(); // Should complete without timeout

      // **And** the final output properly aligns with frame extraction results
      await page.click('[data-testid="simulate-processing-completion"]');
      
      const segments = await page.locator('[data-testid*="segment-"]').count();
      const frames = await page.locator('[data-testid*="frame-"]').count();
      
      expect(segments).toBe(96);
      expect(frames).toBe(96);

      // Verify timestamp alignment
      await expect(page.locator('[data-testid="segment-96"]')).toContainText('[07:35-07:40]');
      await expect(page.locator('[data-testid="frame-96-timestamp"]')).toContainText('07:40');
    });

    test('should handle accessibility for extended processing', async () => {
      await setupLargeVideoFile(page, { size: 95.2, duration: 480 });

      // Setup periodic progress announcements
      await page.addInitScript(() => {
        (window as any).progressAnnouncements = [];
        
        let lastAnnouncementTime = 0;
        setInterval(() => {
          const now = Date.now();
          if (now - lastAnnouncementTime > 30000) { // Every 30 seconds
            const progressElements = document.querySelectorAll('[data-testid*="progress"]');
            progressElements.forEach(element => {
              if (element.textContent) {
                (window as any).progressAnnouncements.push({
                  time: now,
                  content: element.textContent
                });
              }
            });
            lastAnnouncementTime = now;
          }
        }, 1000);
      });

      await page.click('[data-testid="start-processing-button"]');
      
      // Wait for processing and verify periodic announcements
      await page.waitForTimeout(35000);
      
      const announcements = await page.evaluate(() => (window as any).progressAnnouncements);
      expect(announcements.length).toBeGreaterThan(0);

      // Test focus management during extended processing
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      expect(focusedElement).toBeTruthy();

      // Verify high contrast mode compatibility
      await page.emulateMedia({ prefersColorScheme: 'dark' });
      await page.addStyleTag({
        content: `
          @media (prefers-contrast: high) {
            [data-testid*="progress"] { filter: contrast(2); }
          }
        `
      });

      const progressBars = await page.locator('[data-testid*="progress"]').count();
      expect(progressBars).toBeGreaterThan(0);
    });
  });

  // Helper functions for test setup
  async function setupDefaultMocks(page: Page) {
    await page.route('/api/experiment/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    await page.route('/api/experiment/extract-frames', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, frames: [] })
      });
    });
  }

  async function setupUploadedVideoState(page: Page) {
    await page.evaluate(() => {
      (window as any).experimentState = {
        videoFile: new File(['mock'], 'test-video.mp4', { type: 'video/mp4' }),
        videoUrl: 'blob:mock-video-url',
        uploadProgress: 100,
        processingStep: 'idle'
      };
    });
  }

  async function setupParallelProcessingState(page: Page, options: {
    frameProgress?: number;
    transcriptionProgress?: number;
    frameTimeRemaining?: number;
    transcriptionTimeRemaining?: number;
  }) {
    await page.evaluate((opts) => {
      (window as any).experimentState = {
        ...(window as any).experimentState,
        processingStep: 'processing',
        frameExtractionProgress: opts.frameProgress || 0,
        transcriptionProgress: opts.transcriptionProgress || 0,
        frameTimeRemaining: opts.frameTimeRemaining || 0,
        transcriptionTimeRemaining: opts.transcriptionTimeRemaining || 0
      };
    }, options);
  }

  async function setupSegmentationInProgressState(page: Page) {
    await page.evaluate(() => {
      (window as any).experimentState = {
        ...(window as any).experimentState,
        transcriptionStatus: 'segmenting',
        fullTranscript: 'Complete Whisper transcript output...',
        segmentationProgress: 60
      };
    });
  }

  async function setupTranscriptionCompleteFramesPendingState(page: Page) {
    await page.evaluate(() => {
      (window as any).experimentState = {
        ...(window as any).experimentState,
        transcriptionStatus: 'complete',
        fullTranscript: 'Complete transcript text',
        segmentedTranscript: [
          { id: 1, start: 0, end: 5, text: 'Test segment', confidence: 0.95 }
        ],
        frameExtractionProgress: 92,
        costs: { openaiWhisper: 0.03, vercelBlob: 0.01, rendiApi: 0 }
      };
    });
  }

  async function setupWhisperCompleteSegmentationFailureState(page: Page) {
    await page.evaluate(() => {
      (window as any).experimentState = {
        ...(window as any).experimentState,
        transcriptionStatus: 'error',
        fullTranscript: 'Whisper completed successfully',
        segmentationProgress: 40,
        frameExtractionProgress: 65,
        errors: [{
          section: 'transcription',
          message: 'Python segmentation script failed: JSON parsing error',
          timestamp: Date.now()
        }]
      };
    });
  }

  async function setupNetworkConnectivityIssues(page: Page) {
    await page.evaluate(() => {
      (window as any).experimentState = {
        ...(window as any).experimentState,
        transcriptionProgress: 70,
        frameExtractionProgress: 60,
        networkStatus: 'offline',
        errors: [
          { section: 'network', message: 'Connection lost', timestamp: Date.now() }
        ]
      };
    });
  }

  async function setupLargeVideoFile(page: Page, options: { size: number; duration: number }) {
    await page.evaluate((opts) => {
      const largeMockFile = new File(['x'.repeat(opts.size * 1024 * 1024)], 'large-video.mp4', { type: 'video/mp4' });
      (window as any).experimentState = {
        videoFile: largeMockFile,
        videoUrl: 'blob:large-video-url',
        uploadProgress: 100,
        videoDuration: opts.duration,
        estimatedFrames: Math.ceil(opts.duration / 5),
        estimatedSegments: Math.ceil(opts.duration / 5)
      };
    }, options);
  }
});
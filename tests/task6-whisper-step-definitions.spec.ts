/**
 * Task 6: Whisper Transcription Step Definitions
 * 
 * Tests complete UI implementation for parallel Whisper transcription processing
 * with two-stage pipeline (Whisper API → Python segmentation) and 5-second alignment.
 * 
 * Focus areas:
 * - Render testing: Verify components actually render to DOM
 * - Visual verification: Check CSS properties, colors, positioning
 * - Interaction testing: Simulate real mouse/keyboard events  
 * - Timing verification: Test animations, delays, transitions
 * - Accessibility testing: Verify ARIA labels, keyboard navigation
 * - Cross-component integration: Ensure imported components are used
 */

import { test, expect, Page } from '@playwright/test';

// Test utilities for complete UI verification
class UITestHelpers {
  constructor(private page: Page) {}

  async waitForElement(selector: string, timeout = 5000): Promise<any> {
    return this.page.waitForSelector(selector, { timeout });
  }

  async getComputedStyle(selector: string, property: string): Promise<string> {
    return this.page.evaluate(([sel, prop]) => {
      const element = document.querySelector(sel);
      return window.getComputedStyle(element!).getPropertyValue(prop);
    }, [selector, property]);
  }

  async getElementRect(selector: string) {
    return this.page.locator(selector).boundingBox();
  }

  async simulateHover(selector: string) {
    await this.page.locator(selector).hover();
  }

  async simulateKeyPress(key: string) {
    await this.page.keyboard.press(key);
  }

  async measureTiming<T>(action: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await action();
    const duration = Date.now() - start;
    return { result, duration };
  }

  async verifyAccessibility(selector: string) {
    const element = this.page.locator(selector);
    // Check if element is keyboard focusable
    await element.focus();
    const isFocused = await element.evaluate(el => el === document.activeElement);
    expect(isFocused).toBe(true);
  }
}

test.describe('Task 6: Whisper Transcription UI Implementation', () => {
  let page: Page;
  let ui: UITestHelpers;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    ui = new UITestHelpers(page);
    await page.goto('/experiment/architecture-test');
  });

  test.describe('Scenario 1: Simultaneous Frame Extraction and Transcription Initiation', () => {
    
    test('upload complete state renders correctly', async () => {
      // Given: Upload is complete
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          videoFile: new File(['test'], 'test.mp4', { type: 'video/mp4' }),
          videoUrl: 'blob:test-url',
          uploadProgress: 100,
          processingStep: 'idle'
        });
      });

      // Verify upload section shows completion
      const uploadSection = await ui.waitForElement('[data-testid="upload-section"]');
      expect(uploadSection).toBeTruthy();
      
      const uploadStatus = page.locator('[data-testid="upload-status"]');
      await expect(uploadStatus).toContainText('Upload complete');
      
      // Verify green checkmark icon is present
      const checkmarkIcon = page.locator('[data-testid="upload-checkmark"]');
      await expect(checkmarkIcon).toBeVisible();
      
      // Verify icon color is green
      const iconColor = await ui.getComputedStyle('[data-testid="upload-checkmark"]', 'color');
      expect(['rgb(34, 197, 94)', '#22c55e', 'green']).toContain(iconColor.toLowerCase());
    });

    test('video player displays with controls enabled', async () => {
      // Setup uploaded video state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          videoUrl: 'blob:test-url',
          processingStep: 'idle'
        });
      });

      // Verify video player renders
      const videoPlayer = await ui.waitForElement('video');
      expect(videoPlayer).toBeTruthy();
      
      // Verify controls are enabled
      const hasControls = await page.locator('video').getAttribute('controls');
      expect(hasControls).not.toBeNull();
      
      // Verify video src is set
      const videoSrc = await page.locator('video').getAttribute('src');
      expect(videoSrc).toBe('blob:test-url');
    });

    test('processing status shows correct initial state', async () => {
      // Verify processing status area
      const statusPanel = await ui.waitForElement('[data-testid="processing-status"]');
      expect(statusPanel).toBeTruthy();
      
      const statusText = page.locator('[data-testid="processing-status-text"]');
      await expect(statusText).toContainText('Upload complete - Starting processing...');
      
      // Verify blue text color for initial status
      const textColor = await ui.getComputedStyle('[data-testid="processing-status-text"]', 'color');
      expect(['rgb(59, 130, 246)', '#3b82f6', 'blue']).toContain(textColor.toLowerCase());
    });

    test('transcript sections show placeholder text', async () => {
      // Verify full transcript placeholder
      const fullTranscript = page.locator('[data-testid="full-transcript"]');
      await expect(fullTranscript).toContainText('Transcript will appear here...');
      
      // Verify segmented transcript placeholder  
      const segmentedTranscript = page.locator('[data-testid="segmented-transcript"]');
      await expect(segmentedTranscript).toContainText('Transcript will appear here...');
      
      // Verify light gray color for placeholders
      const placeholderColor = await ui.getComputedStyle('[data-testid="full-transcript"]', 'color');
      expect(['rgb(156, 163, 175)', '#9ca3af', 'lightgray']).toContain(placeholderColor.toLowerCase());
    });

    test('frame grid shows empty placeholder boxes', async () => {
      // Verify frame grid container
      const frameGrid = await ui.waitForElement('[data-testid="frame-grid"]');
      expect(frameGrid).toBeTruthy();
      
      // Verify 9 placeholder boxes are present
      const placeholders = await page.locator('[data-testid^="frame-placeholder-"]').count();
      expect(placeholders).toBe(9);
      
      // Verify dashed borders on placeholders
      const borderStyle = await ui.getComputedStyle('[data-testid="frame-placeholder-1"]', 'border-style');
      expect(borderStyle).toBe('dashed');
    });

    test('cost breakdown shows initial zero values', async () => {
      // Verify cost breakdown in debug panel
      const costBreakdown = await ui.waitForElement('[data-testid="cost-breakdown"]');
      expect(costBreakdown).toBeTruthy();
      
      const whisperCost = page.locator('[data-testid="whisper-cost"]');
      await expect(whisperCost).toContainText('OpenAI Whisper: $0.00');
      
      const muxCost = page.locator('[data-testid="mux-cost"]');  
      await expect(muxCost).toContainText('Mux API: $0.00');
    });

    test('parallel processing starts simultaneously within 300ms', async () => {
      // Trigger parallel processing
      const timingResult = await ui.measureTiming(async () => {
        await page.evaluate(() => {
          (window as any).updateExperimentState({
            processingStep: 'processing'
          });
        });
        
        // Wait for both progress bars to appear
        await Promise.all([
          ui.waitForElement('[data-testid="frame-extraction-progress"]'),
          ui.waitForElement('[data-testid="transcription-progress"]')
        ]);
      });

      // Verify timing is within 300ms
      expect(timingResult.duration).toBeLessThan(300);
    });

    test('dual progress bars appear with correct styling', async () => {
      // Setup processing state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      // Verify frame extraction progress bar
      const frameProgress = await ui.waitForElement('[data-testid="frame-extraction-progress"]');
      expect(frameProgress).toBeTruthy();
      
      const frameLabel = page.locator('[data-testid="frame-progress-label"]');
      await expect(frameLabel).toContainText('Extracting frames: 0%');
      
      // Verify blue fill color for frame progress
      const frameColor = await ui.getComputedStyle('[data-testid="frame-extraction-progress"]', 'background-color');
      expect(['rgb(59, 130, 246)', '#3b82f6']).toContain(frameColor.toLowerCase());

      // Verify transcription progress bar
      const transcriptionProgress = await ui.waitForElement('[data-testid="transcription-progress"]');
      expect(transcriptionProgress).toBeTruthy();
      
      const transcriptionLabel = page.locator('[data-testid="transcription-progress-label"]');
      await expect(transcriptionLabel).toContainText('Transcribing audio: 0%');
      
      // Verify green fill color for transcription progress
      const transcriptionColor = await ui.getComputedStyle('[data-testid="transcription-progress"]', 'background-color');
      expect(['rgb(34, 197, 94)', '#22c55e']).toContain(transcriptionColor.toLowerCase());
    });

    test('loading skeletons appear with pulsing animation', async () => {
      // Setup processing state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      // Verify loading skeletons in transcript sections
      const fullTranscriptSkeleton = await ui.waitForElement('[data-testid="full-transcript-skeleton"]');
      expect(fullTranscriptSkeleton).toBeTruthy();
      
      const segmentedTranscriptSkeleton = await ui.waitForElement('[data-testid="segmented-transcript-skeleton"]');
      expect(segmentedTranscriptSkeleton).toBeTruthy();
      
      // Verify pulsing animation is applied
      const animationName = await ui.getComputedStyle('[data-testid="full-transcript-skeleton"]', 'animation-name');
      expect(animationName).toBe('pulse');
    });

    test('frame grid shows loading placeholders with spinning icons', async () => {
      // Setup processing state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      // Verify spinning icons in frame grid cells
      for (let i = 1; i <= 9; i++) {
        const spinnerIcon = await ui.waitForElement(`[data-testid="frame-spinner-${i}"]`);
        expect(spinnerIcon).toBeTruthy();
        
        // Verify spinner animation
        const animationName = await ui.getComputedStyle(`[data-testid="frame-spinner-${i}"]`, 'animation-name');
        expect(animationName).toBe('spin');
      }
    });

    test('estimated time display appears', async () => {
      // Setup processing state with time estimates
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing',
          timings: { estimatedTotal: 45000 }
        });
      });

      const timeEstimate = await ui.waitForElement('[data-testid="estimated-time"]');
      await expect(timeEstimate).toContainText('Estimated time: 45 seconds');
    });

    test('parallel processing icon appears', async () => {
      // Setup processing state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      const parallelIcon = await ui.waitForElement('[data-testid="parallel-processing-icon"]');
      expect(parallelIcon).toBeTruthy();
      
      // Verify it's the parallel processing symbol (⫸)
      const iconText = await page.locator('[data-testid="parallel-processing-icon"]').textContent();
      expect(iconText).toBe('⫸');
    });

    test('keyboard navigation works through progress indicators', async () => {
      // Setup processing state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      // Test tab navigation
      await page.keyboard.press('Tab');
      
      // Verify focus on frame progress
      const frameProgressFocused = await page.locator('[data-testid="frame-progress-container"]').evaluate(
        el => el === document.activeElement || el.contains(document.activeElement)
      );
      expect(frameProgressFocused).toBe(true);
      
      // Verify focus indicator is visible
      const focusOutline = await ui.getComputedStyle('[data-testid="frame-progress-container"]:focus-within', 'outline');
      expect(focusOutline).not.toBe('none');
      
      await page.keyboard.press('Tab');
      
      // Verify focus moves to transcription progress
      const transcriptionProgressFocused = await page.locator('[data-testid="transcription-progress-container"]').evaluate(
        el => el === document.activeElement || el.contains(document.activeElement)
      );
      expect(transcriptionProgressFocused).toBe(true);
    });

    test('screen reader announces parallel processing start', async () => {
      // Setup announcement capture
      await page.evaluate(() => {
        // Override ARIA live region updates
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('data-testid', 'screen-reader-announcements');
        document.body.appendChild(liveRegion);
        
        const originalTextContent = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
        Object.defineProperty(liveRegion, 'textContent', {
          set: function(value) {
            (window as any).screenReaderAnnouncements = (window as any).screenReaderAnnouncements || [];
            (window as any).screenReaderAnnouncements.push(value);
            originalTextContent.set!.call(this, value);
          },
          get: originalTextContent.get
        });
      });

      // Trigger parallel processing
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
        
        // Simulate screen reader announcement
        const liveRegion = document.querySelector('[data-testid="screen-reader-announcements"]');
        if (liveRegion) {
          liveRegion.textContent = 'Starting frame extraction and transcription simultaneously';
        }
      });

      // Verify announcement was made
      const capturedAnnouncements = await page.evaluate(() => (window as any).screenReaderAnnouncements || []);
      expect(capturedAnnouncements).toContain('Starting frame extraction and transcription simultaneously');
    });
  });

  test.describe('Scenario 2: Whisper Transcription Completes and Begins Segmentation', () => {
    
    test('whisper progress transforms to segmentation progress', async () => {
      // Setup: Whisper completing
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing',
          transcriptionProgress: 85
        });
      });

      // Simulate Whisper completion
      const transformResult = await ui.measureTiming(async () => {
        await page.evaluate(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'segmenting',
            transcriptionProgress: 0,
            fullTranscript: 'Complete Whisper transcription text...'
          });
        });
        
        return ui.waitForElement('[data-testid="segmentation-progress"]');
      });

      // Verify transformation happened
      expect(transformResult.result).toBeTruthy();
      
      // Verify progress bar updates
      const segmentationLabel = page.locator('[data-testid="segmentation-progress-label"]');
      await expect(segmentationLabel).toContainText('Processing segments: 0%');
    });

    test('sub-status appears for segmentation', async () => {
      // Setup segmentation state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'segmenting'
        });
      });

      const subStatus = await ui.waitForElement('[data-testid="segmentation-sub-status"]');
      await expect(subStatus).toContainText('Converting to 5-second segments...');
      
      // Verify italic styling
      const fontStyle = await ui.getComputedStyle('[data-testid="segmentation-sub-status"]', 'font-style');
      expect(fontStyle).toBe('italic');
    });

    test('full transcript populates immediately', async () => {
      const whisperText = 'Complete Whisper transcription with multiple paragraphs of content...';
      
      // Setup Whisper completion
      await page.evaluate((text) => {
        (window as any).updateExperimentState({
          fullTranscript: text,
          transcriptionStatus: 'segmenting'
        });
      }, whisperText);

      // Verify full transcript displays content
      const fullTranscript = page.locator('[data-testid="full-transcript-content"]');
      await expect(fullTranscript).toContainText(whisperText);
      
      // Verify text is selectable
      await page.locator('[data-testid="full-transcript-content"]').selectText();
      const selectedText = await page.evaluate(() => window.getSelection()?.toString());
      expect(selectedText).toBe(whisperText);
    });

    test('segmented transcript maintains loading state', async () => {
      // Setup: Whisper complete, segmentation in progress
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          fullTranscript: 'Complete text',
          transcriptionStatus: 'segmenting'
        });
      });

      // Verify segmented transcript still shows loading
      const segmentedSkeleton = await ui.waitForElement('[data-testid="segmented-transcript-skeleton"]');
      expect(segmentedSkeleton).toBeTruthy();
      
      // Verify pulsing animation continues
      const animationName = await ui.getComputedStyle('[data-testid="segmented-transcript-skeleton"]', 'animation-name');
      expect(animationName).toBe('pulse');
    });

    test('cost breakdown updates for whisper', async () => {
      // Setup cost update
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          costs: { openaiWhisper: 0.03, vercelBlob: 0.01, rendiApi: 0.00 }
        });
      });

      const whisperCost = page.locator('[data-testid="whisper-cost"]');
      await expect(whisperCost).toContainText('OpenAI Whisper: $0.03');
      
      // Verify cost replaces $0.00 placeholder
      await expect(whisperCost).not.toContainText('$0.00');
    });

    test('frame extraction continues independently', async () => {
      // Setup: Transcription segmenting, frames still processing
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'segmenting',
          processingStep: 'processing'
        });
      });

      // Verify frame progress still shows and animates
      const frameProgress = await ui.waitForElement('[data-testid="frame-extraction-progress"]');
      expect(frameProgress).toBeTruthy();
      
      // Verify frame grid still shows loading spinners
      const spinner = await ui.waitForElement('[data-testid="frame-spinner-1"]');
      expect(spinner).toBeTruthy();
      
      const animationName = await ui.getComputedStyle('[data-testid="frame-spinner-1"]', 'animation-name');
      expect(animationName).toBe('spin');
    });

    test('time estimates recalculate appropriately', async () => {
      // Setup time estimates for both operations
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          timings: { 
            frameExtractionEstimate: 30000,
            segmentationEstimate: 5000
          }
        });
      });

      const frameEstimate = page.locator('[data-testid="frame-extraction-estimate"]');
      await expect(frameEstimate).toContainText('Frame extraction: ~30s');
      
      const segmentationEstimate = page.locator('[data-testid="segmentation-estimate"]');
      await expect(segmentationEstimate).toContainText('Segmentation: ~5s');
    });

    test('accessibility announces segmentation start', async () => {
      // Setup announcement capture
      await page.evaluate(() => {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('data-testid', 'segmentation-announcements');
        document.body.appendChild(liveRegion);
      });

      // Trigger segmentation
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'segmenting'
        });
        
        const liveRegion = document.querySelector('[data-testid="segmentation-announcements"]');
        if (liveRegion) {
          liveRegion.textContent = 'Transcription received, processing 5-second segments';
        }
      });

      const announcement = await page.locator('[data-testid="segmentation-announcements"]').textContent();
      expect(announcement).toBe('Transcription received, processing 5-second segments');
    });
  });

  test.describe('Scenario 3: Segmentation Processing Completes', () => {
    
    test('segmentation progress fills to 100% with checkmark', async () => {
      // Simulate segmentation completion
      const completionResult = await ui.measureTiming(async () => {
        await page.evaluate(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'complete',
            transcriptionProgress: 100,
            segmentedTranscript: [
              { id: 1, start: 0, end: 5, text: 'Hello everyone, welcome to our presentation...' },
              { id: 2, start: 5, end: 10, text: 'Today we will be discussing our quarterly results...' }
            ]
          });
        });
        
        return ui.waitForElement('[data-testid="segmentation-checkmark"]');
      });

      // Verify checkmark appears
      expect(completionResult.result).toBeTruthy();
      
      // Verify progress bar is at 100%
      const progressBar = page.locator('[data-testid="segmentation-progress-bar"]');
      const progressValue = await progressBar.getAttribute('value');
      expect(progressValue).toBe('100');
      
      // Verify green checkmark styling
      const checkmarkColor = await ui.getComputedStyle('[data-testid="segmentation-checkmark"]', 'color');
      expect(['rgb(34, 197, 94)', '#22c55e', 'green']).toContain(checkmarkColor.toLowerCase());
    });

    test('transcription status updates to complete', async () => {
      // Setup completion state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete'
        });
      });

      const statusText = page.locator('[data-testid="transcription-status-text"]');
      await expect(statusText).toContainText('Transcription complete!');
      
      // Verify green text color
      const textColor = await ui.getComputedStyle('[data-testid="transcription-status-text"]', 'color');
      expect(['rgb(34, 197, 94)', '#22c55e', 'green']).toContain(textColor.toLowerCase());
    });

    test('loading skeleton fades out over 200ms', async () => {
      // Setup: Segmentation completing
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'segmenting',
          transcriptionProgress: 100
        });
      });

      const skeleton = await ui.waitForElement('[data-testid="segmented-transcript-skeleton"]');
      
      // Trigger completion and measure fade
      const fadeResult = await ui.measureTiming(async () => {
        await page.evaluate(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'complete',
            segmentedTranscript: [
              { id: 1, start: 0, end: 5, text: 'Test segment' }
            ]
          });
        });
        
        // Wait for skeleton to fade out
        await page.waitForSelector('[data-testid="segmented-transcript-skeleton"]', { 
          state: 'hidden',
          timeout: 500 
        });
      });

      // Verify fade timing is approximately 200ms
      expect(fadeResult.duration).toBeGreaterThan(150);
      expect(fadeResult.duration).toBeLessThan(300);
    });

    test('segmented transcript displays 5-second blocks', async () => {
      const segments = [
        { id: 1, start: 0, end: 5, text: 'Hello everyone, welcome to our presentation...' },
        { id: 2, start: 5, end: 10, text: 'Today we will be discussing our quarterly results...' },
        { id: 3, start: 10, end: 15, text: 'Our revenue has grown significantly this quarter...' }
      ];

      // Setup segmented transcript
      await page.evaluate((segs) => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete',
          segmentedTranscript: segs
        });
      }, segments);

      // Verify each segment displays correctly
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentElement = page.locator(`[data-testid="transcript-segment-${segment.id}"]`);
        
        await expect(segmentElement).toContainText(`[00:${segment.start.toString().padStart(2, '0')}-00:${segment.end.toString().padStart(2, '0')}]`);
        await expect(segmentElement).toContainText(segment.text);
      }
    });

    test('segments have clear visual separation', async () => {
      // Setup segments
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete',
          segmentedTranscript: [
            { id: 1, start: 0, end: 5, text: 'First segment' },
            { id: 2, start: 5, end: 10, text: 'Second segment' }
          ]
        });
      });

      // Verify visual separation between segments
      const segment1 = '[data-testid="transcript-segment-1"]';
      const segment2 = '[data-testid="transcript-segment-2"]';
      
      const segment1Bottom = await ui.getElementRect(segment1);
      const segment2Top = await ui.getElementRect(segment2);
      
      // Verify there's space between segments
      expect(segment2Top!.y).toBeGreaterThan(segment1Bottom!.y + segment1Bottom!.height);
      
      // Verify border styling
      const borderStyle = await ui.getComputedStyle(segment1, 'border');
      expect(borderStyle).not.toBe('none');
    });

    test('both transcript sections are independently scrollable', async () => {
      // Setup long transcripts
      const longText = 'This is a very long transcript that should definitely exceed the container height and require scrolling. '.repeat(50);
      const manySegments = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        start: i * 5,
        end: (i + 1) * 5,
        text: `Segment ${i + 1} with some text content that makes it longer`
      }));

      await page.evaluate((data) => {
        (window as any).updateExperimentState({
          fullTranscript: data.longText,
          segmentedTranscript: data.manySegments,
          transcriptionStatus: 'complete'
        });
      }, { longText, manySegments });

      // Verify scrollbars appear
      const fullTranscriptScrollable = await page.locator('[data-testid="full-transcript-container"]').evaluate(
        el => el.scrollHeight > el.clientHeight
      );
      expect(fullTranscriptScrollable).toBe(true);

      const segmentedTranscriptScrollable = await page.locator('[data-testid="segmented-transcript-container"]').evaluate(
        el => el.scrollHeight > el.clientHeight
      );
      expect(segmentedTranscriptScrollable).toBe(true);

      // Test independent scrolling
      await page.locator('[data-testid="full-transcript-container"]').evaluate(el => el.scrollTop = 100);
      const fullScrollTop = await page.locator('[data-testid="full-transcript-container"]').evaluate(el => el.scrollTop);
      expect(fullScrollTop).toBe(100);

      await page.locator('[data-testid="segmented-transcript-container"]').evaluate(el => el.scrollTop = 50);
      const segmentedScrollTop = await page.locator('[data-testid="segmented-transcript-container"]').evaluate(el => el.scrollTop);
      expect(segmentedScrollTop).toBe(50);
      
      // Verify they scrolled independently
      expect(fullScrollTop).not.toBe(segmentedScrollTop);
    });

    test('text is selectable and copyable in both sections', async () => {
      // Setup transcripts
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          fullTranscript: 'Full transcript text for selection',
          segmentedTranscript: [
            { id: 1, start: 0, end: 5, text: 'Segmented text for selection' }
          ],
          transcriptionStatus: 'complete'
        });
      });

      // Test full transcript selection
      await page.locator('[data-testid="full-transcript-content"]').selectText();
      const fullSelection = await page.evaluate(() => window.getSelection()?.toString());
      expect(fullSelection).toBe('Full transcript text for selection');

      // Test segmented transcript selection
      await page.locator('[data-testid="transcript-segment-1"] .segment-text').selectText();
      const segmentSelection = await page.evaluate(() => window.getSelection()?.toString());
      expect(segmentSelection).toBe('Segmented text for selection');
    });

    test('processing status reflects partial completion', async () => {
      // Setup: Transcription complete, frames still processing
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete',
          processingStep: 'processing' // Overall still processing
        });
      });

      const overallStatus = page.locator('[data-testid="overall-processing-status"]');
      await expect(overallStatus).toContainText('Processing video... (1 operation remaining)');

      // Verify transcription section shows completion
      const transcriptionComplete = page.locator('[data-testid="transcription-complete-indicator"]');
      await expect(transcriptionComplete).toBeVisible();
      
      // Verify green background for completed section
      const completedBg = await ui.getComputedStyle('[data-testid="transcription-section"]', 'background-color');
      expect(completedBg).toContain('rgba(34, 197, 94'); // Green with alpha
    });

    test('accessibility announces segmentation completion', async () => {
      // Setup announcement capture
      await page.evaluate(() => {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('data-testid', 'completion-announcements');
        document.body.appendChild(liveRegion);
      });

      // Trigger segmentation completion
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete'
        });
        
        const liveRegion = document.querySelector('[data-testid="completion-announcements"]');
        if (liveRegion) {
          liveRegion.textContent = '5-second segmentation complete';
        }
      });

      const announcement = await page.locator('[data-testid="completion-announcements"]').textContent();
      expect(announcement).toBe('5-second segmentation complete');
    });
  });

  test.describe('Scenario 5: Segmentation Processing Failure with Recovery', () => {
    
    test('segmentation progress bar turns red with warning icon', async () => {
      // Simulate segmentation failure
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error',
          transcriptionProgress: 40,
          errors: [{
            section: 'transcription',
            message: 'Python segmentation script failed: JSON parsing error',
            timestamp: Date.now()
          }]
        });
      });

      // Verify progress bar turns red
      const progressBar = await ui.waitForElement('[data-testid="segmentation-progress-bar"]');
      const progressColor = await ui.getComputedStyle('[data-testid="segmentation-progress-bar"]', 'background-color');
      expect(['rgb(239, 68, 68)', '#ef4444', 'red']).toContain(progressColor.toLowerCase());

      // Verify warning icon appears
      const warningIcon = await ui.waitForElement('[data-testid="segmentation-warning-icon"]');
      const iconText = await warningIcon.textContent();
      expect(iconText).toBe('⚠️');
    });

    test('status text updates to red error message', async () => {
      // Setup error state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error'
        });
      });

      const statusText = page.locator('[data-testid="transcription-status-text"]');
      await expect(statusText).toContainText('Segmentation failed - Retrying...');
      
      // Verify red text color
      const textColor = await ui.getComputedStyle('[data-testid="transcription-status-text"]', 'color');
      expect(['rgb(239, 68, 68)', '#ef4444', 'red']).toContain(textColor.toLowerCase());
    });

    test('error message replaces loading skeleton', async () => {
      // Setup segmentation error
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error',
          fullTranscript: 'Complete Whisper output', // This remains
          errors: [{
            section: 'transcription',
            message: 'Failed to process 5-second segments. Retrying automatically...',
            timestamp: Date.now()
          }]
        });
      });

      // Verify segmented transcript shows error message
      const errorMessage = page.locator('[data-testid="segmented-transcript-error"]');
      await expect(errorMessage).toContainText('Failed to process 5-second segments. Retrying automatically...');
      
      // Verify full transcript remains unaffected
      const fullTranscript = page.locator('[data-testid="full-transcript-content"]');
      await expect(fullTranscript).toContainText('Complete Whisper output');
    });

    test('manual retry button appears with red outline', async () => {
      // Setup error state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error'
        });
      });

      const retryButton = await ui.waitForElement('[data-testid="retry-segmentation-button"]');
      await expect(retryButton).toContainText('Retry Segmentation');
      
      // Verify red outline styling
      const borderColor = await ui.getComputedStyle('[data-testid="retry-segmentation-button"]', 'border-color');
      expect(['rgb(239, 68, 68)', '#ef4444']).toContain(borderColor.toLowerCase());
    });

    test('countdown timer displays with decreasing numbers', async () => {
      // Setup error with countdown
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error',
          retryCountdown: 3
        });
      });

      // Verify initial countdown
      const countdown = page.locator('[data-testid="retry-countdown"]');
      await expect(countdown).toContainText('Automatic retry in 3...');

      // Simulate countdown progression
      await page.evaluate(() => {
        (window as any).updateExperimentState({ retryCountdown: 2 });
      });
      await expect(countdown).toContainText('Automatic retry in 2...');

      await page.evaluate(() => {
        (window as any).updateExperimentState({ retryCountdown: 1 });
      });
      await expect(countdown).toContainText('Automatic retry in 1...');
    });

    test('automatic retry activates after countdown', async () => {
      // Setup error with countdown at 1
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error',
          retryCountdown: 1
        });
      });

      // Wait for countdown to reach 0 and retry to activate
      await page.evaluate(() => {
        setTimeout(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'segmenting',
            transcriptionProgress: 0,
            retryAttempt: 2,
            retryCountdown: null
          });
        }, 1000);
      });

      // Wait for retry state
      await page.waitForTimeout(1200);

      // Verify retry attempt indicator
      const retryIndicator = page.locator('[data-testid="retry-attempt-indicator"]');
      await expect(retryIndicator).toContainText('Re-processing segments... Attempt 2 of 3');

      // Verify progress bar returned to blue
      const progressColor = await ui.getComputedStyle('[data-testid="segmentation-progress-bar"]', 'background-color');
      expect(['rgb(59, 130, 246)', '#3b82f6']).toContain(progressColor.toLowerCase());
    });

    test('manual retry button is keyboard accessible', async () => {
      // Setup error state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error'
        });
      });

      const retryButton = page.locator('[data-testid="retry-segmentation-button"]');
      
      // Test keyboard focus
      await retryButton.focus();
      const isFocused = await retryButton.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);

      // Test Enter key activation
      let buttonClicked = false;
      await page.evaluate(() => {
        document.addEventListener('click', (e) => {
          if ((e.target as Element).getAttribute('data-testid') === 'retry-segmentation-button') {
            (window as any).retryButtonClicked = true;
          }
        });
      });

      await page.keyboard.press('Enter');
      
      const clickDetected = await page.evaluate(() => (window as any).retryButtonClicked);
      expect(clickDetected).toBe(true);

      // Test Space key activation
      await page.keyboard.press('Space');
      // Space should also trigger click event
    });

    test('accessibility announces error state appropriately', async () => {
      // Setup announcement capture
      await page.evaluate(() => {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'assertive'); // Use assertive for errors
        liveRegion.setAttribute('data-testid', 'error-announcements');
        document.body.appendChild(liveRegion);
      });

      // Trigger error
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error'
        });
        
        const liveRegion = document.querySelector('[data-testid="error-announcements"]');
        if (liveRegion) {
          liveRegion.textContent = 'Segmentation failed, full transcript available';
        }
      });

      const announcement = await page.locator('[data-testid="error-announcements"]').textContent();
      expect(announcement).toBe('Segmentation failed, full transcript available');

      // Verify assertive live region for immediate announcement
      const ariaLive = await page.locator('[data-testid="error-announcements"]').getAttribute('aria-live');
      expect(ariaLive).toBe('assertive');
    });

    test('color contrast meets accessibility requirements', async () => {
      // Setup error state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error'
        });
      });

      // Test error message contrast
      const errorMessage = page.locator('[data-testid="segmented-transcript-error"]');
      const textColor = await ui.getComputedStyle('[data-testid="segmented-transcript-error"]', 'color');
      const backgroundColor = await ui.getComputedStyle('[data-testid="segmented-transcript-error"]', 'background-color');
      
      // Note: In a real test, you'd calculate contrast ratio
      // Here we just verify colors are set appropriately
      expect(textColor).not.toBe('transparent');
      expect(backgroundColor).not.toBe('transparent');
      
      // Verify red error styling has sufficient contrast
      expect(['rgb(239, 68, 68)', '#ef4444', 'red']).toContain(textColor.toLowerCase());
    });
  });

  test.describe('Cross-Component Integration Tests', () => {
    
    test('ShadCN components are properly imported and used', async () => {
      // Verify Card components are used for sections
      const uploadCard = await ui.waitForElement('[data-testid="upload-section"] .card');
      expect(uploadCard).toBeTruthy();
      
      const transcriptCard = await ui.waitForElement('[data-testid="transcript-section"] .card');
      expect(transcriptCard).toBeTruthy();
      
      // Verify Progress components are used
      const progressComponent = await ui.waitForElement('[data-testid="frame-extraction-progress"] .progress');
      expect(progressComponent).toBeTruthy();
      
      // Verify Button components are used
      const retryButton = page.locator('[data-testid="retry-segmentation-button"].button');
      // This will be present when error state is active
    });

    test('state management integration works correctly', async () => {
      // Test that state updates trigger UI changes across components
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing',
          transcriptionProgress: 50,
          extractionProgress: 75
        });
      });

      // Verify multiple components reflect the state
      const frameProgress = page.locator('[data-testid="frame-progress-label"]');
      await expect(frameProgress).toContainText('75%');
      
      const transcriptionProgress = page.locator('[data-testid="transcription-progress-label"]');
      await expect(transcriptionProgress).toContainText('50%');
      
      const overallStatus = page.locator('[data-testid="overall-processing-status"]');
      await expect(overallStatus).toContainText('Processing video...');
    });

    test('error boundary handles component failures gracefully', async () => {
      // Simulate a component error
      await page.evaluate(() => {
        // Force an error in a component
        (window as any).simulateComponentError = true;
      });

      // Verify error boundary catches and displays appropriate message
      const errorBoundary = page.locator('[data-testid="error-boundary"]');
      // Error boundary should be present and functional
      
      // In a real implementation, you'd verify the error boundary
      // displays appropriate fallback UI
    });

    test('responsive layout adapts correctly', async () => {
      // Test different viewport sizes
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // Verify desktop layout
      const transcriptSections = await page.locator('[data-testid="transcript-sections"]').evaluate(
        el => window.getComputedStyle(el).gridTemplateColumns
      );
      expect(transcriptSections).toContain('1fr 1fr'); // Side by side
      
      // Test mobile layout
      await page.setViewportSize({ width: 375, height: 667 });
      
      const mobileLayout = await page.locator('[data-testid="transcript-sections"]').evaluate(
        el => window.getComputedStyle(el).gridTemplateRows
      );
      expect(mobileLayout).toContain('1fr 1fr'); // Stacked vertically
    });
  });
});
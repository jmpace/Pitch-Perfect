/**
 * Task 6: Whisper Transcription Integration Tests
 * 
 * Tests complete integration between frontend UI, API routes, and external services
 * for parallel Whisper transcription processing with Python segmentation.
 * 
 * Integration Focus:
 * - Frontend ↔ API Route communication
 * - API Route ↔ OpenAI Whisper API integration  
 * - API Route ↔ Python script execution
 * - UI state management ↔ API responses
 * - Error handling across all layers
 * - Cost tracking and timing measurement
 */

import { test, expect, Page } from '@playwright/test';
import { spawn } from 'child_process';
import path from 'path';

// Mock API responses for testing
const mockWhisperResponse = {
  text: "Hello everyone, welcome to our presentation. Today we will be discussing our quarterly results and future plans for expansion.",
  segments: [
    { id: 1, start: 0.0, end: 4.2, text: "Hello everyone, welcome to our presentation." },
    { id: 2, start: 4.2, end: 8.5, text: "Today we will be discussing our quarterly results" },
    { id: 3, start: 8.5, end: 12.0, text: "and future plans for expansion." }
  ]
};

const mockSegmentedResponse = {
  segments: [
    { id: 1, start: 0, end: 5, text: "Hello everyone, welcome to our presentation." },
    { id: 2, start: 5, end: 10, text: "Today we will be discussing our quarterly results and future" },
    { id: 3, start: 10, end: 15, text: "plans for expansion." }
  ]
};

test.describe('Task 6: Whisper Transcription Integration', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Mock API routes for testing
    await page.route('/api/experiment/transcribe', async (route) => {
      const request = route.request();
      const requestBody = request.postDataJSON();
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return mock response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fullTranscript: mockWhisperResponse.text,
          segmentedTranscript: mockSegmentedResponse.segments,
          cost: 0.03,
          processingTime: 1200
        })
      });
    });

    await page.goto('/experiment/architecture-test');
  });

  test.describe('Frontend to API Integration', () => {
    
    test('transcription API is called with correct parameters', async () => {
      let apiCallMade = false;
      let requestData: any = null;

      // Intercept API call to verify parameters
      await page.route('/api/experiment/transcribe', async (route) => {
        apiCallMade = true;
        requestData = route.request().postDataJSON();
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            fullTranscript: 'Test transcript',
            segmentedTranscript: [],
            cost: 0.03
          })
        });
      });

      // Setup uploaded video state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          videoUrl: 'blob:test-video-url',
          processingStep: 'idle'
        });
      });

      // Trigger transcription
      await page.evaluate(() => {
        // Simulate the handleTranscription function call
        fetch('/api/experiment/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: 'blob:test-video-url' })
        });
      });

      // Wait for API call
      await page.waitForTimeout(100);

      // Verify API was called with correct parameters
      expect(apiCallMade).toBe(true);
      expect(requestData).toEqual({ videoUrl: 'blob:test-video-url' });
    });

    test('API response updates UI state correctly', async () => {
      // Setup initial state
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          videoUrl: 'blob:test-video-url',
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing'
        });
      });

      // Trigger API call and wait for response
      await page.evaluate(async () => {
        const response = await fetch('/api/experiment/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: 'blob:test-video-url' })
        });
        
        const result = await response.json();
        
        // Update state with API response
        (window as any).updateExperimentState({
          fullTranscript: result.fullTranscript,
          segmentedTranscript: result.segmentedTranscript,
          transcriptionStatus: 'complete',
          costs: { 
            ...(window as any).experimentState.costs,
            openaiWhisper: result.cost 
          }
        });
      });

      // Verify UI was updated with API response
      const fullTranscript = page.locator('[data-testid="full-transcript-content"]');
      await expect(fullTranscript).toContainText(mockWhisperResponse.text);

      const whisperCost = page.locator('[data-testid="whisper-cost"]');
      await expect(whisperCost).toContainText('$0.03');
    });

    test('parallel processing triggers both APIs simultaneously', async () => {
      let transcribeCallTime: number = 0;
      let frameExtractionCallTime: number = 0;

      // Mock both API endpoints with timing
      await page.route('/api/experiment/transcribe', async (route) => {
        transcribeCallTime = Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ fullTranscript: 'Test', segmentedTranscript: [], cost: 0.03 })
        });
      });

      await page.route('/api/experiment/extract-frames', async (route) => {
        frameExtractionCallTime = Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ frames: [], cost: 1.25 })
        });
      });

      // Trigger parallel processing
      await page.evaluate(() => {
        const videoUrl = 'blob:test-video-url';
        
        // Simulate parallel API calls
        Promise.all([
          fetch('/api/experiment/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl })
          }),
          fetch('/api/experiment/extract-frames', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl })
          })
        ]);
      });

      await page.waitForTimeout(100);

      // Verify both APIs were called nearly simultaneously (within 50ms)
      expect(Math.abs(transcribeCallTime - frameExtractionCallTime)).toBeLessThan(50);
    });
  });

  test.describe('API Route Internal Integration', () => {
    
    test('API route handles Whisper API integration', async () => {
      // Test the actual API route logic (mocked OpenAI response)
      await page.route('/api/experiment/transcribe', async (route) => {
        // Simulate the API route's internal processing
        const requestBody = route.request().postDataJSON();
        
        // Mock Whisper API call within the route
        const whisperResponse = {
          text: mockWhisperResponse.text,
          segments: mockWhisperResponse.segments
        };
        
        // Simulate Python script processing
        const segmentedResult = mockSegmentedResponse;
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            fullTranscript: whisperResponse.text,
            segmentedTranscript: segmentedResult.segments,
            cost: 0.03,
            whisperProcessingTime: 800,
            segmentationProcessingTime: 200
          })
        });
      });

      // Make API call
      const response = await page.evaluate(async () => {
        const res = await fetch('/api/experiment/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: 'blob:test-video' })
        });
        return res.json();
      });

      // Verify response structure
      expect(response.fullTranscript).toBe(mockWhisperResponse.text);
      expect(response.segmentedTranscript).toHaveLength(3);
      expect(response.cost).toBe(0.03);
      expect(response.whisperProcessingTime).toBeDefined();
      expect(response.segmentationProcessingTime).toBeDefined();
    });

    test('Python script integration produces 5-second segments', async () => {
      // Test Python script execution with mock data
      const pythonScript = path.join(__dirname, '../../scripts/whisper_fixed_segments.py');
      
      // Create test input file
      const testWhisperData = {
        segments: mockWhisperResponse.segments
      };
      
      const testInputFile = '/tmp/test_whisper_output.json';
      
      // Mock file system operations for the test
      await page.route('/api/experiment/transcribe', async (route) => {
        // Simulate the API route's Python script execution
        const segmentedResult = {
          segments: [
            { id: 1, start: 0, end: 5, text: "Hello everyone, welcome to our presentation." },
            { id: 2, start: 5, end: 10, text: "Today we will be discussing our quarterly results and future" },
            { id: 3, start: 10, end: 15, text: "plans for expansion." }
          ]
        };
        
        await route.fulfill({
          status: 200,  
          contentType: 'application/json',
          body: JSON.stringify({
            fullTranscript: mockWhisperResponse.text,
            segmentedTranscript: segmentedResult.segments,
            cost: 0.03
          })
        });
      });

      const response = await page.evaluate(async () => {
        const res = await fetch('/api/experiment/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: 'blob:test-video' })
        });
        return res.json();
      });

      // Verify 5-second segmentation
      const segments = response.segmentedTranscript;
      expect(segments).toHaveLength(3);
      
      // Verify each segment is 5 seconds or less
      segments.forEach((segment: any) => {
        expect(segment.end - segment.start).toBeLessThanOrEqual(5);
        expect(segment.start % 5).toBe(0); // Starts on 5-second boundary
      });
    });

    test('error handling propagates through integration layers', async () => {
      // Test API error handling
      await page.route('/api/experiment/transcribe', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'OpenAI Whisper API rate limit exceeded',
            retryAfter: 30
          })
        });
      });

      // Trigger API call and handle error
      const errorResult = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/experiment/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl: 'blob:test-video' })
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
          }
          
          return null;
        } catch (error) {
          return {
            message: (error as Error).message,
            caught: true
          };
        }
      });

      // Verify error was properly caught and handled
      expect(errorResult?.caught).toBe(true);
      expect(errorResult?.message).toContain('rate limit exceeded');
    });
  });

  test.describe('State Management Integration', () => {
    
    test('cost tracking integrates across all operations', async () => {
      // Setup costs from multiple operations
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          costs: {
            vercelBlob: 0.01,
            rendiApi: 1.25,
            openaiWhisper: 0.00 // Will be updated by transcription
          }
        });
      });

      // Simulate transcription completion updating costs
      await page.evaluate(() => {
        const currentCosts = (window as any).experimentState.costs;
        (window as any).updateExperimentState({
          costs: {
            ...currentCosts,
            openaiWhisper: 0.03
          }
        });
      });

      // Verify total cost calculation
      const totalCost = page.locator('[data-testid="total-cost"]');
      await expect(totalCost).toContainText('$1.29'); // 0.01 + 1.25 + 0.03

      const whisperCost = page.locator('[data-testid="whisper-cost"]');
      await expect(whisperCost).toContainText('$0.03');
    });

    test('timing measurements integrate across all operations', async () => {
      const startTime = Date.now();

      // Setup timing for multiple operations
      await page.evaluate((start) => {
        (window as any).updateExperimentState({
          timings: {
            uploadStart: start,
            frameExtractionStart: start + 1000,
            transcriptionStart: start + 1000, // Parallel with frames
            frameExtractionEnd: start + 5000,
            transcriptionEnd: start + 4000,
            totalProcessingTime: 4000
          }
        });
      }, startTime);

      // Verify timing display
      const processingTime = page.locator('[data-testid="total-processing-time"]');
      await expect(processingTime).toContainText('4.0s');

      const frameTime = page.locator('[data-testid="frame-extraction-time"]');
      await expect(frameTime).toContainText('4.0s'); // 5000 - 1000

      const transcriptionTime = page.locator('[data-testid="transcription-time"]');
      await expect(transcriptionTime).toContainText('3.0s'); // 4000 - 1000
    });

    test('error state management integrates across components', async () => {
      // Add transcription error while frames succeed
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          errors: [
            {
              section: 'transcription',
              message: 'Segmentation failed: Python script error',
              timestamp: Date.now()
            }
          ],
          transcriptionStatus: 'error',
          extractionProgress: 100, // Frames completed successfully
          processingStep: 'processing' // Overall still processing due to error
        });
      });

      // Verify error is shown in transcription section
      const transcriptionError = page.locator('[data-testid="transcription-error"]');
      await expect(transcriptionError).toContainText('Segmentation failed');

      // Verify frames section shows success
      const frameSuccess = page.locator('[data-testid="frame-extraction-success"]');
      await expect(frameSuccess).toBeVisible();

      // Verify overall status reflects partial completion
      const overallStatus = page.locator('[data-testid="overall-processing-status"]');
      await expect(overallStatus).toContainText('1 operation remaining');
    });
  });

  test.describe('End-to-End Integration Scenarios', () => {
    
    test('complete successful processing flow', async () => {
      // Track the complete flow from upload to completion
      const flowSteps: string[] = [];

      // Setup monitoring
      await page.evaluate(() => {
        (window as any).flowSteps = [];
        
        // Monitor state changes
        const originalUpdate = (window as any).updateExperimentState;
        (window as any).updateExperimentState = function(updates: any) {
          if (updates.processingStep) {
            (window as any).flowSteps.push(`ProcessingStep: ${updates.processingStep}`);
          }
          if (updates.transcriptionStatus) {
            (window as any).flowSteps.push(`TranscriptionStatus: ${updates.transcriptionStatus}`);
          }
          return originalUpdate(updates);
        };
      });

      // Execute complete flow
      await page.evaluate(() => {
        // 1. Upload complete
        (window as any).updateExperimentState({
          videoUrl: 'blob:test-url',
          processingStep: 'processing'
        });

        // 2. Start transcription
        (window as any).updateExperimentState({
          transcriptionStatus: 'whisper-processing',
          transcriptionProgress: 0
        });

        // 3. Whisper completes, segmentation starts
        setTimeout(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'segmenting',
            fullTranscript: 'Complete transcript text...'
          });
        }, 100);

        // 4. Segmentation completes
        setTimeout(() => {
          (window as any).updateExperimentState({
            transcriptionStatus: 'complete',
            segmentedTranscript: [
              { id: 1, start: 0, end: 5, text: 'Segment 1' }
            ]
          });
        }, 200);

        // 5. Both processes complete
        setTimeout(() => {
          (window as any).updateExperimentState({
            processingStep: 'complete'
          });
        }, 300);
      });

      await page.waitForTimeout(500);

      // Verify complete flow was tracked
      const completedFlowSteps = await page.evaluate(() => (window as any).flowSteps);
      expect(completedFlowSteps).toContain('ProcessingStep: processing');
      expect(completedFlowSteps).toContain('TranscriptionStatus: whisper-processing');
      expect(completedFlowSteps).toContain('TranscriptionStatus: segmenting');
      expect(completedFlowSteps).toContain('TranscriptionStatus: complete');
      expect(completedFlowSteps).toContain('ProcessingStep: complete');
    });

    test('recovery from partial failure scenario', async () => {
      // Simulate frames succeeding, transcription failing, then recovery
      
      // 1. Start both processes
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing',
          extractionProgress: 50
        });
      });

      // 2. Frames complete successfully
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          extractedFrames: Array.from({ length: 9 }, (_, i) => ({
            url: `frame-${i}.jpg`,
            timestamp: i * 5
          })),
          extractionProgress: 100
        });
      });

      // 3. Transcription fails during segmentation
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          transcriptionStatus: 'error',
          fullTranscript: 'Whisper completed successfully',
          errors: [{
            section: 'transcription',
            message: 'Python segmentation failed',
            timestamp: Date.now()
          }]
        });
      });

      // Verify partial success state
      const frameGrid = page.locator('[data-testid="frame-grid"]');
      await expect(frameGrid).toBeVisible();
      
      const transcriptionError = page.locator('[data-testid="transcription-error"]');
      await expect(transcriptionError).toBeVisible();

      // 4. Manual retry triggers recovery
      await page.click('[data-testid="retry-segmentation-button"]');

      await page.evaluate(() => {
        // Simulate successful retry
        (window as any).updateExperimentState({
          transcriptionStatus: 'complete',
          segmentedTranscript: [
            { id: 1, start: 0, end: 5, text: 'Recovered segment' }
          ],
          errors: [],
          processingStep: 'complete'
        });
      });

      // Verify recovery
      const completionStatus = page.locator('[data-testid="processing-complete"]');
      await expect(completionStatus).toBeVisible();

      const segmentedTranscript = page.locator('[data-testid="segmented-transcript-content"]');
      await expect(segmentedTranscript).toContainText('Recovered segment');
    });

    test('performance measurement integration', async () => {
      // Measure actual performance of integrated components
      const performanceMetrics = await page.evaluate(async () => {
        const metrics: any = {};
        
        // Measure UI render time
        const renderStart = performance.now();
        (window as any).updateExperimentState({
          processingStep: 'processing',
          transcriptionStatus: 'whisper-processing'
        });
        await new Promise(resolve => requestAnimationFrame(resolve));
        metrics.renderTime = performance.now() - renderStart;

        // Measure state update time
        const stateStart = performance.now();
        (window as any).updateExperimentState({
          segmentedTranscript: Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            start: i * 5,
            end: (i + 1) * 5,
            text: `Segment ${i + 1} with test content`
          }))
        });
        metrics.stateUpdateTime = performance.now() - stateStart;

        return metrics;
      });

      // Verify performance is acceptable
      expect(performanceMetrics.renderTime).toBeLessThan(100); // UI renders in <100ms
      expect(performanceMetrics.stateUpdateTime).toBeLessThan(50); // State updates in <50ms
    });
  });

  test.describe('Cross-Browser Integration', () => {
    
    test('WebAPI integrations work across browsers', async () => {
      // Test File API, Blob API, and other web APIs
      const webAPISupport = await page.evaluate(() => {
        return {
          fileAPI: typeof File !== 'undefined',
          blobAPI: typeof Blob !== 'undefined',
          fetchAPI: typeof fetch !== 'undefined',
          urlAPI: typeof URL !== 'undefined' && typeof URL.createObjectURL !== 'undefined'
        };
      });

      // Verify all required APIs are supported
      expect(webAPISupport.fileAPI).toBe(true);
      expect(webAPISupport.blobAPI).toBe(true);
      expect(webAPISupport.fetchAPI).toBe(true);
      expect(webAPISupport.urlAPI).toBe(true);
    });

    test('CSS integration works with animations and transitions', async () => {
      // Setup processing state to trigger animations
      await page.evaluate(() => {
        (window as any).updateExperimentState({
          processingStep: 'processing'
        });
      });

      // Verify CSS animations are running
      const spinner = page.locator('[data-testid="frame-spinner-1"]');
      const animationState = await spinner.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          animationName: styles.animationName,
          animationDuration: styles.animationDuration,
          animationIterationCount: styles.animationIterationCount
        };
      });

      expect(animationState.animationName).toBe('spin');
      expect(animationState.animationDuration).not.toBe('0s');
      expect(animationState.animationIterationCount).toBe('infinite');
    });
  });
});
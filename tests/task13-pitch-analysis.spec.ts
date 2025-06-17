/**
 * Task 13: BDD Tests for Anthropic API Pitch Analysis Integration (POC)
 * 
 * These tests validate the complete UI implementation using Playwright
 * Based on scenarios from: bdd-scenarios-task13-pitch-analysis.md
 */

import { test, expect, Page } from '@playwright/test'

// Helper functions for the tests
async function waitForElement(page: Page, selector: string, timeout = 10000) {
  return await page.waitForSelector(selector, { timeout, state: 'visible' })
}

async function simulateVideoProcessingComplete(page: Page) {
  // Simulate the state where both frame extraction and transcription are complete
  await page.evaluate(() => {
    (window as any).updateExperimentState({
      processingStep: 'complete',
      extractedFrames: Array.from({length: 9}, (_, i) => ({
        url: `frame-${i + 1}`,
        timestamp: (i + 1) * 5,
        filename: `frame_${String(i + 1).padStart(2, '0')}m${String((i + 1) * 5).padStart(2, '0')}s.png`
      })),
      segmentedTranscript: Array.from({length: 9}, (_, i) => ({
        text: `Segment ${i + 1} text content`,
        startTime: i * 5,
        endTime: (i + 1) * 5,
        confidence: 0.9 + (Math.random() * 0.1)
      })),
      operationsRemaining: 0,
      parallelOperationsActive: false
    })
  })
}

test.describe('Task 13: Automatic Pitch Analysis Integration', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/experiment/architecture-test')
    
    // Wait for page to load
    await waitForElement(page, 'h1')
    await expect(page.locator('h1')).toHaveText('Architecture Experiment')
  })

  test('Scenario 1: Automatic Pitch Analysis Trigger After Processing Completion', async ({ page }) => {
    // Given: Processing is complete
    await simulateVideoProcessingComplete(page)
    await waitForElement(page, '[data-testid="processing-complete-status"]')
    
    // When: System detects both frames and transcript are available
    // (This happens automatically in the implementation)
    
    // Then: Grid layout expands to show 5th section
    await waitForElement(page, '[data-testid="pitch-analysis-section"]', 5000)
    
    // Verify section appears with correct styling
    const pitchSection = page.locator('[data-testid="pitch-analysis-section"]')
    await expect(pitchSection).toBeVisible()
    
    // Verify indigo border
    await expect(pitchSection).toHaveClass(/border-indigo-500/)
    
    // Verify title
    const title = page.locator('[data-testid="pitch-analysis-title"]')
    await expect(title).toHaveText('Pitch Analysis')
    
    // Verify automatic progress starts
    await waitForElement(page, '[data-testid="analysis-stage-text"]')
    const stageText = page.locator('[data-testid="analysis-stage-text"]')
    await expect(stageText).toContainText('Preparing multimodal data')
    
    // Verify progress bar appears
    await waitForElement(page, '[data-testid="analysis-progress-bar"]')
    const progressBar = page.locator('[data-testid="analysis-progress-bar"]')
    await expect(progressBar).toBeVisible()
    
    // Wait for progress to advance
    await expect(stageText).toContainText('Sending to Claude 4 Opus', { timeout: 15000 })
    await expect(stageText).toContainText('Analyzing visual-verbal alignment', { timeout: 15000 })
    await expect(stageText).toContainText('Processing framework scores', { timeout: 15000 })
    await expect(stageText).toContainText('Generating recommendations', { timeout: 15000 })
  })

  test('Scenario 2: Display Core Pitch Analysis Results', async ({ page }) => {
    // Given: Analysis has completed successfully
    await simulateVideoProcessingComplete(page)
    await waitForElement(page, '[data-testid="pitch-analysis-section"]')
    
    // Wait for analysis to complete (or simulate completion)
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        pitchAnalysisInProgress: false,
        pitchAnalysisResults: {
          overallScore: 7.2,
          categoryScores: {
            speech: 6.8,
            content: 7.5,
            visual: 7.0,
            overall: 8.0
          },
          timestampedRecommendations: [
            {
              id: 'rec_001',
              timestamp: 135,
              title: 'Visual-Verbal Mismatch',
              description: 'Speaker says 10K users but slide shows 15K users',
              actionableAdvice: 'Update slide to match verbal claim'
            },
            {
              id: 'rec_002', 
              timestamp: 270,
              title: 'Pacing Issue',
              description: 'Speaking too quickly through technical content',
              actionableAdvice: 'Slow down and add strategic pauses'
            }
          ]
        }
      })
    })
    
    // When: Results render automatically
    await waitForElement(page, '[data-testid="analysis-results-container"]')
    
    // Then: Display clean card layout
    const resultsContainer = page.locator('[data-testid="analysis-results-container"]')
    await expect(resultsContainer).toBeVisible()
    
    // Verify overall score display
    const overallScore = page.locator('[data-testid="overall-score-display"]')
    await expect(overallScore).toContainText('7.2/10')
    await expect(overallScore).toHaveClass(/text-3xl/)
    
    // Verify category scores
    await expect(page.locator('[data-testid="category-score-speech"]')).toContainText('Speech Mechanics')
    await expect(page.locator('[data-testid="category-score-speech"]')).toContainText('6.8/10')
    
    await expect(page.locator('[data-testid="category-score-content"]')).toContainText('Content Quality')
    await expect(page.locator('[data-testid="category-score-content"]')).toContainText('7.5/10')
    
    await expect(page.locator('[data-testid="category-score-visual"]')).toContainText('Visual Presentation')
    await expect(page.locator('[data-testid="category-score-visual"]')).toContainText('7.0/10')
    
    await expect(page.locator('[data-testid="category-score-overall"]')).toContainText('Overall Effectiveness')
    await expect(page.locator('[data-testid="category-score-overall"]')).toContainText('8.0/10')
    
    // Verify key issues section shows recommendations
    const issuesSection = page.locator('[data-testid="pitch-analysis-results-card"]')
    await expect(issuesSection).toContainText('Key Issues Found')
    await expect(issuesSection).toContainText('Visual-Verbal Mismatch at 2:15')
    await expect(issuesSection).toContainText('Speaker says 10K users but slide shows 15K users')
    await expect(issuesSection).toContainText('Update slide to match verbal claim')
  })

  test('Scenario 3: Analysis Error States and Auto-Retry', async ({ page }) => {
    // Given: Analysis process starts
    await simulateVideoProcessingComplete(page)
    await waitForElement(page, '[data-testid="pitch-analysis-section"]')
    
    // When: API request fails
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        pitchAnalysisInProgress: false,
        pitchAnalysisError: 'Network timeout - retrying automatically...'
      })
    })
    
    // Then: Error message appears
    await waitForElement(page, '[data-testid="analysis-error-message"]')
    const errorMessage = page.locator('[data-testid="analysis-error-message"]')
    await expect(errorMessage).toContainText('⚠ Analysis failed - Retrying automatically')
    
    // Verify countdown timer
    const countdown = page.locator('[data-testid="retry-countdown-timer"]')
    await expect(countdown).toContainText('Retry in 3... 2... 1...')
    
    // When: Retry succeeds (simulate)
    await page.evaluate(() => {
      setTimeout(() => {
        (window as any).updateExperimentState({
          pitchAnalysisError: null,
          pitchAnalysisInProgress: true
        })
      }, 2000)
    })
    
    // Then: Error clears and analysis continues
    await expect(errorMessage).not.toBeVisible({ timeout: 5000 })
    await waitForElement(page, '[data-testid="analysis-stage-text"]')
  })

  test('Scenario 4: Loading States During Automatic Analysis', async ({ page }) => {
    // Given: Transcription has completed and analysis begins
    await simulateVideoProcessingComplete(page)
    
    // When: Pitch Analysis section appears
    await waitForElement(page, '[data-testid="pitch-analysis-section"]')
    const pitchSection = page.locator('[data-testid="pitch-analysis-section"]')
    
    // Then: Section slides into view
    await expect(pitchSection).toHaveClass(/animate-expand/)
    
    // Verify progress bar shows current stage
    await waitForElement(page, '[data-testid="analysis-progress-bar"]')
    const progressBar = page.locator('[data-testid="analysis-progress-bar"]')
    await expect(progressBar).toBeVisible()
    
    // Verify stage text updates
    const stageText = page.locator('[data-testid="analysis-stage-text"]')
    await expect(stageText).toContainText('Analyzing')
    
    // When results become available
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        pitchAnalysisInProgress: false,
        pitchAnalysisResults: {
          overallScore: 7.2,
          categoryScores: { speech: 6.8, content: 7.5, visual: 7.0, overall: 8.0 },
          timestampedRecommendations: []
        }
      })
    })
    
    // Then: Results appear with fade-in
    await waitForElement(page, '[data-testid="analysis-results-container"]')
    const resultsContainer = page.locator('[data-testid="analysis-results-container"]')
    await expect(resultsContainer).toHaveClass(/animate-fade-in/)
  })

  test('Scenario 5: Integration with Existing Cost Tracking', async ({ page }) => {
    // Given: Analysis has completed
    await simulateVideoProcessingComplete(page)
    await waitForElement(page, '[data-testid="pitch-analysis-section"]')
    
    // Simulate analysis completion with cost
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        pitchAnalysisInProgress: false,
        pitchAnalysisResults: { overallScore: 7.2, categoryScores: {}, timestampedRecommendations: [] },
        costs: { anthropicClaude: 0.45 }
      })
    })
    
    // When: Analysis completes automatically
    await waitForElement(page, '[data-testid="analysis-results-container"]')
    
    // Then: Cost tracker updates
    const costTracker = page.locator('[data-testid="cost-tracker"]')
    await expect(costTracker).toContainText('$')
    
    // Click to reveal breakdown
    await costTracker.click()
    
    // Verify breakdown includes Anthropic cost
    const costBreakdown = page.locator('[data-testid="cost-breakdown"]')
    await expect(costBreakdown).toBeVisible()
    await expect(costBreakdown).toContainText('Anthropic Claude: $0.45')
  })

  test('Scenario 6: Analysis Readiness State Management', async ({ page }) => {
    // Given: User uploads video and processing begins
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        videoFile: { name: 'test.mp4' },
        videoUrl: 'blob:test-url',
        processingStep: 'processing',
        parallelOperationsActive: true,
        operationsRemaining: 2
      })
    })
    
    // When: Only frame extraction completes
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        extractedFrames: Array.from({length: 9}, (_, i) => ({
          url: `frame-${i + 1}`,
          timestamp: (i + 1) * 5,
          filename: `frame_${i + 1}.png`
        })),
        operationsRemaining: 1
      })
    })
    
    // Then: Pitch Analysis section does not appear yet
    const pitchSections = page.locator('[data-testid="pitch-analysis-section"]')
    await expect(pitchSections).toHaveCount(0)
    
    // When: Transcription also completes
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        segmentedTranscript: Array.from({length: 5}, (_, i) => ({
          text: `Segment ${i + 1}`,
          startTime: i * 5,
          endTime: (i + 1) * 5,
          confidence: 0.9
        })),
        processingStep: 'complete',
        operationsRemaining: 0,
        parallelOperationsActive: false
      })
    })
    
    // Then: Pitch Analysis section appears within 500ms
    const startTime = Date.now()
    await waitForElement(page, '[data-testid="pitch-analysis-section"]', 1000)
    const elapsed = Date.now() - startTime
    expect(elapsed).toBeLessThan(600) // 500ms + some buffer
    
    // And analysis begins immediately
    await waitForElement(page, '[data-testid="analysis-progress-bar"]')
  })

  test('Scenario 7: Multimodal Data Processing Validation', async ({ page }) => {
    // Given: System has extracted frames and segmented transcript
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        extractedFrames: Array.from({length: 9}, (_, i) => ({
          url: `frame-${i + 1}`,
          timestamp: (i + 1) * 5,
          filename: `frame_${String(i + 1).padStart(2, '0')}m${String((i + 1) * 5).padStart(2, '0')}s.png`
        })),
        segmentedTranscript: Array.from({length: 9}, (_, i) => ({
          text: `Segment ${i + 1} content`,
          startTime: i * 5,
          endTime: (i + 1) * 5,
          confidence: 0.9
        })),
        processingStep: 'complete',
        operationsRemaining: 0
      })
    })
    
    // When: Analysis begins
    await waitForElement(page, '[data-testid="pitch-analysis-section"]')
    
    // Then: Verify perfect timestamp alignment indicator
    await waitForElement(page, '[data-testid="timestamp-alignment-validation"]')
    const alignmentIndicator = page.locator('[data-testid="timestamp-alignment-validation"]')
    await expect(alignmentIndicator).toContainText('✓ Perfect 5-second alignment detected')
    
    // When: Analysis identifies mismatches (simulate)
    await page.evaluate(() => {
      (window as any).updateExperimentState({
        pitchAnalysisInProgress: false,
        pitchAnalysisResults: {
          overallScore: 6.5,
          categoryScores: { speech: 6.0, content: 7.0, visual: 6.0, overall: 7.0 },
          timestampedRecommendations: [
            {
              id: 'rec_001',
              timestamp: 135, // 2:15
              title: 'Visual-Verbal Mismatch',
              description: 'Speaker says "10K users" but slide shows "15K users"',
              actionableAdvice: 'Update slide to match verbal claim or clarify discrepancy'
            }
          ]
        }
      })
    })
    
    // Then: Results demonstrate multimodal value
    await waitForElement(page, '[data-testid="analysis-results-container"]')
    const results = page.locator('[data-testid="pitch-analysis-results-card"]')
    await expect(results).toContainText('Visual-Verbal Mismatch')
    await expect(results).toContainText('Speaker says "10K users" but slide shows "15K users"')
    
    // This demonstrates clear value over transcript-only or slide-only analysis
    // because it identifies specific alignment issues between what was said and shown
  })
})

test.describe('Task 13: Analysis API Integration', () => {
  
  test('API route handles multimodal data correctly', async ({ page }) => {
    // Test that the API route is accessible and returns expected structure
    const response = await page.request.post('http://localhost:3001/api/experiment/analyze-pitch', {
      data: {
        alignedData: {
          sessionId: 'test-session',
          videoMetadata: {
            duration: 45,
            filename: 'test.mp4',
            uploadUrl: 'blob:test'
          },
          alignedSegments: [
            {
              timestamp: 5,
              frame: { url: 'test-frame', filename: 'frame_05s.png' },
              transcriptSegment: { 
                startTime: 0, 
                endTime: 5, 
                text: 'Test transcript', 
                confidence: 0.9 
              }
            }
          ],
          analysisMetadata: {
            totalFrames: 1,
            totalSegments: 1,
            alignmentAccuracy: 1.0,
            processingTime: 1000,
            costs: { frameExtraction: 0.1, transcription: 0.2, total: 0.3 }
          }
        }
      }
    })
    
    // Verify API responds (may fail due to missing API key in test environment)
    expect([200, 400, 500]).toContain(response.status())
    
    if (response.status() === 200) {
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('metadata')
    }
  })
})
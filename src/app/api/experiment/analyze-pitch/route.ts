/**
 * Task 13: Anthropic API Pitch Analysis Integration
 * 
 * Next.js API route that orchestrates multimodal pitch analysis by:
 * 1. Accepting aligned frame and transcript data
 * 2. Formatting it with existing pitch-analysis-prompt.md
 * 3. Sending to Anthropic's Claude 4 API  
 * 4. Returning structured analysis results using existing JSON schema
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { 
  PitchAnalysisRequest, 
  PitchAnalysisApiResponse,
  AlignedSegment,
  AlignedPitchData
} from '@/types/pitch-analysis'
import { MODEL_CONFIG, getCurrentModelPricing } from '@/config/models'

// Initialize Anthropic client
const anthropicApiKey = process.env.ANTHROPIC_API_KEY
if (!anthropicApiKey) {
  console.error('❌ ANTHROPIC_API_KEY environment variable is not set')
}

const anthropic = new Anthropic({
  apiKey: anthropicApiKey!,
})

// Rate limiting and request validation
const MAX_FRAMES = 20 // Limit frames to control costs
const MAX_TRANSCRIPT_LENGTH = 8000 // characters
// Pricing is now handled by centralized config
const modelPricing = getCurrentModelPricing()

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse and validate request
    const body = await request.json()
    const alignedData = body.alignedData as AlignedPitchData
    
    if (!alignedData) {
      return NextResponse.json({
        success: false,
        error: 'Missing aligned data',
        metadata: {
          model: MODEL_CONFIG.PITCH_ANALYSIS,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          processingTime: Date.now() - startTime,
          alignmentQuality: 0
        }
      } as PitchAnalysisApiResponse, { status: 400 })
    }

    const { alignedSegments, videoMetadata, analysisMetadata } = alignedData
    
    // Validate and limit data size for cost control
    if (!alignedSegments || alignedSegments.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No aligned segments provided',
        metadata: {
          model: MODEL_CONFIG.PITCH_ANALYSIS,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          processingTime: Date.now() - startTime,
          alignmentQuality: 0
        }
      } as PitchAnalysisApiResponse, { status: 400 })
    }

    // Limit segments for cost control
    const limitedSegments = alignedSegments.slice(0, MAX_FRAMES)
    
    // Build the complete transcript for context
    const fullTranscript = limitedSegments
      .map(segment => segment.transcriptSegment.text)
      .join(' ')
      .substring(0, MAX_TRANSCRIPT_LENGTH)

    // Calculate alignment quality
    const alignmentQuality = analysisMetadata.alignmentAccuracy || 
      (limitedSegments.filter(s => s.frame && s.transcriptSegment).length / limitedSegments.length)

    // Format multimodal content for Claude 4 Opus
    const multimodalContent = await formatMultimodalContent(limitedSegments, fullTranscript)
    
    // Load the existing pitch analysis prompt
    const systemPrompt = await loadPitchAnalysisPrompt()
    
    console.log('🎯 Sending pitch analysis to Claude 4 Opus:', {
      segments: limitedSegments.length,
      transcriptLength: fullTranscript.length,
      alignmentQuality: alignmentQuality.toFixed(2),
      contentBlocks: multimodalContent.length
    })

    // Call Anthropic Claude 3.5 Sonnet API (using latest for rate limit compatibility)
    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.PITCH_ANALYSIS,
      max_tokens: 4000,
      temperature: 0.1, // Low temperature for consistent analysis
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: multimodalContent
        }
      ]
    })

    // Extract and parse the JSON response
    const analysisText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : ''
    
    const analysisResults = extractJsonFromResponse(analysisText)
    
    if (!analysisResults) {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse analysis results from Claude',
        metadata: {
          model: MODEL_CONFIG.PITCH_ANALYSIS,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cost: calculateCost(response.usage.input_tokens, response.usage.output_tokens),
          processingTime: Date.now() - startTime,
          alignmentQuality
        }
      } as PitchAnalysisApiResponse, { status: 500 })
    }

    // Calculate final cost
    const cost = calculateCost(response.usage.input_tokens, response.usage.output_tokens)
    
    console.log('✅ Pitch analysis completed:', {
      overallScore: analysisResults.overallScore,
      processingTime: Date.now() - startTime,
      cost: cost.toFixed(3),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    })

    return NextResponse.json({
      success: true,
      data: {
        ...analysisResults,
        processingTime: (Date.now() - startTime) / 1000,
        cost
      },
      metadata: {
        model: MODEL_CONFIG.PITCH_ANALYSIS,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cost,
        processingTime: Date.now() - startTime,
        alignmentQuality
      }
    } as PitchAnalysisApiResponse)

  } catch (error) {
    console.error('❌ Pitch analysis error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed',
      metadata: {
        model: MODEL_CONFIG.PITCH_ANALYSIS,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        processingTime: Date.now() - startTime,
        alignmentQuality: 0
      }
    } as PitchAnalysisApiResponse, { status: 500 })
  }
}

/**
 * Format aligned segments into multimodal content blocks for Claude
 */
async function formatMultimodalContent(
  segments: AlignedSegment[], 
  fullTranscript: string
): Promise<any[]> {
  const content: any[] = [
    {
      type: 'text',
      text: `# Pitch Analysis Request

## Full Transcript
${fullTranscript}

## Frame-by-Frame Analysis with Aligned Transcript Segments

Please analyze the following ${segments.length} frames with their corresponding transcript segments for visual-verbal alignment, pacing issues, and presentation effectiveness.

Each frame represents a 5-second interval with perfectly aligned transcript text:`
    }
  ]

  // Add each aligned segment as multimodal content
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    
    content.push({
      type: 'text',
      text: `\n### Frame ${i + 1} - ${formatTimestamp(segment.timestamp)}
**Transcript (${formatTimestamp(segment.transcriptSegment.startTime)} - ${formatTimestamp(segment.transcriptSegment.endTime)}):**
"${segment.transcriptSegment.text}"
**Confidence:** ${Math.round(segment.transcriptSegment.confidence * 100)}%`
    })

    // Add image if available - convert to base64 for Claude Vision API
    if (segment.frame.url) {
      try {
        // For Mux URLs, fetch and encode the image
        if (segment.frame.url.includes('image.mux.com')) {
          const imageBase64 = await fetchAndEncodeImage(segment.frame.url)
          if (imageBase64) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64
              }
            })
            content.push({
              type: 'text',
              text: `**Slide Image:** ${segment.frame.filename} - Analyze this slide content and compare with the transcript above.`
            })
          } else {
            // Fallback to URL reference if fetch fails
            content.push({
              type: 'text',
              text: `**Slide Image:** ${segment.frame.filename} (${segment.frame.url}) - Image fetch failed, analyzing transcript only.`
            })
          }
        }
      } catch (error) {
        console.warn(`Failed to process image for segment ${i}:`, error)
        content.push({
          type: 'text',
          text: `**Slide Image:** ${segment.frame.filename} (processing failed)`
        })
      }
    }
  }

  content.push({
    type: 'text',
    text: `\n## Analysis Instructions

Please provide a comprehensive analysis using the 13-point framework. Focus specifically on:

1. **Visual-Verbal Alignment**: Compare the actual slide images with the spoken content. Look for:
   - Data/statistics that match or mismatch between speech and visuals
   - Visual elements that support or contradict what's being said
   - Whether existing infographics, charts, or visuals are being utilized effectively
   
2. **Content Gaps**: Note missing competitive positioning or unclear value propositions  
3. **Presentation Flow**: Evaluate pacing and slide timing issues
4. **Framework Compliance**: Score each of the 13 framework points with specific rationale

CRITICAL: You are receiving actual slide images. Analyze what you can actually see in each frame. Do not suggest creating visual elements that already exist in the slides.

Return your analysis as a valid JSON object following the exact schema specified in the system prompt.`
  })

  return content
}

/**
 * Load the existing pitch analysis prompt from the file
 */
async function loadPitchAnalysisPrompt(): Promise<string> {
  // For now, return the embedded prompt. In production, this could read from a file
  return `You are an expert venture capital pitch coach providing comprehensive analysis of startup presentations. You will receive a speech transcript with timestamps and extracted video frames. Your task is to evaluate both the spoken presentation AND visual slide content, identifying alignment issues and providing actionable feedback.

## Core Requirements

**CRITICAL**: Only provide feedback where you are 70%+ confident. Focus on accuracy and specificity over completeness.

**Funding Stage Detection**: Extract funding stage from ask slide or verbal request (e.g., "pre-seed," "seed," "Series A"). Adjust evaluation expectations accordingly:
- **Pre-seed**: Focus on founder quality, problem validation, early learning velocity
- **Seed**: Expect some traction metrics, clearer product-market fit signals
- **Series A**: Require strong traction, proven unit economics, scalable growth

**Multimodal Analysis**: You will receive actual slide images alongside transcript text. Compare them carefully to identify:
- Content misalignments (e.g., speaker says "10K users" but slide shows "15K users")
- Visual-verbal disconnects (unclear slides while discussing complex topics)
- Missing visual support for key claims vs. existing visual elements already present
- Missing competitive positioning (flag if absent)
- Slide timing issues (wrong slide displayed during speech section)
- IMPORTANT: Do NOT suggest creating visuals that already exist in the slides - analyze what's actually shown
- CRITICAL: If data/statistics appear ANYWHERE in frames (text, charts, graphics), visual support EXISTS - do not flag as missing

**Error Handling**: If frames are unclear or transcript has gaps, work with available data and note limitations rather than guessing.

## 13-Point Evaluation Framework

### Speech Mechanics (3 Points)
1. **pace_rhythm**: Optimal speaking speed (160-180 WPM), strategic pauses
2. **filler_words**: Minimal "um," "uh," "like" usage
3. **vocal_confidence**: Steady tone, assertive delivery without uptalk

### Content Quality (6 Points)
4. **problem_definition**: Clear, relatable pain point articulation
5. **solution_clarity**: Logical value proposition and differentiation
6. **market_validation**: Credible market sizing with supporting data (score higher if visually shown)
7. **traction_evidence**: Concrete progress indicators and customer validation
8. **financial_projections**: Realistic revenue forecasts and unit economics
9. **ask_clarity**: Specific funding request with clear use of funds

### Visual Presentation (2 Points)
10. **slide_design**: Clean layout, readable fonts, professional appearance
11. **data_visualization**: Clear charts, appropriate visual representations, logical flow

### Overall Effectiveness (2 Points)
12. **storytelling**: Compelling narrative with clear problem→solution→outcome arc, emotional hooks (personal stories, customer pain), logical flow from problem through ask
13. **executive_presence**: Definitive language ("we will" vs "we hope"), ownership of decisions, specific examples of leadership, confident assertions about market and solution

## Scoring System

**Individual Scores**: Rate each framework point 1-10
- 8-10: Excellent, investor-ready
- 6-7: Good with minor improvements needed
- 4-5: Adequate but requires attention
- 1-3: Significant improvement required

**Category Scores**: Average of points within each category
**Overall Score**: Weighted average (speech×0.3 + content×0.4 + visual×0.2 + overall×0.1)

## Required JSON Output

Return your analysis as valid JSON in this exact structure:

{
  "sessionId": "[SESSION_ID_FROM_REQUEST]",
  "fundingStage": "[DETECTED_STAGE: pre-seed|seed|series-a]",
  "overallScore": [CALCULATED_WEIGHTED_AVERAGE],
  "categoryScores": {
    "speech": [AVERAGE_OF_SPEECH_POINTS],
    "content": [AVERAGE_OF_CONTENT_POINTS],
    "visual": [AVERAGE_OF_VISUAL_POINTS],
    "overall": [AVERAGE_OF_OVERALL_POINTS]
  },
  "individualScores": [
    // REQUIRED: Include ALL 13 framework points with these exact pointIds:
    // Speech Mechanics: "pace_rhythm", "filler_words", "vocal_confidence"
    // Content Quality: "problem_definition", "solution_clarity", "market_validation", "traction_evidence", "financial_projections", "ask_clarity"
    // Visual Presentation: "slide_design", "data_visualization"
    // Overall Effectiveness: "storytelling", "executive_presence"
    {
      "pointId": "[EXACT_FRAMEWORK_POINT_ID_FROM_LIST_ABOVE]",
      "score": [1-10_SCORE_BASED_ON_ANALYSIS],
      "rationale": "[SPECIFIC_OBSERVATION_FROM_TRANSCRIPT_AND_SLIDES]",
      "improvementSuggestions": ["[ACTIONABLE_ADVICE_1]", "[ACTIONABLE_ADVICE_2]"]
    }
    // ... repeat for ALL 13 points - do not skip any
  ],
  "timestampedRecommendations": [
    {
      "id": "[UNIQUE_REC_ID]",
      "timestamp": [EXACT_TIMESTAMP_IN_SECONDS],
      "duration": [RECOMMENDED_REVIEW_DURATION],
      "category": "[speech|content|visual|overall]",
      "priority": "[high|medium|low]",
      "title": "[SPECIFIC_ISSUE_TITLE]",
      "description": "[WHAT_YOU_OBSERVED_IN_VIDEO]",
      "specificIssue": "[EXACT_PROBLEM_IDENTIFIED]",
      "actionableAdvice": "[HOW_TO_FIX_THIS_SPECIFIC_ISSUE]",
      "relatedFrameworkScore": "[FRAMEWORK_POINT_ID]"
    }
    // ... for each issue found
  ],
  "slideAnalysis": [
    {
      "timestamp": [FRAME_TIMESTAMP],
      "slideImage": "[FRAME_FILENAME]",
      "contentSummary": "[WHAT_IS_SHOWN_ON_THIS_SLIDE]",
      "designFeedback": "[VISUAL_DESIGN_ASSESSMENT]",
      "alignmentWithSpeech": "[ALIGNED|MISMATCH: specific_description]",
      "improvementSuggestions": ["[SLIDE_IMPROVEMENT_1]", "[SLIDE_IMPROVEMENT_2]"],
      "score": [1-10_SLIDE_EFFECTIVENESS_SCORE]
    }
    // ... for each analyzed frame
  ],
  "analysisTimestamp": "[CURRENT_ISO_TIMESTAMP]",
  "processingTime": [ACTUAL_PROCESSING_TIME_IN_SECONDS]
}

CRITICAL: Analyze the ACTUAL content provided. Do not copy these placeholder values. Generate real scores, observations, and recommendations based on the specific pitch content you receive.

REQUIRED: Your response MUST include exactly 13 individualScores entries - one for each framework point. Do not skip any points. If you cannot assess a point due to limited data, provide a score based on available information and note the limitation in the rationale.

You're helping founders identify blind spots and alignment issues they can't see themselves. Focus on specific, observable problems with clear paths to improvement. The goal is accurate, actionable feedback that improves investor readiness.`
}

/**
 * Extract JSON from Claude's response text
 */
function extractJsonFromResponse(text: string): any {
  try {
    // Look for JSON block in the response
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                     text.match(/\{[\s\S]*\}/)
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0]
      return JSON.parse(jsonText)
    }
    
    // Try parsing the entire text as JSON
    return JSON.parse(text)
  } catch (error) {
    console.error('Failed to parse JSON from Claude response:', error)
    return null
  }
}

/**
 * Calculate cost based on token usage
 */
function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * modelPricing.input
  const outputCost = (outputTokens / 1000) * modelPricing.output
  return inputCost + outputCost
}

/**
 * Fetch image from URL and convert to base64
 */
async function fetchAndEncodeImage(imageUrl: string): Promise<string | null> {
  try {
    console.log(`🖼️ Fetching image: ${imageUrl}`)
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'PitchPerfect/1.0 (Image Analysis)',
      },
      // Add timeout to prevent hanging (Node.js compatible)
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    })
    
    if (!response.ok) {
      console.warn(`Image fetch failed: ${response.status} ${response.statusText}`)
      return null
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    
    console.log(`✅ Image encoded successfully: ${imageUrl.split('/').pop()} (${Math.round(arrayBuffer.byteLength / 1024)}KB)`)
    return base64
    
  } catch (error) {
    console.warn(`Failed to fetch/encode image ${imageUrl}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Format timestamp in MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
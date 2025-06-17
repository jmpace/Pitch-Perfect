# BDD Scenarios for Task 13: Anthropic API Pitch Analysis Integration (POC)

## Feature: Automatic Multimodal Pitch Analysis with Visual-Verbal Alignment Detection

### Background: Existing System State
- User has successfully uploaded a video to Architecture Experiment page
- Frame extraction has completed (9 frames displayed in 3x3 grid)
- Transcription has completed (full transcript and segmented transcript visible)
- Processing Status shows "Processing complete!" with green checkmark
- User is viewing the complete 4-section grid layout

---

## Scenario 1: Automatic Pitch Analysis Trigger After Processing Completion

**Given** the user is viewing the Architecture Experiment page
**And** frame extraction has just completed with 9 frames displayed
**And** transcription has just completed with segmented transcript visible
**And** the Processing Status section shows "Processing complete!" with green celebration emoji

**When** the system detects both frames and segmented transcript are available
**Then** the grid layout automatically expands to show a 5th section below the existing 4 sections
**And** the new "Pitch Analysis" section appears with an indigo-500 border and "Pitch Analysis" title
**And** a progress indicator immediately shows "Preparing multimodal data... 0%"
**And** the status updates to "Aligning frames with transcript segments..."
**And** no user interaction is required to trigger this analysis

**When** the analysis progresses automatically
**Then** the progress bar updates through: "Sending to Claude 4 Opus... 25%"
**And** then "Analyzing visual-verbal alignment... 50%"
**And** then "Processing framework scores... 75%"
**And** finally "Generating recommendations... 100%"

**When** the analysis completes successfully
**Then** the progress bar is replaced with analysis results display
**And** a success message appears: "✓ Pitch analysis complete! Found 3 visual-verbal misalignments"
**And** the complete results render automatically below

---

## Scenario 2: Display Core Pitch Analysis Results

**Given** the automatic pitch analysis has completed successfully
**And** the Pitch Analysis section is fully expanded and visible

**When** the analysis results render automatically
**Then** the section displays a clean card layout with:
**And** an "Overall Score" section at the top showing a large score (e.g., "7.2/10") in readable text
**And** four category score rows:
- "Speech Mechanics: 6.8/10"
- "Content Quality: 7.5/10" 
- "Visual Presentation: 7.0/10"
- "Overall Effectiveness: 8.0/10"

**And** below that, a "Key Issues Found" section with a numbered list:
- "1. Visual-Verbal Mismatch at 2:15"
- "2. Pacing Issue at 4:30" 
- "3. Missing Competitive Positioning at 6:45"

**And** each issue shows:
- Timestamp reference (e.g., "at 2:15") 
- Issue description (e.g., "Speaker says '10K users' but slide shows '15K users'")
- Specific recommendation (e.g., "Update slide to match verbal claim")

---

## Scenario 3: Analysis Error States and Auto-Retry

**Given** the automatic analysis process starts after transcription completion
**And** the progress bar shows "Sending to Claude 4 Opus... 25%"

**When** the API request fails due to network timeout
**Then** the progress bar changes to red color
**And** an error message appears: "⚠ Analysis failed - Retrying automatically..."
**And** a countdown timer shows "Retry in 3... 2... 1..."
**And** the system automatically attempts the analysis again

**When** the automatic retry succeeds
**Then** the error message clears
**And** the progress bar returns to blue color
**And** the analysis continues and completes normally

**When** the automatic retry also fails
**Then** an error message shows: "⚠ Analysis unavailable - Please refresh page to try again"
**And** the Pitch Analysis section remains visible but shows the error state
**And** no manual retry button is needed (refresh page to restart entire flow)

---

## Scenario 4: Loading States During Automatic Analysis

**Given** the transcription has just completed
**And** the automatic analysis is beginning

**When** the Pitch Analysis section first appears
**Then** it slides down into view with a smooth expand animation
**And** a progress bar shows current analysis stage
**And** placeholder text shows "Analyzing your pitch presentation..."

**When** the progress updates to "Analyzing visual-verbal alignment"
**Then** the status text updates accordingly
**And** the processing status in the main section shows "Analyzing pitch presentation..."

**When** results become available
**Then** the placeholder content is replaced with actual analysis results
**And** scores and recommendations appear with a fade-in animation

---

## Scenario 5: Integration with Existing Cost Tracking

**Given** the automatic pitch analysis has completed
**And** the cost tracker in Processing Status section is visible

**When** the analysis completes automatically
**Then** the cost breakdown automatically updates to show a new line item:
- "Anthropic Claude: $0.45"
**And** the total cost updates to include this amount immediately
**And** the cost tracker button shows the new total
**And** clicking the cost tracker reveals the updated breakdown

---

## Scenario 6: Analysis Readiness State Management

**Given** the user uploads a video file
**And** processing begins with parallel frame extraction and transcription

**When** only frame extraction is complete
**Then** the Pitch Analysis section does not appear yet
**And** the system waits for transcription completion

**When** only transcription is complete (frames still processing)
**Then** the Pitch Analysis section does not appear yet
**And** the system waits for frame extraction completion

**When** both frame extraction AND segmented transcription are complete
**Then** the Pitch Analysis section appears within 500ms automatically
**And** the analysis begins immediately
**And** the user experiences a seamless flow from processing to analysis

**When** either process fails completely
**Then** the Pitch Analysis section never appears
**And** the user is not presented with a broken analysis experience

---

## Scenario 7: Multimodal Data Processing Validation

**Given** the system has extracted 9 frames at 5-second intervals (0:05, 0:10, 0:15, etc.)
**And** the system has segmented transcript in 5-second chunks
**And** the automatic analysis is preparing to send data to Claude 4 Opus

**When** the system aligns frames with transcript segments
**Then** frame at 0:05 is paired with transcript segment 0:00-0:05
**And** frame at 0:10 is paired with transcript segment 0:05-0:10
**And** frame at 0:15 is paired with transcript segment 0:10-0:15
**And** this pattern continues for all available frames

**When** the aligned data is sent to the Anthropic API
**Then** the payload includes both visual and textual information for each time segment
**And** the API receives properly formatted multimodal data
**And** the existing pitch-analysis-prompt.md is used without modification
**And** the response follows the existing scoring-framework-3.ts schema

**When** the analysis identifies a visual-verbal mismatch
**Then** the result specifies the exact timestamp where the mismatch occurs
**And** the result describes both what was said and what was shown visually
**And** this demonstrates clear value over transcript-only or slide-only analysis
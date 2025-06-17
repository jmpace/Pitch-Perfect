# Task 6 Implementation Plan: Whisper Transcription with Parallel Processing

## Architecture Decision

**Frontend-orchestrated parallel processing** with server-side Python segmentation - optimal for POC while preparing for future edge function migration.

## Technical Implementation

### Phase 1: State Management Updates

Add new state variables for parallel processing:

```typescript
// New transcription state variables
transcriptionStatus: 'idle' | 'whisper-processing' | 'segmenting' | 'complete' | 'error'
transcriptionProgress: number
whisperResult: string // Raw Whisper output
segmentedTranscript: Array<{id: number, start: number, end: number, text: string}>
```

- Keep existing `frameStatus` and `extractionProgress` separate
- Update `processingStep` logic to check both processes for completion

### Phase 2: API Route Creation

Create `/api/experiment/transcribe.ts` that handles:

1. **Whisper API integration** via Vercel AI SDK
2. **Server-side Python script execution** for 5-second segmentation using existing `/scripts/whisper_fixed_segments.py`
3. **Returns both results**: raw transcript and segmented results

Required dependencies:
- Vercel AI SDK (`npm install ai`)
- OPENAI_API_KEY environment variable
- child_process for Python execution

### Phase 3: Frontend Integration

Modify upload completion to trigger both processes simultaneously:

```typescript
const triggerParallelProcessing = (videoUrl: string) => {
  handleFrameExtraction(videoUrl)      // Existing function
  handleTranscription(videoUrl)        // New function
  setState(prev => ({ ...prev, processingStep: 'processing' }))
}

const handleTranscription = async (videoUrl: string) => {
  // Call API route that handles both Whisper + Python segmentation
  const response = await fetch('/api/experiment/transcribe', {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
    headers: { 'Content-Type': 'application/json' }
  })
  
  const result = await response.json()
  // result contains: { fullTranscript, segmentedTranscript, cost }
  
  setState(prev => ({
    ...prev,
    fullTranscript: result.fullTranscript,
    segmentedTranscript: result.segmentedTranscript,
    transcriptionStatus: 'complete'
  }))
}
```

### Phase 4: UI Updates

- **Dual progress bars** for frame extraction and transcription
- **Separate loading states** for full transcript vs segmented transcript
- **Error handling** for partial failures (one succeeds, one fails)
- **Cost tracking** for Whisper API usage
- **Completion detection** when both processes finish

### Phase 5: Python Script Integration

- Copy existing `/scripts/whisper_fixed_segments.py` logic into API route context
- Execute via Node.js `child_process.spawn()` in transcription API
- Handle JSON processing between Whisper output and segmentation
- Return both raw Whisper text and 5-second aligned segments

## Orchestration Flow

```
Upload Complete → videoUrl available
     ↓
Parallel Execution:
├── Frame Extraction (Mux API) 
│   └── extractedFrames (every 5 seconds)
│
└── Transcription Pipeline:
    ├── Whisper API → raw transcript
    └── Python Segmentation → 5-second segments
         └── segmentedTranscript (aligned with frames)
     ↓
Completion Check: 
if (frameStatus === 'complete' && transcriptionStatus === 'complete') {
  processingStep = 'complete'
}
```

## Key Benefits

1. **True parallel processing** reduces total time by ~50%
2. **Maintains clear separation** between frame and transcription logic  
3. **Prepares architecture** for future edge function orchestration
4. **Minimal disruption** to existing codebase
5. **Easy to test and debug** individual components
6. **5-second alignment** between frames and transcript segments enables future multimodal analysis

## Future Migration Path

This architecture prepares for eventual edge function orchestration:

```
Current: Frontend → [Mux API + Whisper API] → Results
Future:  Frontend → Edge Function → [Mux API + Whisper API] → Results
```

The clean API contracts and separate state management make this migration straightforward.

## Success Metrics

- Frame extraction and transcription start simultaneously after upload
- Total processing time reduced compared to sequential approach
- 5-second segments align perfectly with extracted frames
- Robust error handling for partial failures
- Cost tracking accurate for Whisper API usage
- UI provides clear feedback for both parallel processes
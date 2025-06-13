# 🔴 RED Phase Complete: Mux Migration Unit Tests

## Overview
We have successfully completed the RED phase of TDD for the Mux migration. All tests have been written and are **failing as expected** with the current Rendi implementation.

## Test Files Created

### 1. `/tests/MuxMigration.test.tsx`
**Component-level tests focusing on UI integration and rendering**

- ✅ **Component Rendering**: Tests expecting Mux frame URLs in image src attributes
- ✅ **UI Integration**: Tests for Mux timestamp overlays and URL parameters  
- ✅ **Event Handling**: Tests for client-side video duration extraction
- ✅ **State Management**: Tests expecting Mux cost calculations and error states
- ✅ **CSS Integration**: Tests for Mux error styling and frame display

**Test Results**: 11 failed | 2 passed (as expected for RED phase)

### 2. `/tests/MuxApiIntegration.test.tsx`
**API endpoint tests focusing on authentication, request/response format**

- ✅ **Authentication**: Tests expecting Mux Basic auth vs Rendi X-API-KEY
- ✅ **Request Payload**: Tests requiring videoDuration from client-side extraction
- ✅ **Response Format**: Tests expecting Mux playback IDs and image.mux.com URLs
- ✅ **Processing Workflow**: Tests expecting immediate response without polling delays
- ✅ **Cost Calculation**: Tests expecting Mux pricing structure vs Rendi
- ✅ **Error Handling**: Tests expecting Mux-specific error messages

**Test Results**: 14 failed (as expected for RED phase)

## Key Failing Assertions (Expected Behavior)

### Frame URL Format
```typescript
// ❌ WILL FAIL: Current implementation returns Rendi URLs
expect(frameImage).toHaveAttribute('src', 'https://image.mux.com/test-playback-id/frame_00m05s.png?time=5')
```

### Client-Side Duration Extraction  
```typescript
// ❌ WILL FAIL: Current implementation doesn't send videoDuration
expect(requestBody).toHaveProperty('videoDuration')
expect(requestBody.videoDuration).toBeGreaterThan(0)
```

### Mux Authentication
```typescript
// ❌ WILL FAIL: Current implementation uses X-API-KEY for Rendi
expect(uploadCall[1].headers.Authorization).toMatch(/^Basic /)
expect(uploadCall[1].headers).not.toHaveProperty('X-API-KEY')
```

### Cost Structure
```typescript
// ❌ WILL FAIL: Current implementation shows "Rendi API"
expect(costBreakdown).toHaveTextContent('Mux API: $0.03')
expect(costBreakdown).not.toHaveTextContent('Rendi API')
```

### Error Messages
```typescript
// ❌ WILL FAIL: Current implementation shows Rendi error messages
expect(errorLog).toHaveTextContent('Mux upload failed')
expect(errorLog).not.toHaveTextContent('Rendi command failed')
```

## Current Implementation Analysis

### What We Confirmed About Rendi Implementation:
1. **Frame URLs**: Uses `https://api.rendi.dev/files/...` or `https://picsum.photos/...` for mocks
2. **Authentication**: Uses `X-API-KEY` header for Rendi API calls
3. **Polling**: Has 5-second polling intervals for command completion
4. **Cost Structure**: Uses $0.30 base + $0.01 per frame calculation
5. **Duration Detection**: Server-side duration detection, no client-side extraction
6. **Error Messages**: References "Rendi command failed", "polling timeout", "FFmpeg"

### What Tests Expect After Mux Migration:
1. **Frame URLs**: `https://image.mux.com/{playbackId}/frame_00m05s.png?time=5`
2. **Authentication**: `Authorization: Basic {base64(tokenId:tokenSecret)}`
3. **Direct Processing**: No polling delays, immediate URL generation
4. **Mux Cost Structure**: Different pricing model for upload/storage
5. **Client Duration**: Video duration extracted via HTML5 `video.duration`
6. **Mux Errors**: "Mux upload failed", "Invalid video format for Mux processing"

## Dynamic Frame Count Testing

Tests verify mathematical frame generation for any video length:
- **30-second video**: 6 frames (0, 5, 10, 15, 20, 25)
- **47-second video**: 10 frames (0, 5, 10, 15, 20, 25, 30, 35, 40, 45) 
- **3600-second video**: 720 frames (every 5 seconds)

## BDD Scenario Coverage

Our unit tests cover all BDD scenarios from `/tests/bdd-scenarios-mux-migration.md`:

✅ API generates Mux frame URLs instead of Rendi FFmpeg processing  
✅ Dynamic frame count calculation for any video length  
✅ Client-side duration extraction replaces server-side detection  
✅ Mux authentication replaces Rendi API key authentication  
✅ Cost calculation updates for Mux vs Rendi pricing  
✅ Error handling transitions from Rendi polling to Mux API failures  
✅ Frame URLs point to Mux image service with time parameters  
✅ Processing workflow eliminates Rendi polling phase  

## Next Steps: GREEN Phase

The RED phase has established comprehensive test coverage. During the GREEN phase, we will:

1. **Replace Rendi API Integration** with Mux upload and asset creation
2. **Remove FFmpeg Commands** and implement mathematical URL generation  
3. **Add Client-Side Duration Extraction** to video upload component
4. **Update Cost Calculations** to use Mux pricing structure
5. **Change Error Handling** to reference Mux instead of Rendi
6. **Remove Polling Logic** and implement immediate response

All tests should pass after implementing the Mux integration, confirming successful migration from Rendi to Mux.

## Test Execution Commands

```bash
# Run Mux migration component tests
npm test -- MuxMigration.test.tsx

# Run Mux API integration tests  
npm test -- MuxApiIntegration.test.tsx

# Run all tests
npm test
```

The RED phase validates our test-driven approach by ensuring tests fail with current implementation and will guide our GREEN phase implementation.
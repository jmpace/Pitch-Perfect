# BDD Scenarios for Task 2: Vercel Blob Upload Integration

## Feature: Video File Upload with Vercel Blob Integration

### Scenario 1: Initial Upload Dropzone Appearance
```gherkin
Given the user navigates to "/experiment/architecture-test"
And the page has finished loading completely
When the user looks at the Upload section in the grid layout
Then they see a large rectangular dropzone with a dashed border in gray (#E5E7EB)
And the dropzone displays a centered upload cloud icon in muted gray
And below the icon shows "Drag & drop your video file here" in 18px font weight 500
And below that shows "or click to browse" in 14px text-gray-500
And the dropzone has a minimum height of 200px and fills the available card width
And the cursor changes to pointer when hovering over the dropzone
And the entire dropzone has a subtle rounded corner radius of 8px
```

### Scenario 2: Drag and Drop Visual Feedback States
```gherkin
Given the user is viewing the upload dropzone in its default state
When the user drags a video file over the browser window but not over the dropzone
Then the dropzone remains in its default visual state
And no visual changes occur to indicate drag activity

When the user drags the video file directly over the dropzone area
Then the dropzone border changes from dashed gray to solid blue (#3B82F6) within 100ms
And the background color shifts to a light blue tint (#EFF6FF)
And the upload icon changes from gray to blue (#3B82F6)
And the text changes to "Drop your video file here" in blue color
And a subtle blue glow shadow appears around the dropzone border

When the user drags the file away from the dropzone but keeps it in the browser
Then all visual changes revert to the default state within 150ms
And the transition is smooth with CSS transitions

When the user drops a valid video file on the dropzone
Then the dropzone immediately shows a success state with green border (#10B981)
And displays a checkmark icon replacing the upload icon
And shows "File received! Processing..." text in green
```

### Scenario 3: File Browse Button Interaction
```gherkin
Given the user is viewing the upload dropzone
When the user clicks anywhere within the dropzone area
Then a native file browser dialog opens immediately
And the dialog is filtered to show only video files (MP4, MOV, WebM)
And the dialog title shows "Select Video File to Upload"

When the user selects a valid video file from the dialog
Then the file browser closes
And the dropzone transitions to the upload progress state
And the selected filename appears below the progress bar in 14px text

When the user cancels the file browser dialog
Then the dialog closes without any visual changes to the dropzone
And the dropzone returns to its default state
```

### Scenario 4: File Validation Visual Feedback
```gherkin
Given the user has dragged a file over the upload dropzone
When the file is not a video type (e.g., .txt, .jpg, .pdf)
Then the dropzone shows an error state with red border (#EF4444)
And the background becomes light red (#FEF2F2)
And displays an X icon in red
And shows "Invalid file type. Please select MP4, MOV, or WebM" in red text
And the error state persists for 3 seconds before reverting to default

When the file is a video but exceeds 100MB in size
Then the dropzone shows the same red error styling
And displays "File too large. Maximum size is 100MB" in red text
And shows the file size in gray text below the error message
And the error state persists until user dismisses or adds valid file

When the file is valid (correct type and under 100MB)
Then the dropzone shows positive feedback with green border
And displays a checkmark icon in green
And shows "Valid video file detected" for 1 second
And automatically proceeds to upload progress state
```

### Scenario 5: Upload Progress Visualization
```gherkin
Given a valid video file has been selected for upload
When the upload process begins
Then the dropzone transforms to show a progress indicator layout
And displays the filename at the top in 16px font weight 500
And shows file size and type information below filename in gray text
And renders a progress bar with blue fill (#3B82F6) on gray background
And the progress bar has rounded corners and is 8px tall
And displays percentage text "0%" aligned to the right of the progress bar
And shows "Uploading..." status text below the progress bar
And the upload icon is replaced with a spinning loader animation

As the upload progresses from 0% to 100%
Then the blue progress bar fill animates smoothly from left to right
And the percentage text updates in real-time matching the progress
And the estimated time remaining appears below status (e.g., "2 minutes remaining")
And upload speed is shown in gray text (e.g., "1.2 MB/s")

When upload reaches 50% completion
Then the progress bar fill reaches the halfway point
And percentage shows exactly "50%"
And estimated time remaining updates based on current speed

When upload completes successfully at 100%
Then the progress bar fills completely with green color (#10B981)
And percentage shows "100%"
And status changes to "Upload complete!" in green text
And a success checkmark replaces the spinner
And the blob URL appears as a clickable link below the status
```

### Scenario 6: Upload Error States and Recovery
```gherkin
Given a video file upload is in progress at 35% completion
When a network error occurs during upload
Then the progress bar stops animating at 35%
And the blue progress fill changes to red (#EF4444) for the completed portion
And displays "Upload failed - Network error" in red text
And shows a "Retry Upload" button with blue background
And shows a "Cancel" button with gray background next to retry
And the error icon replaces the spinner

When the user clicks "Retry Upload"
Then the progress resets to 0% with blue coloring restored
And upload restarts from the beginning
And shows "Retrying upload..." status text
And the retry attempt counter appears (e.g., "Attempt 2 of 3")

When maximum retry attempts (3) are reached and still failing
Then the progress area shows persistent error state
And displays "Upload failed after 3 attempts" in red
And shows "Choose Different File" button to reset the dropzone
And provides error details in collapsible section
And logs detailed error information for debugging

When the user clicks "Choose Different File" after failures
Then the dropzone resets completely to initial state
And all error indicators are cleared
And user can select a new file to upload
```

### Scenario 7: Keyboard Navigation and Accessibility
```gherkin
Given the user is navigating the page using only keyboard
When the user tabs to the upload dropzone
Then the dropzone receives focus with a visible focus ring in blue
And the focus ring is 2px solid and clearly distinguishable
And screen readers announce "Upload video file, dropzone, button"

When the user presses Enter or Space while dropzone is focused
Then the file browser dialog opens immediately
And screen readers announce "File browser opened"
And focus moves to the file browser dialog

When the user completes file selection via keyboard in the browser
Then focus returns to the upload area
And screen readers announce the selected filename and file size
And progress updates are announced at 25%, 50%, 75%, and 100%

When upload is in progress and user tabs away then back
Then focus returns to the progress area
And screen readers provide current progress status
And user can press Escape to cancel upload (with confirmation)

For users with screen readers during drag and drop
Then screen readers announce dropzone state changes
And announce "Drop zone activated" when file enters area
And announce "Drop zone deactivated" when file leaves area
And provide clear success/error announcements
```

### Scenario 8: Mobile Touch Interface Experience
```gherkin
Given the user is accessing the page on a mobile device (viewport < 768px)
When the user views the upload dropzone
Then the dropzone adapts to mobile screen width with proper margins
And maintains minimum touch target size of 44px for interactive elements
And the upload text adjusts to "Tap to select video file"
And drag and drop text is hidden on touch devices

When the user taps the dropzone on mobile
Then the mobile file picker opens immediately
And shows video file filters appropriate for the mobile OS
And the interface remains responsive during file selection

When uploading on mobile with poor connectivity
Then progress updates occur less frequently to conserve bandwidth
And displays connection quality indicator (e.g., "Slow connection detected")
And provides option to "Upload in background" for large files
And shows data usage estimate for mobile users

When mobile device orientation changes during upload
Then the layout adapts fluidly to new orientation
And upload progress persists without interruption
And all UI elements remain properly sized and accessible
```

### Scenario 9: Multiple File Handling and Queue Management
```gherkin
Given the user has successfully uploaded one video file
When the user attempts to drag another video file to the dropzone
Then the dropzone shows a replacement confirmation dialog
And displays "Replace current video with new file?" message
And provides "Replace" and "Cancel" buttons
And shows both filenames for comparison

When the user clicks "Replace"
Then the current upload area clears
And the new file begins uploading immediately
And the previous blob URL is marked for cleanup
And progress tracking starts fresh for the new file

When the user clicks "Cancel" in the replacement dialog
Then the dialog closes without changes
And the original uploaded file remains active
And the dropzone returns to completed state
And drag operations are ignored until user explicitly chooses to replace
```

### Scenario 10: Integration with Processing Status Panel
```gherkin
Given a video file has been successfully uploaded via the dropzone
When the upload completes and blob URL is available
Then the Processing Status panel immediately updates
And shows "✓ Upload Complete" with green checkmark
And displays upload timing (e.g., "Completed in 45 seconds")  
And shows file size and upload speed metrics
And the blob URL becomes available for subsequent processing steps

When the next processing step (frame extraction) begins
Then the upload section remains in completed state
And shows a subtle connection line or indicator to processing status
And the blob URL remains accessible for debugging
And upload metrics are preserved in the debug panel

When any processing step fails and requires re-upload
Then the upload dropzone shows a "Re-upload Required" state
And provides clear explanation of why re-upload is needed
And maintains all previous upload attempt history in debug panel
And allows user to upload replacement file or retry with same file
```

## Acceptance Criteria Summary

### Visual Elements ✅
- Comprehensive visual states for all dropzone interactions
- Clear progress visualization with real-time updates
- Proper error state styling with distinctive colors
- Mobile-responsive design with appropriate touch targets

### Interaction Feedback ✅
- Immediate visual response to drag/drop actions
- Smooth transitions between states (100-200ms)
- Real-time progress updates with percentage and speed
- Clear success/error feedback with appropriate iconography

### Component Integration ✅
- Seamless connection to Processing Status panel  
- Proper state management across upload lifecycle
- Integration with file validation logic
- Connection to subsequent processing steps

### Accessibility ✅
- Full keyboard navigation support
- Screen reader announcements for all state changes
- Proper focus management and ARIA attributes
- Mobile touch interface optimization

### Error States ✅
- Network error handling with retry mechanisms
- File validation errors with clear messaging
- Upload failure recovery with multiple retry attempts
- Graceful degradation for edge cases
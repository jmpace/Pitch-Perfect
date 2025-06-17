#!/usr/bin/env python3
import json
import sys
import os

def create_fixed_segments(json_file, segment_duration=5.0):
    """Create fixed-duration segments from Whisper JSON output"""
    
    # Read the JSON file
    with open(json_file, 'r') as f:
        data = json.load(f)
    
    segments = data['segments']
    fixed_segments = []
    
    # Get total duration from last segment
    total_duration = segments[-1]['end'] if segments else 0
    
    # Create fixed duration segments
    current_time = 0
    segment_id = 1
    
    while current_time < total_duration:
        segment_end = min(current_time + segment_duration, total_duration)
        segment_text = []
        
        # Find all text that falls within this time window
        for seg in segments:
            # Check if segment's midpoint falls within our window
            seg_midpoint = (seg['start'] + seg['end']) / 2
            if current_time <= seg_midpoint < segment_end:
                segment_text.append(seg['text'].strip())
        
        # Combine text for this time window
        combined_text = ' '.join(segment_text)
        
        fixed_segments.append({
            'id': segment_id,
            'start': current_time,
            'end': segment_end,
            'text': combined_text
        })
        
        current_time = segment_end
        segment_id += 1
    
    return fixed_segments

def save_as_srt(segments, output_file):
    """Save segments as SRT file"""
    with open(output_file, 'w') as f:
        for seg in segments:
            # Convert seconds to SRT timestamp format
            start_hours = int(seg['start'] // 3600)
            start_mins = int((seg['start'] % 3600) // 60)
            start_secs = seg['start'] % 60
            
            end_hours = int(seg['end'] // 3600)
            end_mins = int((seg['end'] % 3600) // 60)
            end_secs = seg['end'] % 60
            
            f.write(f"{seg['id']}\n")
            f.write(f"{start_hours:02d}:{start_mins:02d}:{start_secs:06.3f} --> "
                   f"{end_hours:02d}:{end_mins:02d}:{end_secs:06.3f}\n")
            f.write(f"{seg['text']}\n\n")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python whisper_fixed_segments.py <whisper_json_file> [segment_duration]")
        sys.exit(1)
    
    json_file = sys.argv[1]
    segment_duration = float(sys.argv[2]) if len(sys.argv) > 2 else 5.0
    
    # Create fixed segments
    fixed_segments = create_fixed_segments(json_file, segment_duration)
    
    # Save as new JSON
    output_json = json_file.replace('.json', '_fixed_segments.json')
    with open(output_json, 'w') as f:
        json.dump({'segments': fixed_segments}, f, indent=2)
    
    # Save as SRT
    output_srt = json_file.replace('.json', '_fixed_segments.srt')
    save_as_srt(fixed_segments, output_srt)
    
    print(f"Created {len(fixed_segments)} fixed segments of {segment_duration} seconds")
    print(f"JSON output: {output_json}")
    print(f"SRT output: {output_srt}")
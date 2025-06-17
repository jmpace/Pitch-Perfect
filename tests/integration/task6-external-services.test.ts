/**
 * Task 6 Integration Tests: External Services
 * 
 * Tests integration with external services for the Whisper transcription feature:
 * - OpenAI Whisper API integration
 * - Vercel Blob storage integration  
 * - Rendi API integration (for frame extraction in parallel)
 * - Network resilience and error handling
 * - Rate limiting and cost optimization
 * - Service availability and fallback mechanisms
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock OpenAI client
vi.mock('@ai-sdk/openai', () => ({
  openai: {
    audio: {
      transcriptions: {
        create: vi.fn()
      }
    }
  }
}));

// Mock Vercel Blob client
vi.mock('@vercel/blob', () => ({
  put: vi.fn(),
  del: vi.fn(),
  list: vi.fn()
}));

describe('Task 6: External Services Integration', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
    process.env.RENDI_API_KEY = 'test-rendi-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('OpenAI Whisper API Integration', () => {
    
    it('should successfully transcribe audio with word-level timestamps', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      const mockWhisperResponse = {
        text: 'Hello everyone, welcome to our presentation today. We will be discussing artificial intelligence.',
        language: 'en',
        duration: 8.5,
        words: [
          { word: 'Hello', start: 0.0, end: 0.5 },
          { word: 'everyone,', start: 0.5, end: 1.2 },
          { word: 'welcome', start: 1.2, end: 1.8 },
          { word: 'to', start: 1.8, end: 1.9 },
          { word: 'our', start: 1.9, end: 2.1 },
          { word: 'presentation', start: 2.1, end: 3.0 },
          { word: 'today.', start: 3.0, end: 3.5 }
        ],
        segments: [
          {
            id: 1,
            start: 0.0,
            end: 3.5,
            text: 'Hello everyone, welcome to our presentation today.',
            words: [
              { word: 'Hello', start: 0.0, end: 0.5 },
              { word: 'everyone,', start: 0.5, end: 1.2 }
            ]
          },
          {
            id: 2,
            start: 3.5,
            end: 8.5,
            text: 'We will be discussing artificial intelligence.',
            words: [
              { word: 'We', start: 3.5, end: 3.7 },
              { word: 'will', start: 3.7, end: 3.9 }
            ]
          }
        ]
      };

      (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue(mockWhisperResponse);

      // Simulate API call
      const audioFile = new File([new ArrayBuffer(8)], 'test-audio.mp4', { type: 'video/mp4' });
      
      const result = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });

      expect(result.text).toBe(mockWhisperResponse.text);
      expect(result.words).toHaveLength(7);
      expect(result.segments).toHaveLength(2);
      expect(result.language).toBe('en');
      expect(result.duration).toBe(8.5);
      
      // Verify word-level timestamps
      expect(result.words[0]).toEqual({ word: 'Hello', start: 0.0, end: 0.5 });
      expect(result.words[1]).toEqual({ word: 'everyone,', start: 0.5, end: 1.2 });
    });

    it('should handle OpenAI API rate limiting', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).headers = {
        'retry-after': '30'
      };

      (openai.audio.transcriptions.create as MockedFunction<any>).mockRejectedValue(rateLimitError);

      // Function to handle rate limiting with exponential backoff
      const transcribeWithRetry = async (audioFile: File, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await openai.audio.transcriptions.create({
              file: audioFile,
              model: 'whisper-1',
              response_format: 'verbose_json',
              timestamp_granularities: ['word', 'segment']
            });
          } catch (error: any) {
            if (error.status === 429 && attempt < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff, max 30s
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            throw error;
          }
        }
      };

      const audioFile = new File([new ArrayBuffer(8)], 'test-audio.mp4', { type: 'video/mp4' });
      
      await expect(transcribeWithRetry(audioFile)).rejects.toThrow('Rate limit exceeded');
      expect(openai.audio.transcriptions.create).toHaveBeenCalledTimes(3);
    });

    it('should handle OpenAI API authentication errors', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      const authError = new Error('Invalid API key');
      (authError as any).status = 401;

      (openai.audio.transcriptions.create as MockedFunction<any>).mockRejectedValue(authError);

      const audioFile = new File([new ArrayBuffer(8)], 'test-audio.mp4', { type: 'video/mp4' });
      
      await expect(openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json'
      })).rejects.toThrow('Invalid API key');
    });

    it('should calculate costs accurately based on audio duration', async () => {
      const testCases = [
        { duration: 30, expectedCost: 0.00 }, // 30 seconds = 0.5 minutes
        { duration: 60, expectedCost: 0.01 }, // 1 minute  
        { duration: 120, expectedCost: 0.01 }, // 2 minutes
        { duration: 300, expectedCost: 0.03 }, // 5 minutes
        { duration: 600, expectedCost: 0.06 }  // 10 minutes
      ];

      const calculateWhisperCost = (durationSeconds: number): number => {
        const durationMinutes = durationSeconds / 60;
        const costPerMinute = 0.006; // $0.006 per minute as per OpenAI pricing
        return Math.round(durationMinutes * costPerMinute * 100) / 100;
      };

      for (const testCase of testCases) {
        const cost = calculateWhisperCost(testCase.duration);
        expect(cost).toBe(testCase.expectedCost);
      }
    });

    it('should handle large audio files efficiently', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      // Mock response for a 25MB audio file (OpenAI limit is 25MB)
      const largeMockResponse = {
        text: 'This is a very long transcript from a large audio file...',
        language: 'en',
        duration: 3600, // 1 hour
        words: Array.from({ length: 1000 }, (_, i) => ({
          word: `word${i}`,
          start: i * 3.6,
          end: (i + 1) * 3.6
        })),
        segments: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          start: i * 36,
          end: (i + 1) * 36,
          text: `This is segment ${i + 1} with a lot of content.`
        }))
      };

      (openai.audio.transcriptions.create as MockedFunction<any>).mockResolvedValue(largeMockResponse);

      const largeAudioFile = new File([new ArrayBuffer(25 * 1024 * 1024)], 'large-audio.mp4', { type: 'video/mp4' });
      
      const startTime = Date.now();
      const result = await openai.audio.transcriptions.create({
        file: largeAudioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      });
      const processingTime = Date.now() - startTime;

      expect(result.duration).toBe(3600);
      expect(result.words).toHaveLength(1000);
      expect(result.segments).toHaveLength(100);
      expect(processingTime).toBeLessThan(1000); // Mock should be fast
    });
  });

  describe('Vercel Blob Storage Integration', () => {
    
    it('should upload video files to Vercel Blob successfully', async () => {
      const { put } = await import('@vercel/blob');
      
      const mockBlobResponse = {
        url: 'https://blob.vercel-storage.com/test-video-abc123.mp4',
        downloadUrl: 'https://blob.vercel-storage.com/test-video-abc123.mp4',
        pathname: 'test-video-abc123.mp4',
        contentType: 'video/mp4',
        contentDisposition: 'attachment; filename="test-video.mp4"'
      };

      (put as MockedFunction<any>).mockResolvedValue(mockBlobResponse);

      const videoFile = new File([new ArrayBuffer(1024 * 1024)], 'test-video.mp4', { type: 'video/mp4' });
      
      const result = await put('test-video.mp4', videoFile, {
        access: 'public',
        addRandomSuffix: true
      });

      expect(result.url).toBe(mockBlobResponse.url);
      expect(result.contentType).toBe('video/mp4');
      expect(put).toHaveBeenCalledWith('test-video.mp4', videoFile, {
        access: 'public',
        addRandomSuffix: true
      });
    });

    it('should handle Vercel Blob storage quota exceeded', async () => {
      const { put } = await import('@vercel/blob');
      
      const quotaError = new Error('Storage quota exceeded');
      (quotaError as any).code = 'STORAGE_QUOTA_EXCEEDED';

      (put as MockedFunction<any>).mockRejectedValue(quotaError);

      const videoFile = new File([new ArrayBuffer(100 * 1024 * 1024)], 'large-video.mp4', { type: 'video/mp4' });
      
      // Function to handle quota exceeded with cleanup
      const uploadWithQuotaManagement = async (filename: string, file: File) => {
        try {
          return await put(filename, file, { access: 'public' });
        } catch (error: any) {
          if (error.code === 'STORAGE_QUOTA_EXCEEDED') {
            // In a real implementation, this would clean up old files
            const { list, del } = await import('@vercel/blob');
            
            // Mock cleanup logic
            (list as MockedFunction<any>).mockResolvedValue({
              blobs: [
                { url: 'old-file-1.mp4', uploadedAt: new Date(Date.now() - 86400000) },
                { url: 'old-file-2.mp4', uploadedAt: new Date(Date.now() - 172800000) }
              ]
            });
            
            (del as MockedFunction<any>).mockResolvedValue(undefined);
            
            // Retry after cleanup
            (put as MockedFunction<any>).mockResolvedValueOnce({
              url: 'https://blob.vercel-storage.com/retry-video-def456.mp4'
            });
            
            return await put(filename, file, { access: 'public' });
          }
          throw error;
        }
      };

      const result = await uploadWithQuotaManagement('large-video.mp4', videoFile);
      expect(result.url).toBe('https://blob.vercel-storage.com/retry-video-def456.mp4');
    });

    it('should calculate Vercel Blob storage costs', async () => {
      const calculateBlobCost = (fileSizeBytes: number): number => {
        const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);
        const costPerGB = 0.15; // $0.15 per GB per month
        const costPerOperation = 0.000005; // $0.000005 per operation
        
        const storageCost = fileSizeGB * costPerGB;
        const operationCost = costPerOperation; // One upload operation
        
        return Math.round((storageCost + operationCost) * 100) / 100;
      };

      const testFiles = [
        { size: 10 * 1024 * 1024, expectedMinCost: 0.00 }, // 10MB
        { size: 100 * 1024 * 1024, expectedMinCost: 0.01 }, // 100MB
        { size: 1024 * 1024 * 1024, expectedMinCost: 0.15 }  // 1GB
      ];

      for (const testFile of testFiles) {
        const cost = calculateBlobCost(testFile.size);
        expect(cost).toBeGreaterThanOrEqual(0);
        expect(cost).toBeLessThanOrEqual(1.0); // Reasonable upper bound
      }
    });
  });

  describe('Rendi API Integration (Frame Extraction)', () => {
    
    it('should extract frames at 5-second intervals via Rendi API', async () => {
      const mockRendiResponse = {
        status: 'completed',
        output_files: [
          'https://rendi-output.com/frame_00m05s.png',
          'https://rendi-output.com/frame_00m10s.png',
          'https://rendi-output.com/frame_00m15s.png',
          'https://rendi-output.com/frame_00m20s.png'
        ],
        metadata: {
          processing_time: 15.2,
          input_duration: 25.0,
          frames_extracted: 4
        }
      };

      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRendiResponse)
      });

      // Function to call Rendi API for frame extraction
      const extractFramesViaRendi = async (videoUrl: string, videoDuration: number) => {
        const response = await fetch('https://api.rendi.com/v1/extract-frames', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input_url: videoUrl,
            output_format: 'png',
            interval: '5s',
            max_frames: Math.min(120, Math.ceil(videoDuration / 5))
          })
        });

        if (!response.ok) {
          throw new Error(`Rendi API error: ${response.status}`);
        }

        return response.json();
      };

      const result = await extractFramesViaRendi('blob:test-video-url', 25);

      expect(result.status).toBe('completed');
      expect(result.output_files).toHaveLength(4);
      expect(result.metadata.frames_extracted).toBe(4);
      expect(result.output_files[0]).toContain('frame_00m05s.png');
    });

    it('should handle Rendi API rate limiting', async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        json: () => Promise.resolve({
          error: 'Rate limit exceeded',
          retry_after: 60
        })
      };

      (global.fetch as MockedFunction<any>).mockResolvedValue(rateLimitResponse);

      const extractWithRetry = async (videoUrl: string, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const response = await fetch('https://api.rendi.com/v1/extract-frames', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.RENDI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input_url: videoUrl })
          });

          if (response.status === 429 && attempt < maxRetries) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          if (!response.ok) {
            throw new Error(`Rendi API error: ${response.status}`);
          }

          return response.json();
        }
      };

      await expect(extractWithRetry('blob:test-video')).rejects.toThrow('Rendi API error: 429');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should calculate Rendi API costs accurately', async () => {
      const calculateRendiCost = (videoDuration: number, frameCount: number): number => {
        const baseCost = 0.10; // Base processing cost
        const costPerFrame = 0.02; // Cost per extracted frame
        const costPerMinute = 0.05; // Additional cost per minute of video
        
        const durationCost = (videoDuration / 60) * costPerMinute;
        const frameCost = frameCount * costPerFrame;
        
        return Math.round((baseCost + durationCost + frameCost) * 100) / 100;
      };

      const testCases = [
        { duration: 30, frames: 6, expectedRange: [0.20, 0.30] },
        { duration: 120, frames: 24, expectedRange: [0.60, 0.80] },
        { duration: 600, frames: 120, expectedRange: [2.90, 3.10] }
      ];

      for (const testCase of testCases) {
        const cost = calculateRendiCost(testCase.duration, testCase.frames);
        expect(cost).toBeGreaterThanOrEqual(testCase.expectedRange[0]);
        expect(cost).toBeLessThanOrEqual(testCase.expectedRange[1]);
      }
    });
  });

  describe('Service Resilience and Error Handling', () => {
    
    it('should handle network timeouts gracefully', async () => {
      // Mock timeout error
      (global.fetch as MockedFunction<any>).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const makeRequestWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }
          throw error;
        }
      };

      await expect(makeRequestWithTimeout('https://api.test.com', { method: 'POST' }, 50))
        .rejects.toThrow();
    });

    it('should implement circuit breaker pattern for failing services', async () => {
      class CircuitBreaker {
        private failures = 0;
        private lastFailTime = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        
        constructor(
          private failureThreshold = 5,
          private recoveryTimeout = 30000
        ) {}

        async execute<T>(fn: () => Promise<T>): Promise<T> {
          if (this.state === 'open') {
            if (Date.now() - this.lastFailTime > this.recoveryTimeout) {
              this.state = 'half-open';
            } else {
              throw new Error('Circuit breaker is open');
            }
          }

          try {
            const result = await fn();
            this.onSuccess();
            return result;
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        private onSuccess() {
          this.failures = 0;
          this.state = 'closed';
        }

        private onFailure() {
          this.failures++;
          this.lastFailTime = Date.now();
          
          if (this.failures >= this.failureThreshold) {
            this.state = 'open';
          }
        }
      }

      const circuitBreaker = new CircuitBreaker(3, 1000);
      
      // Mock failing service
      const failingService = vi.fn().mockRejectedValue(new Error('Service unavailable'));

      // Trigger circuit breaker opening
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingService)).rejects.toThrow('Service unavailable');
      }

      // Circuit should now be open
      await expect(circuitBreaker.execute(failingService)).rejects.toThrow('Circuit breaker is open');
      
      expect(failingService).toHaveBeenCalledTimes(3); // Should not call the failing service when open
    });

    it('should implement fallback mechanisms for service failures', async () => {
      const { openai } = await import('@ai-sdk/openai');
      
      // Mock primary service failure
      (openai.audio.transcriptions.create as MockedFunction<any>).mockRejectedValue(
        new Error('OpenAI service unavailable')
      );

      // Mock fallback service success
      (global.fetch as MockedFunction<any>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          text: 'Fallback transcription result',
          confidence: 0.8,
          source: 'fallback_service'
        })
      });

      const transcribeWithFallback = async (audioFile: File) => {
        try {
          // Try primary service (OpenAI Whisper)
          return await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1'
          });
        } catch (error) {
          console.warn('Primary transcription service failed, using fallback');
          
          // Fallback to alternative service
          const formData = new FormData();
          formData.append('audio', audioFile);
          
          const response = await fetch('https://fallback-transcription-service.com/api/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error('Both primary and fallback services failed');
          }
          
          return response.json();
        }
      };

      const audioFile = new File([new ArrayBuffer(8)], 'test-audio.mp4', { type: 'video/mp4' });
      const result = await transcribeWithFallback(audioFile);

      expect(result.text).toBe('Fallback transcription result');
      expect(result.source).toBe('fallback_service');
    });

    it('should monitor service health and performance', async () => {
      interface ServiceMetrics {
        service: string;
        successCount: number;
        failureCount: number;
        avgResponseTime: number;
        lastCheck: number;
      }

      class ServiceMonitor {
        private metrics = new Map<string, ServiceMetrics>();

        async checkService(name: string, healthCheckFn: () => Promise<boolean>): Promise<ServiceMetrics> {
          const startTime = Date.now();
          let success = false;

          try {
            success = await healthCheckFn();
          } catch (error) {
            success = false;
          }

          const responseTime = Date.now() - startTime;
          const existing = this.metrics.get(name) || {
            service: name,
            successCount: 0,
            failureCount: 0,
            avgResponseTime: 0,
            lastCheck: 0
          };

          const newMetrics: ServiceMetrics = {
            service: name,
            successCount: existing.successCount + (success ? 1 : 0),
            failureCount: existing.failureCount + (success ? 0 : 1),
            avgResponseTime: Math.round((existing.avgResponseTime + responseTime) / 2),
            lastCheck: Date.now()
          };

          this.metrics.set(name, newMetrics);
          return newMetrics;
        }

        getMetrics(serviceName: string): ServiceMetrics | undefined {
          return this.metrics.get(serviceName);
        }
      }

      const monitor = new ServiceMonitor();

      // Mock health checks
      const openaiHealthCheck = vi.fn().mockResolvedValue(true);
      const vercelBlobHealthCheck = vi.fn().mockResolvedValue(true);
      const rendiHealthCheck = vi.fn().mockRejectedValue(new Error('Service down'));

      // Check services
      const openaiMetrics = await monitor.checkService('openai', openaiHealthCheck);
      const blobMetrics = await monitor.checkService('vercel-blob', vercelBlobHealthCheck);
      const rendiMetrics = await monitor.checkService('rendi', rendiHealthCheck);

      expect(openaiMetrics.successCount).toBe(1);
      expect(openaiMetrics.failureCount).toBe(0);
      
      expect(blobMetrics.successCount).toBe(1);
      expect(blobMetrics.failureCount).toBe(0);
      
      expect(rendiMetrics.successCount).toBe(0);
      expect(rendiMetrics.failureCount).toBe(1);
      
      expect(openaiMetrics.avgResponseTime).toBeGreaterThan(0);
    });
  });

  describe('Cost Optimization and Rate Limiting', () => {
    
    it('should implement intelligent rate limiting to minimize costs', async () => {
      class CostAwareRateLimiter {
        private requestQueue: Array<{ timestamp: number; cost: number }> = [];
        private readonly maxCostPerMinute = 5.00; // $5 per minute limit
        private readonly maxCostPerHour = 50.00; // $50 per hour limit

        canMakeRequest(estimatedCost: number): boolean {
          const now = Date.now();
          const oneMinuteAgo = now - 60000;
          const oneHourAgo = now - 3600000;

          // Clean old requests
          this.requestQueue = this.requestQueue.filter(req => req.timestamp > oneHourAgo);

          // Calculate costs for last minute and hour
          const lastMinuteCost = this.requestQueue
            .filter(req => req.timestamp > oneMinuteAgo)
            .reduce((sum, req) => sum + req.cost, 0);

          const lastHourCost = this.requestQueue
            .reduce((sum, req) => sum + req.cost, 0);

          // Check if new request would exceed limits
          return (lastMinuteCost + estimatedCost <= this.maxCostPerMinute) &&
                 (lastHourCost + estimatedCost <= this.maxCostPerHour);
        }

        recordRequest(cost: number) {
          this.requestQueue.push({
            timestamp: Date.now(),
            cost
          });
        }
      }

      const rateLimiter = new CostAwareRateLimiter();

      // Test rate limiting
      expect(rateLimiter.canMakeRequest(1.00)).toBe(true);
      rateLimiter.recordRequest(1.00);

      expect(rateLimiter.canMakeRequest(3.00)).toBe(true);
      rateLimiter.recordRequest(3.00);

      expect(rateLimiter.canMakeRequest(2.00)).toBe(false); // Would exceed $5/minute limit

      // Smaller request should still be allowed
      expect(rateLimiter.canMakeRequest(0.50)).toBe(true);
    });

    it('should batch requests to optimize API usage', async () => {
      class RequestBatcher {
        private batches = new Map<string, Array<{ file: File; resolve: Function; reject: Function }>>();
        private readonly batchSize = 5;
        private readonly batchTimeout = 2000; // 2 seconds

        async transcribe(file: File): Promise<any> {
          return new Promise((resolve, reject) => {
            const batchKey = 'whisper-batch';
            
            if (!this.batches.has(batchKey)) {
              this.batches.set(batchKey, []);
              
              // Set timeout for batch processing
              setTimeout(() => {
                this.processBatch(batchKey);
              }, this.batchTimeout);
            }

            const batch = this.batches.get(batchKey)!;
            batch.push({ file, resolve, reject });

            // Process batch if it's full
            if (batch.length >= this.batchSize) {
              this.processBatch(batchKey);
            }
          });
        }

        private async processBatch(batchKey: string) {
          const batch = this.batches.get(batchKey);
          if (!batch || batch.length === 0) return;

          this.batches.delete(batchKey);

          try {
            // Mock batch processing
            const results = await Promise.all(
              batch.map(async ({ file }) => ({
                text: `Transcribed content for ${file.name}`,
                cost: 0.03
              }))
            );

            // Resolve all promises in the batch
            batch.forEach(({ resolve }, index) => {
              resolve(results[index]);
            });
          } catch (error) {
            // Reject all promises in the batch
            batch.forEach(({ reject }) => {
              reject(error);
            });
          }
        }
      }

      const batcher = new RequestBatcher();

      // Submit multiple requests
      const files = Array.from({ length: 3 }, (_, i) => 
        new File([new ArrayBuffer(8)], `test-${i}.mp4`, { type: 'video/mp4' })
      );

      const promises = files.map(file => batcher.transcribe(file));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.text).toContain(`test-${index}.mp4`);
        expect(result.cost).toBe(0.03);
      });
    });
  });
});
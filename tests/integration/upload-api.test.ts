import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { POST } from '@/app/api/experiment/upload/route'
import { NextRequest } from 'next/server'

// Mock Vercel blob
vi.mock('@vercel/blob', () => ({
  put: vi.fn()
}))

import { put } from '@vercel/blob'

const mockPut = vi.mocked(put)

describe('Upload API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
  })

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN
  })

  describe('POST /api/experiment/upload', () => {
    it('should successfully upload a valid video file', async () => {
      const mockFile = new File(['test video content'], 'test.mp4', { type: 'video/mp4' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const mockBlobResponse = {
        url: 'https://blob.vercel-storage.com/test-123.mp4',
        pathname: 'test-123.mp4'
      }

      mockPut.mockResolvedValue(mockBlobResponse)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.blobUrl).toBe(mockBlobResponse.url)
      expect(result.filename).toBe(mockBlobResponse.pathname)
      expect(result.size).toBe(mockFile.size)
      expect(result.type).toBe(mockFile.type)
      expect(result.uploadTime).toBeTypeOf('number')
    })

    it('should reject files with invalid MIME types', async () => {
      const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Invalid file type. Please select MP4, MOV, or WebM')
    })

    it('should reject files larger than 100MB', async () => {
      const largeFile = new File(['x'.repeat(101 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' })
      const formData = new FormData()
      formData.append('file', largeFile)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('File too large. Maximum size is 100MB')
    })

    it('should return error when no file is provided', async () => {
      const formData = new FormData()

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('No file provided')
    })

    it('should return error when blob token is not configured', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN

      const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Blob storage not configured')
    })

    it('should handle Vercel blob upload errors', async () => {
      const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' })
      const formData = new FormData()
      formData.append('file', mockFile)

      mockPut.mockRejectedValue(new Error('Blob upload failed'))

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Upload failed. Please try again.')
    })

    it('should accept all valid video formats', async () => {
      const validFormats = [
        { type: 'video/mp4', ext: 'mp4' },
        { type: 'video/mov', ext: 'mov' },
        { type: 'video/webm', ext: 'webm' }
      ]

      for (const format of validFormats) {
        const mockFile = new File(['test content'], `test.${format.ext}`, { type: format.type })
        const formData = new FormData()
        formData.append('file', mockFile)

        const mockBlobResponse = {
          url: `https://blob.vercel-storage.com/test-${format.ext}-123.${format.ext}`,
          pathname: `test-${format.ext}-123.${format.ext}`
        }

        mockPut.mockResolvedValue(mockBlobResponse)

        const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
          method: 'POST',
          body: formData
        })

        const response = await POST(request)
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.success).toBe(true)
        expect(result.type).toBe(format.type)
      }
    })

    it('should generate unique filenames with timestamps', async () => {
      const mockFile = new File(['test content'], 'original.mp4', { type: 'video/mp4' })
      const formData = new FormData()
      formData.append('file', mockFile)

      const mockBlobResponse = {
        url: 'https://blob.vercel-storage.com/experiment-video-123456789.mp4',
        pathname: 'experiment-video-123456789.mp4'
      }

      mockPut.mockResolvedValue(mockBlobResponse)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      await POST(request)

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringMatching(/^experiment-video-\d+\.mp4$/),
        mockFile,
        {
          access: 'public',
          token: 'test-token'
        }
      )
    })
  })

  describe('API data flow integration', () => {
    it('should maintain data consistency through the upload flow', async () => {
      const originalFile = new File(['test video data'], 'integration-test.mp4', { 
        type: 'video/mp4'
      })
      const formData = new FormData()
      formData.append('file', originalFile)

      const mockBlobResponse = {
        url: 'https://blob.vercel-storage.com/integration-test-123.mp4',
        pathname: 'integration-test-123.mp4'
      }

      mockPut.mockResolvedValue(mockBlobResponse)

      const request = new NextRequest('http://localhost:3000/api/experiment/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const result = await response.json()

      // Verify data consistency
      expect(result.size).toBe(originalFile.size)
      expect(result.type).toBe(originalFile.type)
      expect(result.blobUrl).toBe(mockBlobResponse.url)
      expect(result.filename).toBe(mockBlobResponse.pathname)
      
      // Verify blob service was called with correct parameters
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('integration-test'),
        originalFile,
        {
          access: 'public',
          token: 'test-token'
        }
      )
    })
  })
})
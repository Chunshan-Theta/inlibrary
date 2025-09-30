import axios from 'axios'
import { Paper, SearchFilters, PaperCreate, Author, Tag, Venue, ExcelImportResult, ComplexSearchQuery, ExcelPreviewResponse, ExcelImportConfig, BatchTagOperation, BatchTagResult } from '../types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
})

// 論文相關 API
export const papersApi = {
  // 獲取論文列表
  async getPapers(skip = 0, limit = 1000): Promise<Paper[]> {
    const response = await api.get(`/papers/?skip=${skip}&limit=${limit}`)
    return response.data
  },

  // 獲取單個論文
  async getPaper(id: number): Promise<Paper> {
    const response = await api.get(`/papers/${id}`)
    return response.data
  },

  // 創建論文
  async createPaper(paper: PaperCreate): Promise<Paper> {
    const response = await api.post('/papers/', paper)
    return response.data
  },

  // 搜索論文
  async searchPapers(filters: SearchFilters, skip = 0, limit = 100): Promise<Paper[]> {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v.toString()))
        } else {
          params.append(key, value.toString())
        }
      }
    })
    
    params.append('skip', skip.toString())
    params.append('limit', limit.toString())
    
    const response = await api.get(`/papers/search/?${params.toString()}`)
    return response.data
  },

  // 複雜查詢搜索
  async searchPapersComplex(query: ComplexSearchQuery, skip = 0, limit = 100): Promise<Paper[]> {
    const response = await api.post('/papers/search/complex/', {
      ...query,
      skip,
      limit
    })
    return response.data
  },

  // 上傳 PDF 文件
  async uploadPdf(paperId: number, file: File): Promise<{ message: string; file_url: string }> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post(`/papers/${paperId}/upload-pdf/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // 下載 PDF 文件
  async downloadPdf(paperId: number): Promise<Blob> {
    const response = await api.get(`/papers/${paperId}/download-pdf/`, {
      responseType: 'blob',
    })
    return response.data
  },

  // 刪除論文
  async deletePaper(id: number): Promise<void> {
    await api.delete(`/papers/${id}`)
  },

  // 批量標籤操作
  async batchTagOperation(operation: BatchTagOperation): Promise<BatchTagResult> {
    const response = await api.post('/papers/batch-tags/', operation)
    return response.data
  },

  // 獲取論文總數
  async getPapersCount(): Promise<{ count: number }> {
    const response = await api.get('/papers/count/')
    return response.data
  },

  // 獲取特定標籤的論文數量
  async getPapersCountByTag(tagName: string): Promise<{ tag_name: string; count: number }> {
    const response = await api.get(`/papers/count-by-tag/${encodeURIComponent(tagName)}`)
    return response.data
  },

  // 文件預覽（支持Excel、CSV、TSV）
  async previewFile(file: File): Promise<ExcelPreviewResponse> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/papers/preview-file/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Excel 預覽（兼容性）
  async previewExcel(file: File): Promise<ExcelPreviewResponse> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/papers/preview-excel/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // 文件配置導入（支持Excel、CSV、TSV）
  async importFileWithConfig(config: ExcelImportConfig): Promise<ExcelImportResult> {
    const response = await api.post('/papers/import-file-with-config/', config)
    return response.data
  },

  // Excel 配置導入（兼容性）
  async importExcelWithConfig(config: ExcelImportConfig): Promise<ExcelImportResult> {
    const response = await api.post('/papers/import-excel-with-config/', config)
    return response.data
  },

  // 文件導入（支持Excel、CSV、TSV）
  async importFile(file: File): Promise<ExcelImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/papers/import-file/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Excel 導入（舊版本，保持兼容性）
  async importExcel(file: File): Promise<ExcelImportResult> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/papers/import-excel/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },
}

// 作者相關 API
export const authorsApi = {
  async getAuthors(): Promise<Author[]> {
    const response = await api.get('/authors/')
    return response.data
  },

  async createAuthor(author: { name: string; email?: string; affiliation?: string }): Promise<Author> {
    const response = await api.post('/authors/', author)
    return response.data
  },
}

// 標籤相關 API
export const tagsApi = {
  async getTags(): Promise<Tag[]> {
    const response = await api.get('/tags/')
    return response.data
  },

  async createTag(tag: { name: string; color?: string }): Promise<Tag> {
    const response = await api.post('/tags/', tag)
    return response.data
  },
}

// 期刊/會議相關 API
export const venuesApi = {
  async getVenues(): Promise<Venue[]> {
    const response = await api.get('/venues/')
    return response.data
  },

  async createVenue(venue: { name: string; type: 'journal' | 'conference'; impact_factor?: number }): Promise<Venue> {
    const response = await api.post('/venues/', venue)
    return response.data
  },
}

// 聊天相關 API
export const chatApi = {
  async sendMessage(message: string, sessionId?: string): Promise<{ response: string; message?: string }> {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId: sessionId || 'default-session'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Failed to send message: ${errorData.error || response.statusText}`)
    }

    return await response.json()
  },
} 
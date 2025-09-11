import React, { useState } from 'react'
import { useMutation, useQueryClient } from 'react-query'
import { papersApi } from '../api/papers'
import { ExcelImportResult, ExcelPreviewResponse, FieldMapping, DefaultFieldMapping, ExcelImportConfig } from '../types'

interface ExcelImportModalProps {
  isOpen: boolean
  onClose: () => void
}

type ImportStep = 'upload' | 'preview' | 'configure' | 'importing' | 'result'

export default function ExcelImportModal({ isOpen, onClose }: ExcelImportModalProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ExcelPreviewResponse | null>(null)
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const queryClient = useQueryClient()

  // 預覽Excel文件的mutation
  const previewMutation = useMutation(papersApi.previewExcel, {
    onSuccess: (result) => {
      setPreviewData(result)
      // 初始化欄位映射
      initializeFieldMappings(result)
      setCurrentStep('preview')
    },
    onError: (error) => {
      console.error('Excel預覽失敗:', error)
      alert('Excel預覽失敗，請檢查文件格式')
    }
  })

  // 導入Excel的mutation
  const importMutation = useMutation(papersApi.importExcelWithConfig, {
    onSuccess: (result) => {
      setImportResult(result)
      setCurrentStep('result')
      queryClient.invalidateQueries('papers')
    },
    onError: (error) => {
      console.error('Excel導入失敗:', error)
      alert('Excel導入失敗')
      setCurrentStep('configure')
    }
  })

  const initializeFieldMappings = (preview: ExcelPreviewResponse) => {
    const mappings: FieldMapping[] = []
    
    preview.default_mappings.forEach((defaultMapping) => {
      // 嘗試自動匹配欄位
      let bestMatch = ''
      let bestScore = 0
      
      preview.preview.columns.forEach((column) => {
        // 計算相似度分數
        const score = calculateSimilarity(column.name, defaultMapping.suggestions)
        if (score > bestScore && score > 0.5) {
          bestScore = score
          bestMatch = column.name
        }
      })
      
      mappings.push({
        excel_column: bestMatch,
        target_field: defaultMapping.target_field,
        is_required: defaultMapping.is_required
      })
    })
    
    setFieldMappings(mappings)
  }

  const calculateSimilarity = (columnName: string, suggestions: string[]): number => {
    let maxScore = 0
    const normalizedColumn = columnName.toLowerCase()
    
    suggestions.forEach((suggestion) => {
      const normalizedSuggestion = suggestion.toLowerCase()
      
      // 完全匹配
      if (normalizedColumn === normalizedSuggestion) {
        maxScore = Math.max(maxScore, 1.0)
        return
      }
      
      // 包含匹配
      if (normalizedColumn.includes(normalizedSuggestion) || 
          normalizedSuggestion.includes(normalizedColumn)) {
        maxScore = Math.max(maxScore, 0.8)
      }
      
      // 部分匹配
      const words1 = normalizedColumn.split(/\s+/)
      const words2 = normalizedSuggestion.split(/\s+/)
      let commonWords = 0
      
      words1.forEach(word1 => {
        words2.forEach(word2 => {
          if (word1 === word2) {
            commonWords++
          }
        })
      })
      
      if (commonWords > 0) {
        const score = commonWords / Math.max(words1.length, words2.length)
        maxScore = Math.max(maxScore, score * 0.6)
      }
    })
    
    return maxScore
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        alert('請選擇Excel文件 (.xlsx 或 .xls)')
        return
      }
      setSelectedFile(file)
    }
  }

  const handlePreview = () => {
    if (!selectedFile) {
      alert('請先選擇文件')
      return
    }
    previewMutation.mutate(selectedFile)
  }

  const handleMappingChange = (targetField: string, excelColumn: string) => {
    setFieldMappings(prev => 
      prev.map(mapping => 
        mapping.target_field === targetField 
          ? { ...mapping, excel_column: excelColumn }
          : mapping
      )
    )
  }

  const handleImport = () => {
    if (!previewData) return
    
    const config: ExcelImportConfig = {
      field_mappings: fieldMappings.filter(mapping => mapping.excel_column),
      preview_file_id: previewData.file_id
    }
    
    setCurrentStep('importing')
    importMutation.mutate(config)
  }

  const handleClose = () => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setPreviewData(null)
    setFieldMappings([])
    setImportResult(null)
    setShowDetails(false)
    onClose()
  }

  const getDefaultMapping = (targetField: string): DefaultFieldMapping | undefined => {
    return previewData?.default_mappings.find(m => m.target_field === targetField)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Excel 文件導入</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">關閉</span>
              ✕
            </button>
          </div>

          {/* 步驟指示器 */}
          <div className="mb-6">
            <div className="flex items-center">
              {[
                { id: 'upload', name: '上傳文件', completed: ['preview', 'configure', 'importing', 'result'].includes(currentStep) },
                { id: 'preview', name: '預覽數據', completed: ['configure', 'importing', 'result'].includes(currentStep) },
                { id: 'configure', name: '配置欄位', completed: ['importing', 'result'].includes(currentStep) },
                { id: 'result', name: '導入結果', completed: currentStep === 'result' }
              ].map((step, index) => (
                <React.Fragment key={step.id}>
                  <div className={`flex items-center ${
                    currentStep === step.id ? 'text-blue-600' : 
                    step.completed ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                      currentStep === step.id ? 'border-blue-600 bg-blue-50' :
                      step.completed ? 'border-green-600 bg-green-50' : 'border-gray-300'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <span className="ml-2 text-sm font-medium">{step.name}</span>
                  </div>
                  {index < 3 && (
                    <div className={`flex-1 h-0.5 mx-4 ${
                      step.completed ? 'bg-green-600' : 'bg-gray-300'
                    }`}></div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* 步驟內容 */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">支持的文件格式</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Web of Science 導出的 Excel 文件 (.xlsx, .xls)</li>
                  <li>• 文件應包含論文標題、作者、發表年份等基本信息</li>
                  <li>• 系統會自動識別並匹配欄位，您也可以手動配置</li>
                </ul>
              </div>

              <div>
                <label htmlFor="excel_file" className="block text-sm font-medium text-gray-700 mb-2">
                  選擇 Excel 文件
                </label>
                <input
                  type="file"
                  id="excel_file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-medium
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-green-600">
                    已選擇文件: {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  取消
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!selectedFile || previewMutation.isLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                >
                  {previewMutation.isLoading ? '分析中...' : '預覽數據'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'preview' && previewData && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-green-800 mb-2">文件分析結果</h3>
                <p className="text-sm text-green-700">
                  文件名: {previewData.preview.filename} | 
                  總行數: {previewData.preview.total_rows} | 
                  檢測到 {previewData.preview.columns.length} 個欄位
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">數據預覽</h3>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewData.preview.columns.map((column, index) => (
                            <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              <div>
                                <div className="font-medium">{column.name}</div>
                                <div className="text-xs text-gray-400">
                                  {column.data_type} | {column.non_null_count}/{previewData.preview.total_rows}
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.preview.sample_rows.map((row, index) => (
                          <tr key={index}>
                            {previewData.preview.columns.map((column, colIndex) => (
                              <td key={colIndex} className="px-4 py-2 text-sm text-gray-900 max-w-48 truncate">
                                {row[column.name] || <span className="text-gray-400">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  重新選擇
                </button>
                <button
                  onClick={() => setCurrentStep('configure')}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  配置欄位
                </button>
              </div>
            </div>
          )}

          {currentStep === 'configure' && previewData && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">欄位映射配置</h3>
                <p className="text-sm text-gray-600 mb-4">
                  請為每個目標欄位選擇對應的Excel欄位。系統已為您智能匹配了可能的對應關係。
                </p>
              </div>

              <div className="space-y-4">
                {fieldMappings.map((mapping) => {
                  const defaultMapping = getDefaultMapping(mapping.target_field)
                  if (!defaultMapping) return null

                  return (
                    <div key={mapping.target_field} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium text-gray-900">
                              {defaultMapping.display_name}
                            </h4>
                            {mapping.is_required && (
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                必填
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">
                            {defaultMapping.description}
                          </p>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              選擇Excel欄位
                            </label>
                            <select
                              value={mapping.excel_column}
                              onChange={(e) => handleMappingChange(mapping.target_field, e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">-- 請選擇 --</option>
                              {previewData.preview.columns.map((column) => (
                                <option key={column.name} value={column.name}>
                                  {column.name} ({column.data_type}, {column.non_null_count} 個有效值)
                                </option>
                              ))}
                            </select>
                          </div>

                          {mapping.excel_column && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">樣本數據:</p>
                              <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                                {previewData.preview.columns
                                  .find(col => col.name === mapping.excel_column)
                                  ?.sample_values.slice(0, 3).join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setCurrentStep('preview')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  上一步
                </button>
                <button
                  onClick={handleImport}
                  disabled={fieldMappings.filter(m => m.is_required).some(m => !m.excel_column)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                >
                  開始導入
                </button>
              </div>
            </div>
          )}

          {currentStep === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-lg font-medium text-gray-900">正在導入數據...</p>
              <p className="text-sm text-gray-600">請稍候，正在處理Excel文件</p>
            </div>
          )}

          {currentStep === 'result' && importResult && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="mt-2 text-lg font-medium text-gray-900">導入完成</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{importResult.total_rows}</div>
                  <div className="text-sm text-gray-500">總行數</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.successful_imports}</div>
                  <div className="text-sm text-gray-500">成功導入</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed_imports}</div>
                  <div className="text-sm text-gray-500">導入失敗</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    {showDetails ? '隱藏' : '顯示'} 錯誤詳情
                    <svg 
                      className={`ml-1 h-4 w-4 transform ${showDetails ? 'rotate-180' : ''}`} 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {showDetails && (
                    <div className="mt-2 max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                      <ul className="text-sm text-red-700 space-y-1">
                        {importResult.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  完成
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

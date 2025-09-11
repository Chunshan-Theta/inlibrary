import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { ComplexSearchQuery, FilterGroup, FilterCondition } from '../types'
import { authorsApi, tagsApi, venuesApi } from '../api/papers'
import { PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface QueryBuilderProps {
  onSearch: (query: ComplexSearchQuery) => void
  onReset: () => void
  initialQuery?: ComplexSearchQuery
}

interface SimpleCondition {
  id: string
  field: string
  operator: string
  value: string | string[] | number
  logicOperator?: 'AND' | 'OR'
}

interface SimpleGroup {
  id: string
  name: string
  conditions: SimpleCondition[]
  isExpanded: boolean
  logicOperator?: 'AND' | 'OR'
}

const createSimpleCondition = (): SimpleCondition => ({
  id: Math.random().toString(36).substr(2, 9),
  field: 'title_keyword',
  operator: 'contains',
  value: '',
  logicOperator: 'AND'
})

const createSimpleGroup = (name: string, isFirst: boolean = false): SimpleGroup => ({
  id: Math.random().toString(36).substr(2, 9),
  name,
  conditions: [createSimpleCondition()],
  isExpanded: true,
  logicOperator: isFirst ? undefined : 'AND'
})

export default function QueryBuilder({ onSearch, onReset }: QueryBuilderProps) {
  const [groups, setGroups] = useState<SimpleGroup[]>([createSimpleGroup('主要搜索', true)])

  // 獲取下拉選項數據
  const { data: authors } = useQuery('authors', authorsApi.getAuthors)
  const { data: tags } = useQuery('tags', tagsApi.getTags)
  const { data: venues } = useQuery('venues', venuesApi.getVenues)

  // 群組操作
  const addGroup = () => {
    setGroups(prev => [...prev, createSimpleGroup(`搜索群組 ${prev.length}`, false)])
  }

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId))
  }

  const toggleGroup = (groupId: string) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, isExpanded: !g.isExpanded } : g
    ))
  }

  const updateGroupLogicOperator = (groupId: string, operator: 'AND' | 'OR') => {
    setGroups(prev => prev.map(g => 
      g.id === groupId ? { ...g, logicOperator: operator } : g
    ))
  }

  // 條件操作
  const addCondition = (groupId: string) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId 
        ? { ...g, conditions: [...g.conditions, createSimpleCondition()] }
        : g
    ))
  }

  const removeCondition = (groupId: string, conditionId: string) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId 
        ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
        : g
    ))
  }

  const updateCondition = (groupId: string, conditionId: string, updates: Partial<SimpleCondition>) => {
    setGroups(prev => prev.map(g => 
      g.id === groupId 
        ? { ...g, conditions: g.conditions.map(c => 
            c.id === conditionId ? { ...c, ...updates } : c
          )}
        : g
    ))
  }

  // 渲染條件輸入
  const renderConditionInput = (condition: SimpleCondition, groupId: string) => {
    const commonProps = {
      className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
      value: condition.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newValue = condition.field === 'tags' ? [e.target.value] : e.target.value
        updateCondition(groupId, condition.id, { value: newValue })
      }
    }

    switch (condition.field) {
      case 'venue_id':
        return (
          <select {...commonProps} value={condition.value as string}>
            <option value="">選擇期刊/會議...</option>
            {venues?.map((venue: any) => (
              <option key={venue.id} value={venue.id.toString()}>
                {venue.name} ({venue.type})
              </option>
            ))}
          </select>
        )
      
      case 'tags':
        return (
          <select {...commonProps} value={(condition.value as string[])?.[0] || ''}>
            <option value="">選擇標籤...</option>
            {tags?.map((tag: any) => (
              <option key={tag.id} value={tag.name}>
                {tag.name}
              </option>
            ))}
          </select>
        )
      
      case 'year_from':
      case 'year_to':
      case 'min_citations':
      case 'max_citations':
        return (
          <input
            {...commonProps}
            type="number"
            placeholder={condition.field.includes('year') ? '年份' : '引用數'}
          />
        )
      
      default:
        return (
          <input
            {...commonProps}
            type="text"
            placeholder="輸入搜索值..."
          />
        )
    }
  }

  // 渲染單個條件
  const renderCondition = (condition: SimpleCondition, groupId: string, index: number, group: SimpleGroup) => (
    <div key={condition.id} className="condition-item mb-4">
      {/* 條件之間的邏輯操作符 */}
      {index > 0 && (
        <div className="flex justify-center mb-3">
          <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
            <span className="text-sm text-gray-600">關係:</span>
            <select
              value={group.conditions[index - 1]?.logicOperator || 'OR'}
              onChange={(e) => {
                updateCondition(groupId, group.conditions[index - 1].id, { 
                  logicOperator: e.target.value as 'AND' | 'OR' 
                })
              }}
              className="border-0 bg-transparent text-sm font-medium focus:ring-0"
            >
              <option value="OR">或 (OR)</option>
            </select>
          </div>
        </div>
      )}
      
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* 字段選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索欄位</label>
            <select
              value={condition.field}
              onChange={(e) => {
                updateCondition(groupId, condition.id, { 
                  field: e.target.value,
                  value: e.target.value === 'tags' ? [] : ''
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="title_keyword">標題</option>
              <option value="author_name">作者</option>
              <option value="abstract_keyword">摘要</option>
              <option value="year_from">年份(從)</option>
              <option value="year_to">年份(到)</option>
              <option value="min_citations">最小引用</option>
              <option value="max_citations">最大引用</option>
              <option value="venue_id">期刊/會議</option>
              <option value="tags">標籤</option>
            </select>
          </div>

          {/* 操作符選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">匹配方式</label>
            <select
              value={condition.operator}
              onChange={(e) => {
                updateCondition(groupId, condition.id, { operator: e.target.value })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="contains">包含</option>
              <option value="equals">完全匹配</option>
              <option value="greater_than">大於</option>
              <option value="less_than">小於</option>
              <option value="greater_equal">大於等於</option>
              <option value="less_equal">小於等於</option>
            </select>
          </div>

          {/* 值輸入 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索值</label>
            {renderConditionInput(condition, groupId)}
          </div>

          {/* 移除按鈕 */}
          <div>
            <button
              type="button"
              onClick={() => removeCondition(groupId, condition.id)}
              className="w-full md:w-auto px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
              title="移除條件"
              disabled={group.conditions.length === 1}
            >
              <TrashIcon className="h-4 w-4" />
              <span className="ml-1 md:hidden">移除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  // 渲染群組
  const renderGroup = (group: SimpleGroup, index: number) => (
    <div key={group.id} className="group-container mb-6">
      {/* 群組之間的邏輯操作符 */}
      {index > 0 && (
        <div className="flex justify-center mb-4">
          <div className="flex items-center space-x-2 bg-blue-100 px-4 py-2 rounded-full">
            <span className="text-sm font-medium text-blue-800">群組關係:</span>
            <select
              value={group.logicOperator || 'AND'}
              onChange={(e) => {
                updateGroupLogicOperator(group.id, e.target.value as 'AND' | 'OR')
              }}
              className="border-0 bg-transparent text-sm font-medium text-blue-800 focus:ring-0"
            >
              <option value="AND">且 (AND)</option>
            </select>
          </div>
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        {/* 群組標題 */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {group.isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                )}
              </button>
              <h3 className="text-lg font-medium text-gray-900">{group.name}</h3>
              <span className="text-sm text-gray-500">({group.conditions.length} 個條件)</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => addCondition(group.id)}
                className="inline-flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
              >
                <PlusIcon className="h-3 w-3 mr-1" />
                添加條件
              </button>
              
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 群組內容 */}
        {group.isExpanded && (
          <div className="p-4">
            {group.conditions.length > 0 ? (
              group.conditions.map((condition, conditionIndex) => 
                renderCondition(condition, group.id, conditionIndex, group)
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>此群組暫無搜索條件</p>
                <button
                  type="button"
                  onClick={() => addCondition(group.id)}
                  className="mt-2 inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                >
                  <PlusIcon className="h-3 w-3 mr-1" />
                  添加條件
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  // 生成查詢預覽文本
  const generateQueryPreview = () => {
    if (groups.length === 0) return '(空查詢)'
    
    // 過濾出有效的群組
    const validGroups = groups.filter((group: SimpleGroup) => 
      group.conditions.some((c: SimpleCondition) => 
        c.value && c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0)
      )
    )
    
    if (validGroups.length === 0) return '(空查詢)'
    
    const groupTexts = validGroups.map((group: SimpleGroup, groupIndex: number) => {
      const validConditions = group.conditions.filter((c: SimpleCondition) => 
        c.value && c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0)
      )
      
      if (validConditions.length === 0) return ''
      
      const conditionTexts = validConditions.map((condition: SimpleCondition, conditionIndex: number) => {
        let fieldName = ''
        switch (condition.field) {
          case 'title_keyword': fieldName = '標題'; break
          case 'author_name': fieldName = '作者'; break
          case 'abstract_keyword': fieldName = '摘要'; break
          case 'year_from': fieldName = '年份≥'; break
          case 'year_to': fieldName = '年份≤'; break
          case 'min_citations': fieldName = '引用≥'; break
          case 'max_citations': fieldName = '引用≤'; break
          case 'venue_id': fieldName = '期刊'; break
          case 'tags': fieldName = '標籤'; break
          default: fieldName = condition.field
        }
        
        let operatorName = ''
        switch (condition.operator) {
          case 'contains': operatorName = '包含'; break
          case 'equals': operatorName = '='; break
          case 'greater_than': operatorName = '>'; break
          case 'less_than': operatorName = '<'; break
          case 'greater_equal': operatorName = '≥'; break
          case 'less_equal': operatorName = '≤'; break
          default: operatorName = condition.operator
        }
        
        // 處理值的顯示
        let displayValue = ''
        if (!condition.value || condition.value === '') {
          displayValue = '[未設定]'
        } else if (Array.isArray(condition.value)) {
          displayValue = condition.value.length > 0 ? condition.value[0] : '[未設定]'
        } else {
          displayValue = String(condition.value)
        }
        
        return `${fieldName}${operatorName}"${displayValue}"`
      })
      
      // 用邏輯操作符連接條件
      const joinedConditions = conditionTexts.reduce((acc: string, conditionText: string, index: number) => {
        if (index === 0) return conditionText
        
        const prevCondition = validConditions[index - 1]
        const logic = prevCondition?.logicOperator === 'OR' ? ' OR ' : ' AND '
        return acc + logic + conditionText
      }, '')
      
      // 如果群組有多個條件，用括號包圍
      const groupText = validConditions.length > 1 ? `(${joinedConditions})` : joinedConditions
      
      return groupText
    }).filter((text: string) => text !== '')
    
    if (groupTexts.length === 0) return '(空查詢)'
    
    // 用群組間邏輯操作符連接群組（始終使用AND）
    const finalQuery = groupTexts.reduce((acc: string, groupText: string, index: number) => {
      if (index === 0) return groupText
      return acc + ' AND ' + groupText
    }, '')
    
    return finalQuery || '(空查詢)'
  }

  // 獲取查詢統計信息
  const getQueryStats = () => {
    const totalConditions = groups.reduce((sum: number, group: SimpleGroup) => sum + group.conditions.length, 0)
    const filledConditions = groups.reduce((sum: number, group: SimpleGroup) => {
      return sum + group.conditions.filter((c: SimpleCondition) => c.value && c.value !== '').length
    }, 0)
    
    return {
      totalGroups: groups.length,
      totalConditions,
      filledConditions,
      emptyConditions: totalConditions - filledConditions
    }
  }

  // 處理提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const convertToComplexQuery = (): ComplexSearchQuery => {
      // 收集所有群組中的有效條件
      const allGroupConditions: FilterGroup[] = []
      
      groups.forEach((group: SimpleGroup) => {
        const validConditions = group.conditions.filter((c: SimpleCondition) => 
          c.value && c.value !== '' && !(Array.isArray(c.value) && c.value.length === 0)
        )
        
        if (validConditions.length > 0) {
          // 檢查群組內條件的邏輯關係
          const hasOrCondition = validConditions.some((c, index) => 
            index > 0 && validConditions[index - 1]?.logicOperator === 'OR'
          )
          
          if (hasOrCondition) {
            // 群組內有OR關係，使用OR操作符
            allGroupConditions.push({
              id: group.id,
              operator: 'OR',
              conditions: validConditions.map(c => ({
                id: c.id,
                field: c.field as any,
                operator: c.operator as any,
                value: c.value
              })),
              groups: []
            })
          } else {
            // 群組內都是AND關係，使用AND操作符
            allGroupConditions.push({
              id: group.id,
              operator: 'AND',
              conditions: validConditions.map(c => ({
                id: c.id,
                field: c.field as any,
                operator: c.operator as any,
                value: c.value
              })),
              groups: []
            })
          }
        }
      })
      
      // 構建最終查詢結構
      if (allGroupConditions.length === 0) {
        return {
          root: {
            id: 'root',
            operator: 'AND',
            conditions: [],
            groups: []
          }
        }
      }
      
      if (allGroupConditions.length === 1) {
        return {
          root: allGroupConditions[0]
        }
      }
      
      // 多個群組時，群組間始終使用AND關係
      return {
        root: {
          id: 'root',
          operator: 'AND',
          conditions: [],
          groups: allGroupConditions
        }
      }
    }

    const query = convertToComplexQuery()
    const preview = generateQueryPreview()
    
    // 調試信息
    console.log('=== 查詢調試信息 ===')
    console.log('群組數量:', groups.length)
    console.log('詳細群組信息:', groups.map((g: SimpleGroup, idx: number) => ({
      索引: idx,
      id: g.id,
      name: g.name,
      條件數量: g.conditions.length,
      conditions: g.conditions.map((c: SimpleCondition) => ({
        id: c.id,
        field: c.field,
        operator: c.operator,
        value: c.value,
        logicOperator: c.logicOperator
      }))
    })))
    console.log('預覽文本:', preview)
    console.log('最終payload:', JSON.stringify(query, null, 2))
    console.log('==================')

    onSearch(query)
  }

  // 重置
  const handleReset = () => {
    setGroups([createSimpleGroup('主要搜索', true)])
    onReset()
  }

  return (
    <div className="max-w-6xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 表單標題 */}
        <div className="text-center border-b border-gray-200 pb-4">
          <h2 className="text-2xl font-bold text-gray-900">進階搜索構建器</h2>
          <p className="text-gray-600 mt-1">構建複雜的搜索查詢條件</p>
        </div>

        {/* 群組列表 */}
        <div className="space-y-4">
          {groups.map((group, index) => renderGroup(group, index))}
        </div>
        
        {/* 添加群組按鈕 */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addGroup}
            className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            添加搜索群組
          </button>
        </div>

        {/* 查詢預覽 */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">查詢預覽</h3>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>{getQueryStats().totalGroups} 個群組</span>
              <span>{getQueryStats().filledConditions}/{getQueryStats().totalConditions} 個有效條件</span>
            </div>
          </div>
          
          <div className="bg-white border border-gray-300 rounded p-3 mb-3">
            <div className="font-mono text-sm text-blue-600 whitespace-pre-wrap break-all">
              {generateQueryPreview()}
            </div>
          </div>
          
          {getQueryStats().emptyConditions > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
              <p className="text-xs text-yellow-700">
                ⚠️ 有 {getQueryStats().emptyConditions} 個條件未設定搜索值，這些條件在執行搜索時將被忽略
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              此預覽顯示查詢的邏輯結構
            </p>
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">AND</span>
              <span>且</span>
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">OR</span>
              <span>或</span>
            </div>
          </div>
        </div>

        {/* 提交按鈕 */}
        <div className="flex justify-center space-x-4 pt-6 border-t border-gray-200">
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            執行搜索
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 focus:ring-4 focus:ring-gray-200 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            重置查詢
          </button>
        </div>
      </form>
    </div>
  )
}

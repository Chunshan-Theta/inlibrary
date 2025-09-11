import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { ComplexSearchQuery, FilterGroup, FilterCondition, FilterOperator, Author, Tag, Venue } from '../types'
import { authorsApi, tagsApi, venuesApi } from '../api/papers'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface QueryBuilderProps {
  onSearch: (query: ComplexSearchQuery) => void
  onReset: () => void
  initialQuery?: ComplexSearchQuery
}

// 創建新的條件
const createCondition = (): FilterCondition => ({
  id: Math.random().toString(36).substr(2, 9),
  field: 'title_keyword',
  operator: 'contains',
  value: ''
})

// 創建新的群組
const createGroup = (): FilterGroup => ({
  id: Math.random().toString(36).substr(2, 9),
  operator: 'AND',
  conditions: [createCondition()],
  groups: []
})

// 創建初始查詢
const createInitialQuery = (): ComplexSearchQuery => ({
  root: createGroup()
})

export default function QueryBuilder({ onSearch, onReset, initialQuery }: QueryBuilderProps) {
  const [query, setQuery] = useState<ComplexSearchQuery>(initialQuery || createInitialQuery())

  // 獲取下拉選項數據
  const { data: authors } = useQuery('authors', authorsApi.getAuthors)
  const { data: tags } = useQuery('tags', tagsApi.getTags)
  const { data: venues } = useQuery('venues', venuesApi.getVenues)

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery)
    }
  }, [initialQuery])

  // 更新群組操作符
  const updateGroupOperator = (groupId: string, operator: FilterOperator, currentGroup: FilterGroup = query.root): FilterGroup => {
    if (currentGroup.id === groupId) {
      return { ...currentGroup, operator }
    }
    
    return {
      ...currentGroup,
      groups: currentGroup.groups.map(group => updateGroupOperator(groupId, operator, group))
    }
  }

  // 添加條件到群組
  const addConditionToGroup = (groupId: string, currentGroup: FilterGroup = query.root): FilterGroup => {
    if (currentGroup.id === groupId) {
      return {
        ...currentGroup,
        conditions: [...currentGroup.conditions, createCondition()]
      }
    }
    
    return {
      ...currentGroup,
      groups: currentGroup.groups.map(group => addConditionToGroup(groupId, group))
    }
  }

  // 移除條件
  const removeCondition = (conditionId: string, currentGroup: FilterGroup = query.root): FilterGroup => {
    return {
      ...currentGroup,
      conditions: currentGroup.conditions.filter(c => c.id !== conditionId),
      groups: currentGroup.groups.map(group => removeCondition(conditionId, group))
    }
  }

  // 更新條件
  const updateCondition = (conditionId: string, updates: Partial<FilterCondition>, currentGroup: FilterGroup = query.root): FilterGroup => {
    return {
      ...currentGroup,
      conditions: currentGroup.conditions.map(c => 
        c.id === conditionId ? { ...c, ...updates } : c
      ),
      groups: currentGroup.groups.map(group => updateCondition(conditionId, updates, group))
    }
  }

  // 添加子群組
  const addSubGroup = (parentGroupId: string, currentGroup: FilterGroup = query.root): FilterGroup => {
    if (currentGroup.id === parentGroupId) {
      return {
        ...currentGroup,
        groups: [...currentGroup.groups, createGroup()]
      }
    }
    
    return {
      ...currentGroup,
      groups: currentGroup.groups.map(group => addSubGroup(parentGroupId, group))
    }
  }

  // 移除群組
  const removeGroup = (groupId: string, currentGroup: FilterGroup = query.root): FilterGroup => {
    return {
      ...currentGroup,
      groups: currentGroup.groups.filter(g => g.id !== groupId).map(group => removeGroup(groupId, group))
    }
  }

  // 處理提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query)
  }

  // 重置
  const handleReset = () => {
    const newQuery = createInitialQuery()
    setQuery(newQuery)
    onReset()
  }

  // 渲染條件輸入
  const renderConditionInput = (condition: FilterCondition) => {
    const commonProps = {
      className: "input-field",
      value: condition.value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newValue = condition.field === 'tags' ? [e.target.value] : e.target.value
        setQuery(prev => ({
          root: updateCondition(condition.id, { value: newValue }, prev.root)
        }))
      }
    }

    switch (condition.field) {
      case 'venue_id':
        return (
          <select {...commonProps} value={condition.value as string}>
            <option value="">選擇期刊/會議...</option>
            {venues?.map((venue) => (
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
            {tags?.map((tag) => (
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

  // 渲染條件
  const renderCondition = (condition: FilterCondition, groupId: string, index: number) => (
    <div key={condition.id} className="flex items-center space-x-2 p-3 bg-gray-50 rounded border">
      {/* 字段選擇 */}
      <select
        value={condition.field}
        onChange={(e) => {
          setQuery(prev => ({
            root: updateCondition(condition.id, { 
              field: e.target.value as any,
              value: e.target.value === 'tags' ? [] : ''
            }, prev.root)
          }))
        }}
        className="input-field min-w-32"
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

      {/* 操作符選擇 */}
      <select
        value={condition.operator}
        onChange={(e) => {
          setQuery(prev => ({
            root: updateCondition(condition.id, { operator: e.target.value as any }, prev.root)
          }))
        }}
        className="input-field min-w-24"
      >
        <option value="contains">包含</option>
        <option value="equals">等於</option>
        <option value="greater_than">大於</option>
        <option value="less_than">小於</option>
        <option value="greater_equal">大於等於</option>
        <option value="less_equal">小於等於</option>
        <option value="in">在列表中</option>
      </select>

      {/* 值輸入 */}
      <div className="flex-1">
        {renderConditionInput(condition)}
      </div>

      {/* 移除按鈕 */}
      <button
        type="button"
        onClick={() => {
          setQuery(prev => ({
            root: removeCondition(condition.id, prev.root)
          }))
        }}
        className="p-2 text-red-500 hover:text-red-700"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  )

  // 渲染群組
  const renderGroup = (group: FilterGroup, depth: number = 0): React.ReactNode => (
    <div key={group.id} className={`border rounded-lg p-4 ${depth > 0 ? 'ml-4 border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
      {/* 群組操作符選擇 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">條件關係:</span>
          <select
            value={group.operator}
            onChange={(e) => {
              setQuery(prev => ({
                root: updateGroupOperator(group.id, e.target.value as FilterOperator, prev.root)
              }))
            }}
            className="input-field w-20"
          >
            <option value="AND">AND</option>
            <option value="OR">OR</option>
          </select>
        </div>
        
        <div className="flex space-x-2">
          {/* 添加條件按鈕 */}
          <button
            type="button"
            onClick={() => {
              setQuery(prev => ({
                root: addConditionToGroup(group.id, prev.root)
              }))
            }}
            className="btn-secondary text-xs py-1 px-2"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            條件
          </button>
          
          {/* 添加子群組按鈕 */}
          <button
            type="button"
            onClick={() => {
              setQuery(prev => ({
                root: addSubGroup(group.id, prev.root)
              }))
            }}
            className="btn-secondary text-xs py-1 px-2"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            群組
          </button>
          
          {/* 移除群組按鈕 (不能移除根群組) */}
          {depth > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery(prev => ({
                  root: removeGroup(group.id, prev.root)
                }))
              }}
              className="p-1 text-red-500 hover:text-red-700"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 條件列表 */}
      <div className="space-y-2 mb-4">
        {group.conditions.map((condition, index) => 
          renderCondition(condition, group.id, index)
        )}
      </div>

      {/* 子群組 */}
      {group.groups.length > 0 && (
        <div className="space-y-4">
          {group.groups.map(subGroup => renderGroup(subGroup, depth + 1))}
        </div>
      )}
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">查詢構建器</h3>
        {renderGroup(query.root)}
      </div>

      {/* 提交按鈕 */}
      <div className="flex space-x-3 pt-4 border-t">
        <button
          type="submit"
          className="btn-primary"
        >
          搜索
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="btn-secondary"
        >
          重置
        </button>
      </div>
    </form>
  )
} 
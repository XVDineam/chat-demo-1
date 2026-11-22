import React, { useEffect, useMemo, useRef, useState } from 'react'
// 👈 根据截图，把 selectSession 一起导入进来
import { useChatStore, selectSession } from '../../services/chat/store.js'
import { loadSession } from '../../services/chat/db.js'

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const highlightText = (text: string, keyword: string) => {
  if (!keyword.trim() || !text) return text
  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, index) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={index} style={{ backgroundColor: '#ffe58f', color: '#000', padding: '0 2px', borderRadius: '2px', fontWeight: 'bold' }}>
        {part}
      </mark>
    ) : (
      part
    )
  )
}

export const SearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [keyword, setKeyword] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  const sessions = useChatStore((state) => state.sessions)
  
  const [fullSessionsData, setFullSessionsData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 60)
      setKeyword('')
      setActiveIndex(0)
      
      const loadAllSessions = async () => {
        setIsLoading(true)
        try {
          const details = await Promise.all(
            sessions.map((s: any) => loadSession(s.id))
          )
          setFullSessionsData(details.filter(Boolean))
        } catch (error) {
          console.error('加载搜索数据失败:', error)
        } finally {
          setIsLoading(false)
        }
      }
      
      loadAllSessions()
    }
  }, [isOpen, sessions])

  const results = useMemo(() => {
    if (!keyword.trim() || isLoading) return []
    const lowerKeyword = keyword.toLowerCase()
    const matches: any[] = []

    fullSessionsData.forEach((session: any) => {
      if (session.title && session.title.toLowerCase().includes(lowerKeyword)) {
        matches.push({
          type: 'title',
          sessionId: session.id,
          sessionTitle: session.title,
          text: session.title,
          messageId: null,
        })
      }

      const messages = session.messages || []
      messages.forEach((msg: any) => {
        if (msg.content && typeof msg.content === 'string' && msg.content.toLowerCase().includes(lowerKeyword)) {
          const idx = msg.content.toLowerCase().indexOf(lowerKeyword)
          const start = Math.max(0, idx - 25)
          const end = Math.min(msg.content.length, idx + lowerKeyword.length + 35)
          let snippet = msg.content.slice(start, end)
          if (start > 0) snippet = '...' + snippet
          if (end < msg.content.length) snippet = snippet + '...'

          matches.push({
            type: 'message',
            sessionId: session.id,
            sessionTitle: session.title || '未命名会话',
            messageId: msg.id,
            text: snippet,
            role: msg.role,
          })
        }
      })
    })

    return matches.slice(0, 50)
  }, [keyword, fullSessionsData, isLoading])

  useEffect(() => {
    setActiveIndex(0)
  }, [keyword])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

  const handleSelect = (item: any) => {
    onClose()
    
    // 👈 修复报错 2：直接调用导入的 selectSession 方法
    if (useChatStore.getState().activeId !== item.sessionId) {
      selectSession(item.sessionId)
    }

    if (item.messageId) {
      ;(window as any).__pendingScrollMessageId = item.messageId
      window.dispatchEvent(new CustomEvent('scroll-to-message', { detail: item.messageId }))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10vh', backdropFilter: 'blur(2px)' }} onClick={onClose}>
      <div style={{ width: 'min(90vw, 640px)', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e8e8e8' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" style={{ marginRight: '10px' }}>
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input ref={inputRef} type="text" placeholder="搜索历史对话、消息内容..." value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={handleKeyDown} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: '#333' }} />
          {isLoading && <span style={{ fontSize: '12px', color: '#1677ff', marginRight: '8px' }}>正在加载记录...</span>}
          <div style={{ fontSize: '12px', color: '#999', background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>ESC 关闭</div>
        </div>

        <div ref={listRef} style={{ maxHeight: '55vh', overflowY: 'auto', padding: '8px 0' }}>
          {!keyword.trim() ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '14px' }}>输入标题或聊天内容开始搜索...</div>
          ) : isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '14px' }}>正在读取历史记录，请稍候...</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#999', fontSize: '14px' }}>没有找到相关结果</div>
          ) : (
            results.map((item, index) => (
              <div key={`${item.sessionId}-${item.messageId || 'title'}-${index}`} ref={(el) => (itemRefs.current[index] = el)} onClick={() => handleSelect(item)} style={{ padding: '10px 18px', cursor: 'pointer', backgroundColor: index === activeIndex ? '#e6f7ff' : 'transparent', transition: 'background-color 0.1s' }}>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{item.sessionTitle}</span>
                  {item.type === 'title' && <span style={{ fontSize: '10px', background: '#d9f7be', padding: '0 4px', borderRadius: '2px', color: '#389e0d' }}>标题</span>}
                </div>
                <div style={{ fontSize: '14px', color: '#333', wordBreak: 'break-all' }}>
                  {item.type === 'message' && <span style={{ color: '#aaa', fontSize: '12px', marginRight: '4px' }}>[{item.role === 'user' ? '我' : 'AI'}]</span>}
                  {highlightText(item.text, keyword)}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '8px 18px', backgroundColor: '#fafafa', borderTop: '1px solid #f0f0f0', fontSize: '12px', color: '#999', display: 'flex', gap: '16px' }}>
          <span>↑↓ 导航</span>
          <span>Enter 跳转</span>
        </div>
      </div>
    </div>
  )
}

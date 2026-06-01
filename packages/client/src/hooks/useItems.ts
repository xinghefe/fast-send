import { useState, useEffect, useCallback } from 'react'
import { SharedItem } from '../types'
import { sendNotification } from '../utils/notifications'

export const useItems = (
  baseUrl: string,
  socket: any,
  clientId: string,
  showToast: (m: string, t?: any) => void,
) => {
  const [items, setItems] = useState<SharedItem[]>([])

  const fetchData = useCallback(
    async (newUrl?: string) => {
      const targetUrl = newUrl || baseUrl
      if (!targetUrl) return
      try {
        const itemsRes = await fetch(`${targetUrl}/api/items`, {
          mode: 'cors',
          headers: { Accept: 'application/json' },
        })
        const i = await itemsRes.json()
        setItems([...i].reverse())
      } catch (e: any) {
        console.error('[Items] Fetch error:', e.message)
      }
    },
    [baseUrl],
  )

  useEffect(() => {
    if (baseUrl) {
      fetchData()
    }
  }, [baseUrl, fetchData])

  useEffect(() => {
    if (!socket) return

    socket.on('new-item', (item: SharedItem) => {
      setItems((p) => (p.some((x) => x.id === item.id) ? p : [...p, item]))

      if (
        item.senderId !== clientId &&
        !['CLIPBOARD_SYNC', 'CLIPBOARD_IMAGE'].includes(item.senderId)
      ) {
        // 构建通知内容
        let body = '收到新内容'
        if (item.type === 'text') {
          body = item.content || '收到一段文本'
        } else if (item.type === 'file') {
          body = `收到文件: ${item.originalName || '未知文件'}`
        } else if (item.type === 'gallery') {
          body = `收到 ${item.files?.length || 0} 张图片`
        }
        sendNotification('FastSend', body)
      }
    })

    socket.on('item-removed', (id: number) => {
      setItems((p) => p.filter((x) => x.id !== id))
    })

    socket.on('items-cleared', () => {
      setItems([])
    })

    socket.on('refresh-data', () => {
      // fetchData()
      window.location.reload()
      // showToast('数据存储已切换，内容已刷新', 'info')
    })

    return () => {
      socket.off('new-item')
      socket.off('item-removed')
      socket.off('items-cleared')
      socket.off('refresh-data')
    }
  }, [socket, clientId, showToast])

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/items/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItems((p) => p.filter((x) => x.id !== id))
        showToast('已删除记录')
      }
    } catch (e) {
      showToast('删除失败', 'error')
    }
  }

  return { items, setItems, fetchData, handleDelete }
}

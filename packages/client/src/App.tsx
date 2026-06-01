import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QrCode, UploadCloud, Settings } from 'lucide-react'
import { ServerConfig, FileInfo } from './types'
import { MessageItem } from './components/MessageItem'
import { ToastContainer, Toast } from './components/ToastContainer'
import { GalleryPreview } from "./components/GalleryPreview"
import { ActionPanel } from './components/ActionPanel'
import { BottomInput } from './components/BottomInput'
import { DebugConsole } from './components/DebugConsole'
import { SettingsModal } from './components/SettingsModal'
import { QRModal } from './components/QRModal'

import { useSocket } from './hooks/useSocket'
import { useItems } from './hooks/useItems'
import { useUpload } from './hooks/useUpload'
import { requestNotificationPermission } from './utils/notifications'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

const CLIENT_ID = (() => {
  let id = localStorage.getItem('fast_send_client_id')
  if (!id) {
    id = 'c_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('fast_send_client_id', id)
  }
  return id
})()

export default function App() {
  const [baseUrl, setBaseUrl] = useState(() => {
    const lastUrl = localStorage.getItem('fast_send_last_url')
    const currentUrl = `http://${window.location.hostname}:5678`
    // 在浏览器环境下，如果当前域名有效，优先使用当前域名
    if (window.location.hostname) {
      return currentUrl
    }
    return lastUrl || currentUrl
  })
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [inputText, setInputText] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [previewMedia, setPreviewMedia] = useState<{
    url: string
    type: "image" | "video"
    index?: number
    items?: FileInfo[]
  } | null>(null)

  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [isServerLocal, setIsServerLocal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragCounter = useRef(0)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [downloadPath, setDownloadPath] = useState('')
  const [dataDir, setDataDir] = useState('')
  const [clipboardSync, setClipboardSync] = useState(false)

  const [selectedQRip, setSelectedQRip] = useState<string>('')

  useEffect(() => {
    if (config?.ip && !selectedQRip) {
      setSelectedQRip(config.ip)
    }
  }, [config, selectedQRip])

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const { socket, devices } = useSocket(baseUrl, CLIENT_ID, false)
  const { items, setItems, fetchData, handleDelete } = useItems(baseUrl, socket, CLIENT_ID, showToast)
  const { uploadBatch } = useUpload(baseUrl, CLIENT_ID, setItems, showToast)

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!baseUrl) return
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/config?url=${baseUrl}`, {
          mode: 'cors',
          headers: { Accept: 'application/json' },
        })
        const c = await response.json()
        setConfig(c)
        if (!selectedQRip) setSelectedQRip(c.ip)

        const settingsRes = await fetch(`${baseUrl}/api/settings?key=downloadPath`)
        const settings = await settingsRes.json()
        if (settings.value) setDownloadPath(settings.value)

        const dataDirRes = await fetch(`${baseUrl}/api/settings?key=baseDir`)
        const dataDirSettings = await dataDirRes.json()
        if (dataDirSettings.value) setDataDir(dataDirSettings.value)

        const syncRes = await fetch(`${baseUrl}/api/settings?key=clipboardSync`)
        const syncSettings = await syncRes.json()
        setClipboardSync(syncSettings.value === 'true')

        const localRes = await fetch(`${baseUrl}/api/is-local`)
        const localData = await localRes.json()
        setIsServerLocal(localData.isLocal)
      } catch (e) {
        console.error('Config fetch error:', e)
      }
    }
    fetchConfig()
  }, [baseUrl])

  const toggleClipboardSync = async () => {
    const newValue = !clipboardSync
    setClipboardSync(newValue)
    try {
      await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'clipboardSync', value: newValue ? 'true' : 'false' }),
      })
      showToast(newValue ? '已开启剪贴板同步' : '已关闭剪贴板同步', 'info')
    } catch (e) {
      showToast('设置失败', 'error')
      setClipboardSync(!newValue)
    }
  }

  const updateDataDir = async (newDir: string) => {
    if (!newDir || newDir === dataDir) return
    try {
      await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'baseDir', value: newDir }),
      })
      setDataDir(newDir)
    } catch (e) {
      showToast('更新失败', 'error')
    }
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    dragCounter.current = 0
    if (e.dataTransfer.files) {
      uploadBatch(Array.from(e.dataTransfer.files))
    }
  }

  const handleToggleMenu = useCallback((id: number | null, rect?: DOMRect) => {
    if (id === null) {
      setActiveMenu(null)
    } else if (rect) {
      const isMe = items.find((i) => i.id === id)?.senderId === CLIENT_ID
      const menuWidth = 160
      let x = isMe ? rect.left - 140 : rect.left
      let y = rect.bottom + 8
      if (x < 8) x = 8
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16
      if (y + 120 > window.innerHeight) y = rect.top - 128
      setActiveMenu({ id, x, y })
    }
  }, [items])

  const handleSendText = async () => {
    if (!inputText.trim() || !baseUrl) return
    const content = inputText
    setInputText('')
    try {
      const res = await fetch(`${baseUrl}/api/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, senderId: CLIENT_ID, type: 'text' }),
      })
      if (!res.ok) throw new Error('Send failed')
    } catch (e) {
      showToast('发送失败', 'error')
      setInputText(content)
    }
  }

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 如果点击的是更多按钮或其子元素，或者加号按钮和面板，不要关闭
      if (
        target.closest('.more-menu-trigger') ||
        target.closest('.more-menu-container') ||
        target.closest('.plus-button') ||
        target.closest('.action-panel-container')
      ) return

      if (activeMenu) setActiveMenu(null)
      if (isMenuOpen) setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleGlobalClick)
    return () => document.removeEventListener('mousedown', handleGlobalClick)
  }, [activeMenu, isMenuOpen])

  return (
    <div
      className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-700 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-[100] bg-blue-600/10 backdrop-blur-sm border-4 border-dashed border-blue-500/50 m-4 rounded-[2.5rem] flex flex-col items-center justify-center pointer-events-none transition-all animate-in fade-in duration-200">
          <UploadCloud size={80} className="text-blue-600 animate-bounce" />
          <p className="mt-4 text-blue-600 font-black text-xl">将文件/文件夹拖入此处</p>
        </div>
      )}
      <div className="bg-white/80 backdrop-blur-md border-b shrink-0 z-50 shadow-sm flex flex-col">
        <div className="pt-safe" />
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" className="w-10 h-10 rounded-xl shadow-lg shrink-0" alt="FastSend Logo" />
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">FastSend</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {devices.length} 设备在线
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          <button
            onClick={() => setShowQR(true)}
            className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
          >
            <QrCode size={20} />
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all"
          >
            <Settings size={20} />
          </button>
        </div>
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <Virtuoso
          ref={virtuosoRef}
          data={items}
          className="no-scrollbar"
          followOutput="smooth"
          atBottomThreshold={60}
          initialTopMostItemIndex={items.length - 1}
          overscan={1000}
          itemContent={(index, item) => (
            <div className={`px-4 sm:px-6 ${index === items.length - 1 ? 'pb-2' : ''} ${index === 0 ? 'pt-2' : ''}`}>
              <MessageItem
                key={item.id}
                item={item}
                isMe={
                  item.senderId === CLIENT_ID ||
                  item.senderId === 'DESKTOP' ||
                  item.senderId === 'CLIPBOARD_SYNC' ||
                  item.senderId === 'CLIPBOARD_IMAGE'
                }
                baseUrl={baseUrl}
                onDelete={() => handleDelete(item.id)}
                onPreview={(url, type, idx, files) =>
                  setPreviewMedia({ url, type, index: idx, items: files })
                }
                isMenuOpen={activeMenu?.id === item.id}
                onToggleMenu={handleToggleMenu}
                menuPos={
                  activeMenu?.id === item.id && activeMenu
                    ? { x: activeMenu.x, y: activeMenu.y }
                    : null
                }
              />
            </div>
          )}
          onScroll={() => {
            if (activeMenu) setActiveMenu(null)
          }}
        />
        {items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 pointer-events-none">
            <UploadCloud size={64} strokeWidth={1} />
            <p className="mt-4 text-sm font-medium">暂无共享内容，开始发送吧</p>
          </div>
        )}
      </div>

      <div className="bg-white border-t shrink-0 z-50 flex flex-col">
        <BottomInput
          inputText={inputText}
          setInputText={setInputText}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          onSend={handleSendText}
        />
        <ActionPanel
          isOpen={isMenuOpen}
          onChangeAction={uploadBatch}
        />
        <div className="pb-safe" />
      </div>

      <QRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        config={config}
        selectedQRip={selectedQRip}
        onSelectIP={setSelectedQRip}
      />

      <ToastContainer toasts={toasts} />
      <DebugConsole />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        baseUrl={baseUrl}
        clipboardSync={clipboardSync}
        onToggleClipboardSync={toggleClipboardSync}
        dataDir={dataDir}
        isServerLocal={isServerLocal}
        onUpdateDataDir={updateDataDir}
        showToast={showToast}
      />
      {previewMedia && (
        <GalleryPreview
          items={previewMedia.items || [{ filename: previewMedia.url.split('/').pop() || '', originalName: 'Media', size: '', type: previewMedia.type === 'video' ? 'video' : 'image' }]}
          initialIndex={previewMedia.index || 0}
          baseUrl={baseUrl}
          onClose={() => setPreviewMedia(null)}
        />
      )}
    </div>
  )
}

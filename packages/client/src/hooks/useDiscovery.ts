import { useState, useCallback, useEffect } from 'react'

export const useDiscovery = (
  baseUrl: string,
  setBaseUrl: (url: string) => void,
  fetchData: (url: string | any) => void,
  showToast: (m: string, t?: any) => void,
) => {
  const [isScanning, setIsScanning] = useState(false)

  const scan = useCallback(async (_silent: boolean = false) => {
    if (isScanning) return
    setIsScanning(true)
    // mDNS 自动发现已移除
    setIsScanning(false)
  }, [isScanning])

  useEffect(() => {
    // 如果已经在当前 baseUrl 成功连接（在 App.tsx 中会触发 fetchData），Web 环境下通常不需要再探测 lastUrl
    if (baseUrl && !baseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
        // 如果当前已经是指向某个具体 IP 的 baseUrl，且不是 localhost，说明已经有了明确目标
    }

    const lastUrl = localStorage.getItem('fast_send_last_url')
    if (lastUrl && lastUrl !== baseUrl) {
      fetch(`${lastUrl}/api/config`)
        .then((res) => {
          if (res.ok) fetchData(lastUrl)
          else scan(true)
        })
        .catch(() => scan(true))
    } else if (!lastUrl && !baseUrl) {
      scan(true)
    }
  }, [])

  return { scan, isScanning }
}

'use client'

import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { getUnsyncedAttendance, markAttendanceSynced } from '@/lib/offline-db'

interface OfflineContextType {
  isOnline: boolean
  unsyncedCount: number
  isSyncing: boolean
  triggerSync: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  unsyncedCount: 0,
  isSyncing: false,
  triggerSync: async () => {}
})

export function useOffline() {
  return useContext(OfflineContext)
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return

    try {
      const unsynced = await getUnsyncedAttendance()
      setUnsyncedCount(unsynced.length)
      if (unsynced.length === 0) return

      setIsSyncing(true)
      const res = await fetch('/api/attendance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: unsynced })
      })

      const data = await res.json()
      if (res.ok && data.synced_ids && data.synced_ids.length > 0) {
        await markAttendanceSynced(data.synced_ids)
        const remaining = await getUnsyncedAttendance()
        setUnsyncedCount(remaining.length)
      }
    } catch (err) {
      console.warn('Background sync failed:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing])

  useEffect(() => {
    if (typeof window === 'undefined') return

    setIsOnline(navigator.onLine)

    // Check queue periodically every 15 seconds
    const interval = setInterval(async () => {
      const unsynced = await getUnsyncedAttendance()
      setUnsyncedCount(unsynced.length)
      if (navigator.onLine && unsynced.length > 0) {
        triggerSync()
      }
    }, 15000)

    const handleOnline = () => {
      setIsOnline(true)
      triggerSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial check
    getUnsyncedAttendance().then(items => {
      setUnsyncedCount(items.length)
      if (navigator.onLine && items.length > 0) {
        triggerSync()
      }
    })

    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [triggerSync])

  return (
    <OfflineContext.Provider value={{ isOnline, unsyncedCount, isSyncing, triggerSync }}>
      {children}
    </OfflineContext.Provider>
  )
}

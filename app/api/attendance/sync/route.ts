import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { clearStatsCache } from '@/lib/stats-cache'

interface SyncItem {
  id: string
  student_id?: string
  student_code?: string
  status: 'present' | 'late'
  checked_in_at: string
}

/**
 * POST /api/attendance/sync
 * Bulk syncs offline-recorded attendances to Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const body = await request.json()
    const items: SyncItem[] = Array.isArray(body.items) ? body.items : []

    if (items.length === 0) {
      return Response.json({ message: 'Sinxronlanadigan yozuvlar yo\'q.', synced_ids: [] })
    }

    const serviceClient = createServiceClient()

    // 1. Resolve student IDs if only student_code was provided
    const studentCodes = items.filter(i => !i.student_id && i.student_code).map(i => i.student_code!)
    const studentIds = items.filter(i => i.student_id).map(i => i.student_id!)

    let codeToIdMap = new Map<string, { id: string; class_id: string | null }>()

    if (studentCodes.length > 0) {
      const { data: studentsByCode } = await serviceClient
        .from('students')
        .select('id, student_code, class_id')
        .eq('school_id', admin.school_id)
        .in('student_code', studentCodes)

      for (const s of (studentsByCode || [])) {
        codeToIdMap.set(s.student_code.toUpperCase(), { id: s.id, class_id: s.class_id })
      }
    }

    if (studentIds.length > 0) {
      const { data: studentsById } = await serviceClient
        .from('students')
        .select('id, student_code, class_id')
        .eq('school_id', admin.school_id)
        .in('id', studentIds)

      for (const s of (studentsById || [])) {
        codeToIdMap.set(s.id, { id: s.id, class_id: s.class_id })
      }
    }

    // 2. Build rows for bulk upsert
    const rowsToUpsert: any[] = []
    const syncedIds: string[] = []

    for (const item of items) {
      let resolved = item.student_id ? codeToIdMap.get(item.student_id) : null
      if (!resolved && item.student_code) {
        resolved = codeToIdMap.get(item.student_code.toUpperCase())
      }

      if (resolved) {
        const checkInDate = item.checked_in_at
          ? item.checked_in_at.slice(0, 10)
          : new Date().toISOString().slice(0, 10)

        rowsToUpsert.push({
          student_id: resolved.id,
          class_id: resolved.class_id,
          date: checkInDate,
          status: item.status || 'present',
          checked_in_at: item.checked_in_at || new Date().toISOString(),
          method: 'qr_offline_sync',
          recorded_by: admin.id,
        })
        syncedIds.push(item.id)
      }
    }

    if (rowsToUpsert.length > 0) {
      const { error: upsertError } = await serviceClient
        .from('attendance')
        .upsert(rowsToUpsert, { onConflict: 'student_id,date' })

      if (upsertError) throw upsertError

      // Invalidate memory cache so stats update instantly
      clearStatsCache()
    }

    return Response.json({
      success: true,
      synced_count: rowsToUpsert.length,
      synced_ids: syncedIds
    })

  } catch (error) {
    return handleApiError(error)
  }
}

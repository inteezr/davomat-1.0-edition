import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'
import { getStatsCache, setStatsCache } from '@/lib/stats-cache'

/**
 * GET /api/attendance/stats?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 * Returns statistics and date-range trend for admin dashboard with instant caching.
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin()
    const { searchParams } = new URL(request.url)
    const customStart = searchParams.get('start_date')
    const customEnd = searchParams.get('end_date')

    // Generate cache key
    const cacheKey = `${admin.school_id}_${customStart || 'default'}_${customEnd || 'default'}`
    const cached = getStatsCache(cacheKey)
    if (cached) {
      return Response.json(cached, {
        headers: {
          'Cache-Control': 'private, max-age=2, stale-while-revalidate=5'
        }
      })
    }

    // Get Uzbekistan local date (UTC+5)
    const nowUz = new Date(new Date().getTime() + 5 * 60 * 60 * 1000)
    const todayStr = nowUz.toISOString().split('T')[0]

    let startDateStr = customStart
    let endDateStr = customEnd

    if (!startDateStr || !endDateStr) {
      endDateStr = todayStr
      startDateStr = new Date(nowUz.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }

    const serviceClient = createServiceClient()

    // Fetch students, classes, and range attendance in parallel
    const [studentsRes, classesRes, attendanceRes] = await Promise.all([
      serviceClient
        .from('students')
        .select('id, class_id, status')
        .eq('school_id', admin.school_id)
        .eq('status', 'active'),
      serviceClient
        .from('classes')
        .select('id, name')
        .eq('school_id', admin.school_id)
        .order('name', { ascending: true }),
      serviceClient
        .from('attendance')
        .select('id, status, student_id, date, class_id')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
    ])

    const activeStudents = studentsRes.data || []
    const totalActiveStudents = activeStudents.length
    const studentMap = new Set(activeStudents.map(s => s.id))
    const classes = classesRes.data || []
    const allAttendance = (attendanceRes.data || []).filter(a => studentMap.has(a.student_id))

    // Today's attendance stats
    let todayAttendance = allAttendance.filter(a => String(a.date).slice(0, 10) === todayStr)
    
    // If today is outside the selected trend range, fetch today's attendance specifically
    if (todayStr > endDateStr || todayStr < startDateStr) {
      const { data: todayData } = await serviceClient
        .from('attendance')
        .select('id, status, student_id, date, class_id')
        .eq('date', todayStr)
      todayAttendance = (todayData || []).filter(a => studentMap.has(a.student_id))
    }

    const stats = {
      present: 0,
      late: 0,
      absent: 0,
      excused: 0
    }

    todayAttendance.forEach((row) => {
      const status = row.status as keyof typeof stats
      if (status in stats) {
        stats[status]++
      }
    })

    const markedCount = stats.present + stats.late + stats.excused
    stats.absent = Math.max(0, totalActiveStudents - markedCount)

    const presentOrLate = stats.present + stats.late
    const attendanceRate = totalActiveStudents > 0 
      ? Math.round((presentOrLate / totalActiveStudents) * 100) 
      : 0

    // Compute class stats including excused
    const classesRates = classes.map((cls) => {
      const classStudentIds = new Set(activeStudents.filter(s => s.class_id === cls.id).map(s => s.id))
      const total = classStudentIds.size
      const presentCount = todayAttendance.filter(a => classStudentIds.has(a.student_id) && (a.status === 'present' || a.status === 'late')).length
      const excusedCount = todayAttendance.filter(a => classStudentIds.has(a.student_id) && a.status === 'excused').length
      return {
        id: cls.id,
        name: cls.name,
        total,
        present: presentCount,
        excused: excusedCount,
        absent: Math.max(0, total - presentCount - excusedCount),
        rate: total > 0 ? Math.round((presentCount / total) * 100) : 0
      }
    })

    // Generate full list of days in selected range (chronological)
    const dateMap = new Map<string, { present: number; late: number; excused: number; absent: number; hasRecords: boolean }>()
    const sDate = new Date(`${startDateStr}T12:00:00Z`)
    const eDate = new Date(`${endDateStr}T12:00:00Z`)
    
    for (let d = new Date(sDate); d.getTime() <= eDate.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().split('T')[0]
      dateMap.set(k, { present: 0, late: 0, excused: 0, absent: 0, hasRecords: false })
    }

    allAttendance.forEach((row) => {
      const dateKey = String(row.date || '').slice(0, 10)
      const dayData = dateMap.get(dateKey)
      if (dayData) {
        dayData.hasRecords = true
        if (row.status === 'present') dayData.present++
        else if (row.status === 'late') dayData.late++
        else if (row.status === 'excused') dayData.excused++
        else if (row.status === 'absent') dayData.absent++
      }
    })

    const trendData = Array.from(dateMap.entries()).map(([dateKey, counts]) => {
      const isToday = dateKey === todayStr
      const abs = (counts.hasRecords || isToday) && totalActiveStudents > 0
        ? Math.max(0, totalActiveStudents - (counts.present + counts.late + counts.excused))
        : 0

      const presentTotal = counts.present + counts.late
      const dayRate = totalActiveStudents > 0 && (counts.hasRecords || isToday)
        ? Math.round((presentTotal / totalActiveStudents) * 100)
        : 0

      return {
        rawDate: dateKey,
        present: counts.present,
        late: counts.late,
        excused: counts.excused,
        absent: abs,
        total: totalActiveStudents,
        rate: dayRate,
        hasRecords: counts.hasRecords || isToday
      }
    })

    const responsePayload = {
      totalStudents: totalActiveStudents,
      today: {
        ...stats,
        rate: attendanceRate
      },
      classes: classesRates,
      trend: trendData
    }

    setStatsCache(cacheKey, responsePayload, 2500)

    return Response.json(responsePayload, {
      headers: {
        'Cache-Control': 'private, max-age=2, stale-while-revalidate=5'
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}

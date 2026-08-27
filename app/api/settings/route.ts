import { NextRequest } from 'next/server'
import { verifyAdmin, handleApiError } from '@/lib/auth-helpers'
import { createServiceClient } from '@/lib/supabase/server'

// Cache settings in memory with a 60-second TTL for instant 0ms responses
let cachedSettings: { data: Record<string, any>; expiresAt: number } | null = null

/**
 * GET /api/settings
 * Retrieves all configuration settings.
 */
export async function GET(request: NextRequest) {
  try {
    await verifyAdmin()

    // Fast in-memory cache
    const now = Date.now()
    if (cachedSettings && now < cachedSettings.expiresAt) {
      return Response.json(cachedSettings.data, {
        headers: {
          'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
        }
      })
    }

    const config: Record<string, any> = {
      qr_token_ttl_seconds: 30,
      late_threshold_minutes: 15,
      class_start_time: '08:30',
      school_name: 'Davomat 1.0 Maktabi'
    }

    const serviceClient = createServiceClient()
    const { data } = await serviceClient.from('settings').select('key, value')
    if (data) {
      data.forEach((row: any) => {
        config[row.key] = row.value
      })
    }

    cachedSettings = {
      data: config,
      expiresAt: now + 60000 // 1 minute
    }

    return Response.json(config, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30'
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/settings
 * Updates configuration settings in bulk.
 */
export async function PUT(request: NextRequest) {
  try {
    await verifyAdmin()
    const body = await request.json()

    const allowedKeys = ['qr_token_ttl_seconds', 'late_threshold_minutes', 'class_start_time', 'school_name']
    const serviceClient = createServiceClient()

    const upsertRows = []
    for (const [key, value] of Object.entries(body)) {
      if (!allowedKeys.includes(key)) continue
      upsertRows.push({
        key,
        value,
        updated_at: new Date().toISOString()
      })
    }

    if (upsertRows.length > 0) {
      await serviceClient
        .from('settings')
        .upsert(upsertRows, { onConflict: 'key' })
    }

    // Invalidate cache immediately on update
    cachedSettings = null

    return Response.json({ message: 'Sozlamalar muvaffaqiyatli saqlandi.' })
  } catch (error) {
    return handleApiError(error)
  }
}

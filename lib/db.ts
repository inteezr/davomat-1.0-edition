import postgres from 'postgres'

// Database connection parameters
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}

// Single database client instance (hot-reload friendly in development)
const globalForDb = global as unknown as { sql: postgres.Sql | undefined }

export const sql = globalForDb.sql || postgres(connectionString, {
  ssl: { rejectUnauthorized: false },
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  prepare: false,
})

if (process.env.NODE_ENV !== 'production') {
  globalForDb.sql = sql
}


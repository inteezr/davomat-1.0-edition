'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import { LanguageProvider, useLanguage } from '@/lib/i18n/LanguageContext'
import { Language } from '@/lib/i18n/translations'
import { OfflineSyncProvider } from '@/components/offline-sync-provider'
import { 
  LayoutDashboard, 
  Users, 
  School, 
  QrCode, 
  FileSpreadsheet, 
  Settings, 
  LogOut,
  Globe,
  Lock,
  Loader2,
  X
} from 'lucide-react'

const LANGS: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { language, setLanguage, t } = useLanguage()
  const [mounted, setMounted] = useState(false)

  // Admin profile
  const [adminEmail, setAdminEmail] = useState('')
  const [adminName, setAdminName] = useState('')
  const [schoolName, setSchoolName] = useState('')

  // Admin settings modal
  const [profileOpen, setProfileOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    setMounted(true)

    // Load admin info + school name
    supabase.auth.getUser().then(async ({ data }) => {
      if (data?.user) {
        setAdminEmail(data.user.email || '')
        const meta = data.user.user_metadata
        setAdminName(meta?.full_name || meta?.name || data.user.email?.split('@')[0] || 'Admin')

        // Fetch school name from admins -> schools table
        try {
          const { data: adminRow } = await supabase
            .from('admins')
            .select('school_id, schools(name)')
            .eq('id', data.user.id)
            .maybeSingle()
          
          if (adminRow) {
            const sName = (adminRow.schools as any)?.name
            if (sName) setSchoolName(sName)
          }
        } catch {
          // School name is optional — don't block UI
        }
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: language === 'uz' ? 'Parollar mos kelmadi.' : language === 'ru' ? 'Пароли не совпадают.' : 'Passwords do not match.' })
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwMsg({ type: 'error', text: t('minChars') })
      return
    }
    setPwLoading(true)
    setPwMsg(null)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword })
    if (error) {
      setPwMsg({ type: 'error', text: error.message })
    } else {
      setPwMsg({ type: 'success', text: language === 'uz' ? 'Parol muvaffaqiyatli o\'zgartirildi!' : language === 'ru' ? 'Пароль успешно изменен!' : 'Password updated successfully!' })
      setPwForm({ newPassword: '', confirmPassword: '' })
    }
    setPwLoading(false)
  }

  // Initials for avatar
  const initials = adminName
    ? adminName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'AD'

  const navItems = [
    { href: '/dashboard',          label: t('dashboard'),    icon: LayoutDashboard },
    { href: '/students',           label: t('students'),     icon: Users },
    { href: '/classes',            label: t('classes'),      icon: School },
    { href: '/attendance/scanner', label: t('scanner'),      icon: QrCode },
    { href: '/reports',            label: t('reports'),      icon: FileSpreadsheet },
    { href: '/settings',           label: t('settings'),     icon: Settings },
  ]

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Navbar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 shadow-sm z-40 relative">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{t('appName')}</p>
            <p className="text-[10px] font-medium" style={{ color: '#64748b' }}>
              {schoolName || t('adminPanel')}
            </p>
          </div>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-1.5 h-full">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-sm shadow-blue-500/5' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right: Lang + Profile + Logout */}
        <div className="flex items-center gap-2.5">
          {/* Language selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 bg-transparent focus:outline-none cursor-pointer pr-1"
            >
              {LANGS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Admin profile button */}
          <button
            onClick={() => { setProfileOpen(true); setPwMsg(null) }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group border border-slate-200/60 dark:border-slate-800"
            title={t('adminSettings')}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              A
            </div>
            <span className=" sm:inline text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors max-w-[110px] truncate">
              Admin
            </span>
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <nav className="md:hidden flex items-center justify-around bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-2 px-4 gap-1 shrink-0 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] font-semibold transition-colors cursor-pointer ${
                isActive 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </nav>

      {/* Main content area */}
      <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
        {children}
      </main>

      {/* ===== ADMIN PROFILE / PASSWORD MODAL ===== */}
      {mounted && profileOpen && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(2,6,23,0.78)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 99999,
          }}
          onClick={() => setProfileOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow">
                  {initials}
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Admin</p>
                  <p className="text-xs text-slate-500"></p>
                </div>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Change Password */}
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-2">
                <Lock className="w-4 h-4" />
                <span className="font-semibold text-sm">{t('changePassword')}</span>
              </div>

              {pwMsg && (
                <div className={`px-4 py-3 rounded-xl text-sm border ${
                  pwMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {pwMsg.text}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('newPassword')}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm(p => ({ ...p, newPassword: e.target.value }))}
                  placeholder={t('minChars')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('confirmPassword')}</label>
                <input
                  type="password"
                  required
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder={t('reenterPassword')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  {t('otherSettings')}
                </Link>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-lg shadow-blue-600/10 cursor-pointer disabled:opacity-60"
                >
                  {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <OfflineSyncProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </OfflineSyncProvider>
    </LanguageProvider>
  )
}

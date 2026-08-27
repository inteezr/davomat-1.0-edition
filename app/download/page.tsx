'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Download,
  SmartphoneNfc,
  CheckCheck,
  QrCode,
  ShieldCheck,
  ArrowLeft,
  Globe,
  Sun,
  Moon,
  Zap,
  Database
} from 'lucide-react'

type Language = 'uz' | 'ru' | 'en'

const translations = {
  uz: {
    downloadTitle: "Ilovani yuklab olish",
    downloadDesc: "Davomat 1.0 ilovasini o'rnating va o'zingizning davomat tarixining egasi bo'ling.",
    downloadHero1: "Davomat 1.0",
    downloadHero2: "mobil ilovasi",
    downloadBtn: "Yuklab olish",
    downloadAndroid: "Android uchun",
    downloadIOS: "iOS uchun",
    downloadAPK: "APK fayl",
    downloadQR: "QR kod",
    downloadSize: "45 MB",
    downloadVersion: "1.0.2",
    downloadNote: "Yuklab olishdan oldin ro'yxatdan o'tishingiz kerak",
    downloadFeature1: "Doimiy universal QR kod",
    downloadFeature2: "Davomat tarixi",
    downloadFeature3: "Darsdagi o'yinlarga ulanish",
    downloadFeature4: "Onlayn rejim",
    studentZone: "O'quvchilar va O'yinlar Ekotizimi",
    studentZoneDesc: "Mobil ilova orqali doimiy QR kodingizni oling, davomatingizni kuzating va darsdagi interaktiv o'yinlar hamda viktorinalarga ulaning.",
    whyStudents: "Nega talabalar bizni tanlaydi?",
    stat1: "Universal QR Pass",
    stat2: "24/7 qo'llab-quvvatlash",
    stat3: "Bepul foydalanish",
    backToHome: "Bosh sahifaga qaytish",
    features: "Ilova imkoniyatlari",
    feature1: "Tezkor QR kod skanerlash",
    feature2: "Real-time yangilanish",
    feature3: "Tarixni ko'rish",
    feature4: "Bildirishnomalar",
    requirement: "Tizim talablari",
    req1: "Android 8.0 yoki yuqori",
    req2: "iOS 14.0 yoki yuqori",
    req3: "Internet ulanuvchi",
    req4: "Maktab hisobiga",
    footerText: "Barcha huquqlar himoyalangan.",
    login: "Kirish",
  },
  ru: {
    downloadTitle: "Скачайте приложение",
    downloadDesc: "Установите Davomat 1.0 и станьте хозяином своей истории посещаемости.",
    downloadHero1: "Davomat 1.0",
    downloadHero2: "мобильное приложение",
    downloadBtn: "Скачать",
    downloadAndroid: "Для Android",
    downloadIOS: "Для iOS",
    downloadAPK: "APK файл",
    downloadQR: "QR код",
    downloadSize: "45 MB",
    downloadVersion: "1.0.2",
    downloadNote: "Перед скачиванием необходимо зарегистрироваться",
    downloadFeature1: "30-секундный QR",
    downloadFeature2: "История посещений",
    downloadFeature3: "Уведомления",
    downloadFeature4: "Офлайн режим",
    studentZone: "Специальная зона для учеников",
    studentZoneDesc: "Отслеживайте и изменяйте посещаемость через мобильное приложение. Каждый QR-код защищен новой технологией.",
    whyStudents: "Почему студенты выбирают нас?",
    stat1: "Надежная проверка",
    stat2: "Поддержка 24/7",
    stat3: "Бесплатное использование",
    backToHome: "Вернуться на главную",
    features: "Возможности приложения",
    feature1: "Быстрое сканирование QR",
    feature2: "Обновление в реальном времени",
    feature3: "Просмотр истории",
    feature4: "Уведомления",
    requirement: "Системные требования",
    req1: "Android 8.0 или выше",
    req2: "iOS 14.0 или выше",
    req3: "Интернет соединение",
    req4: "Школьный аккаунт",
    footerText: "Все права защищены.",
    login: "Войти",
  },
  en: {
    downloadTitle: "Download the App",
    downloadDesc: "Install Davomat 1.0 and take ownership of your attendance history.",
    downloadHero1: "Davomat 1.0",
    downloadHero2: "mobile app",
    downloadBtn: "Download",
    downloadAndroid: "For Android",
    downloadIOS: "For iOS",
    downloadAPK: "APK File",
    downloadQR: "QR Code",
    downloadSize: "45 MB",
    downloadVersion: "1.0.2",
    downloadNote: "You must register before downloading",
    downloadFeature1: "30s QR Code",
    downloadFeature2: "Attendance History",
    downloadFeature3: "Notifications",
    downloadFeature4: "Offline Mode",
    studentZone: "Exclusive Student Zone",
    studentZoneDesc: "Track and manage your attendance via mobile app. Every QR code is protected by new technology.",
    whyStudents: "Why students choose us?",
    stat1: "Trusted Check-in",
    stat2: "24/7 Support",
    stat3: "Free to Use",
    backToHome: "Back to Home",
    features: "App Features",
    feature1: "Fast QR Scanning",
    feature2: "Real-time Updates",
    feature3: "History View",
    feature4: "Notifications",
    requirement: "Requirements",
    req1: "Android 8.0 or higher",
    req2: "iOS 14.0 or higher",
    req3: "Internet connection",
    req4: "School account",
    footerText: "All rights reserved.",
    login: "Sign In",
  }
}

export default function DownloadPage() {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'uz'
    return (localStorage.getItem('lang') as Language | null) || 'uz'
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('theme') as 'light' | 'dark' | null) || 'dark'
  })
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const supabase = createClient()
  const t = translations[lang]

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })
  }, [supabase.auth, theme])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    if (next === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const changeLanguage = (newLang: Language) => {
    setLang(newLang)
    localStorage.setItem('lang', newLang)
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-blue-500/20 selection:text-blue-300 dark:selection:bg-blue-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-[1] opacity-[0.15] dark:opacity-[0.25]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="fixed top-[-10%] left-[50%] -translate-x-1/2 w-[700px] h-[550px] rounded-full bg-gradient-to-br from-blue-600/10 to-indigo-600/5 blur-[120px] pointer-events-none z-[1] opacity-70 dark:opacity-100" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none z-[1]" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-background/85 backdrop-blur-md border-b border-border shadow-sm dark:shadow-black/20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs text-white font-black shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
                ◈
              </span>
              <span className="text-sm font-bold tracking-widest uppercase text-slate-900 dark:text-stone-200">
                Davomat 1.0
              </span>
            </Link>
            <Link href="/" className="hidden sm:flex items-center gap-1 text-slate-600 dark:text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.backToHome}</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group/lang flex items-center gap-1 cursor-pointer py-1 text-slate-600 dark:text-stone-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">{lang}</span>
              <div className="absolute right-0 top-full pt-2 opacity-0 pointer-events-none group-hover/lang:opacity-100 group-hover/lang:pointer-events-auto transition-all">
                <div className="bg-white dark:bg-card border border-border rounded-xl shadow-xl p-1.5 flex flex-col gap-1 min-w-[70px]">
                  {(['uz', 'ru', 'en'] as Language[]).map((ln) => (
                    <button
                      key={ln}
                      onClick={() => changeLanguage(ln)}
                      className={`px-3 py-1.5 rounded-lg text-left text-xs font-bold uppercase transition-all ${
                        lang === ln
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 dark:text-stone-300 hover:bg-muted dark:hover:bg-muted'
                      }`}
                    >
                      {ln}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-xl bg-muted border border-border flex items-center justify-center text-slate-600 dark:text-stone-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="hidden sm:inline-block text-xs font-bold tracking-widest uppercase text-slate-600 dark:text-stone-400 hover:text-black dark:hover:text-white transition-colors"
            >
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 relative z-10">
        {/* Hero */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-6">
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadTitle}</span>
            </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight leading-[1.08] mb-4 max-w-3xl mx-auto text-slate-900 dark:text-white">
                {t.downloadHero1} <span className="font-semibold bg-gradient-to-r from-blue-600 via-indigo-400 to-indigo-600 bg-clip-text text-transparent">{t.downloadHero2}</span>
              </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t.downloadDesc}
            </p>
          </div>
        </section>

        {/* Download Cards */}
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Android */}
            <div className="group relative bg-gradient-to-br from-green-500/10 to-emerald-500/5 dark:from-green-500/20 dark:to-emerald-500/10 border border-green-500/20 rounded-3xl p-8 hover:scale-[1.02] transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <SmartphoneNfc className="w-7 h-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">{t.downloadAndroid}</div>
                    <div className="text-xs text-slate-600 dark:text-stone-300 font-mono">v{t.downloadVersion}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">APK</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadSize}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {[t.downloadFeature1, t.downloadFeature2, t.downloadFeature3, t.downloadFeature4].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-stone-300">
                      <CheckCheck className="w-3.5 h-3.5 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/25 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  {t.downloadBtn}
                </button>

                <p className="text-[10px] text-slate-500 dark:text-muted-foreground text-center">
                  {t.downloadNote}
                </p>
              </div>
            </div>

            {/* iOS */}
            <div className="group relative bg-gradient-to-br from-blue-500/10 to-indigo-500/5 dark:from-blue-500/20 dark:to-indigo-500/10 border border-blue-500/20 rounded-3xl p-8 hover:scale-[1.02] transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
              <div className="relative space-y-6">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <SmartphoneNfc className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-500 dark:text-stone-400 uppercase tracking-wider">{t.downloadIOS}</div>
                    <div className="text-xs text-slate-600 dark:text-stone-300 font-mono">v{t.downloadVersion}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">TestFlight</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadSize}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {[t.downloadFeature1, t.downloadFeature2, t.downloadFeature3, t.downloadFeature4].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-stone-300">
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" />
                  {t.downloadBtn}
                </button>

                <p className="text-[10px] text-slate-500 dark:text-muted-foreground text-center">
                  {t.downloadNote}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* App Features */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-extrabold mb-3">
                {t.features}
              </div>
              <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white">
                Ilova imkoniyatlari
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: QrCode, label: t.feature1, color: 'blue' },
                { icon: Zap, label: t.feature2, color: 'indigo' },
                { icon: Database, label: t.feature3, color: 'emerald' },
                { icon: ShieldCheck, label: t.feature4, color: 'purple' },
              ].map((item, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-6 text-center hover:border-blue-500/30 hover:scale-105 transition-all duration-300">
                  <div className={`w-12 h-12 rounded-xl bg-${item.color}-500/10 border border-${item.color}-500/20 flex items-center justify-center mx-auto mb-3`}>
                    <item.icon className={`w-6 h-6 text-${item.color}-600 dark:text-${item.color}-400`} />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* System Requirements */}
        <section className="py-12 px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-card border border-border rounded-3xl p-8">
              <div className="text-center mb-6">
                <div className="inline-block text-[10px] uppercase tracking-widest text-slate-500 dark:text-stone-400 font-extrabold mb-2">
                  {t.requirement}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[t.req1, t.req2, t.req3, t.req4].map((req, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted border border-border">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <CheckCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-stone-300">{req}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="p-10 md:p-14 rounded-3xl border border-border bg-card relative overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

              <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4 text-slate-900 dark:text-white">
                {t.studentZone}
              </h2>
              <p className="text-slate-600 dark:text-muted-foreground text-xs sm:text-sm max-w-lg mx-auto mb-8 font-light">
                {t.studentZoneDesc}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/25">
                  <Download className="w-4 h-4" />
                  {t.downloadBtn}
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-border bg-muted hover:bg-slate-200 dark:hover:bg-muted text-slate-700 dark:text-stone-300 text-xs font-bold uppercase tracking-widest transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.backToHome}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-slate-500 dark:text-muted-foreground text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center text-[10px] text-white">◈</span>
            <span className="font-bold text-slate-900 dark:text-stone-400">DAVOMAT 1.0</span>
          </div>
          <div>© 2026 Davomat. {t.footerText}</div>
          <div className="flex items-center gap-4">
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="text-blue-600 dark:text-blue-400 font-semibold transition-colors">
              {t.login} →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

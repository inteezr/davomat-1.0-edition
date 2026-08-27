'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  QrCode,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Database,
  Globe,
  Sun,
  Moon,
  Download,
  SmartphoneNfc,
  Star,
  Zap,
  Trophy,
  Target,
  Rocket,
  Heart,
  CheckCheck,
  Timer,
  Flame
} from 'lucide-react'

type Language = 'uz' | 'ru' | 'en'

const translations = {
  uz: {
    features: "Imkoniyatlar",
    simulator: "Demo Simulyator",
    stats: "Raqamlar",
    login: "Kirish",
    dashboard: "Dashboard",
    dashboardGo: "Dashboardga o'tish",
    getStarted: "Boshlash",
    heroTitle1: "Maktab davomati va ekotizim",
    heroTitle2: "mutlaqo aqlli va universal",
    heroSubtitle: "Doimiy universal o'quvchi QR-kodlari. Davomat, darsdagi interaktiv o'yinlar, viktorinalar va maktab xizmatlariga ulanish uchun yagona raqamli platforma.",
    simulateScan: "Skanerlashni simulyatsiya qilish",
    scanning: "Skanerlanmoqda...",
    success: "TASDIQLANDI",
    present: "Keldi",
    late: "Kechikdi",
    activeActivity: "Faoliyat",
    todayStudents: "Bugun kelgan o'quvchilar",
    lateStudents: "Kechikib kelganlar soni",
    excelDownload: "Excel Yuklab Olish",
    excelReady: "Barcha davomat jadvallari tayyor",
    interactiveZone: "Interaktiv Hudud",
    howItWorks: "Tizim qanday ishlaydi?",
    liveTry: "Jonli sinab ko'ring",
    phoneLabel: "O'QUVCHI TELEFONI",
    monitorLabel: "MAKTAB SCANNER MONITORI",
    qrActive: "DOIMIY UNIVERSAL QR",
    qrLabel: "UNIVERSAL QR KOD",
    noConnection: "Server bilan aloqa yo'q",
    setupServer: "Server manzilini sozlash",
    update: "Yangilash",
    updating: "Yangilanmoqda...",
    myHistory: "Davomat tarixim",
    advantages: "Afzalliklar",
    whyUs: "Nega aynan Davomat 1.0 ekotizimi?",
    bottomCtaTitle: "Maktabingizni raqamli ekotizimga o'tkazing",
    bottomCtaDesc: "Qog'oz daftarlardan butunlay voz keching. Doimiy universal QR-kodlar yordamida davomat va dars o'yinlarini yagona tizimda boshqaring.",
    bottomCtaBtn: "Tizimni ulash",
    footerText: "Barcha huquqlar himoyalangan.",
    schoolsStat: "Hamkor maktablar",
    studentsStat: "Faol o'quvchilar",
    stabilityStat: "Tizim barqarorligi",
    logTitle: "Kirish jurnali (Bugun)",
    noLogs: "Hali skanerlar yo'q. Chap tomondagi tugmani bosing.",
    monitorDesc: "Maktab skaner kamerasi orqali o'quvchi QR kodi skanerlanadi. Ma'lumotlar avtomatik tarzda markaziy bazada qayd etiladi.",
    feature1Title: "Doimiy Universal QR-Kodlar",
    feature1Desc: "Har bir o'quvchining doimiy QR kodi orqali nafaqat davomat, balki darsdagi interaktiv o'yinlar, testlar va maktab loyihalariga ulanish mumkin.",
    feature2Title: "Eksport va Import",
    feature2Desc: "O'quvchilar ma'lumotlarini Excel orqali bir necha soniyada yuklang va oylik yoki haftalik hisobotlarni Excel shaklida oson yuklab oling.",
    feature3Title: "Markazlashtirilgan baza",
    feature3Desc: "Bulutli ma'lumotlar bazasi barcha maktablar, sinflar va o'quvchilar statistikasini alohida-alohida va xavfsiz holatda saqlaydi.",
    feature4Title: "O'quvchilar mobil ilovasi",
    feature4Desc: "Flutterda yozilgan chiroyli mobil ilova yordamida o'quvchilar o'z doimiy QR kodlarini ko'rsatishadi va davomatlarini kuzatishadi.",
    feature5Title: "Xavfsizlik kafolati",
    feature5Desc: "Supabase JWT va SSL shifrlash yordamida barcha o'quvchilar va maktab ma'muriyati shaxsiy ma'lumotlari to'liq himoya qilinadi.",
    feature6Title: "Sinflarni guruhlash",
    feature6Desc: "Sinflar va rahbariyat boshqaruvi juda oson. Har bir sinf rahbari faqat o'z o'quvchilarini osonlikcha nazorat qila oladi.",
    downloadTitle: "Ilovani yuklab oling",
    downloadDesc: "Davomat 1.0 ilovasini o'rnating va o'zingizning doimiy QR pass hamda davomat tarixingizga ega bo'ling.",
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
    downloadFeature3: "Darsdagi o'yinlar va integratsiyalar",
    downloadFeature4: "Onlayn rejim",
    studentZone: "O'quvchilar va O'yinlar Ekotizimi",
    studentZoneDesc: "Doimiy QR kodingiz orqali davomatingizni qayd eting va darsdagi interaktiv o'yinlar hamda musobaqalarda qatnashing.",
    whyStudents: "Nega talabalar bizni tanlaydi?",
    stat1: "Ishonchli tekshiruv",
    stat2: "24/7 qo'llab-quvvatlash",
    stat3: "Bepul foydalanish",
  },
  ru: {
    features: "Возможности",
    simulator: "Демо Симулятор",
    stats: "Показатели",
    login: "Войти",
    dashboard: "Дашборд",
    dashboardGo: "Перейти в дашборд",
    getStarted: "Начать",
    heroTitle1: "Посещаемость школы теперь",
    heroTitle2: "абсолютно умная и простая",
    heroSubtitle: "Динамические 30-секундные QR-коды, которые невозможно подделать. Прозрачная интеграция в реальном времени между родителями, учителями и администрацией.",
    simulateScan: "Симулировать сканирование",
    scanning: "Сканирование...",
    success: "ПОДТВЕРЖДЕНО",
    present: "Пришел",
    late: "Опоздал",
    activeActivity: "Активность",
    todayStudents: "Пришедшие сегодня ученики",
    lateStudents: "Количество опоздавших",
    excelDownload: "Скачать Excel",
    excelReady: "Все отчеты посещаемости готовы",
    interactiveZone: "Интерактивная зона",
    howItWorks: "Как это работает?",
    liveTry: "Попробуйте вживую",
    phoneLabel: "ТЕЛЕФОН УЧЕНИКА",
    monitorLabel: "МОНИТОР СКАНЕРА ШКОЛЫ",
    qrActive: "QR ПОСЕЩАЕМОСТИ АКТИВЕН",
    qrLabel: "QR КОД ПОСЕЩАЕМОСТИ",
    noConnection: "Нет связи с сервером",
    setupServer: "Настроить адрес сервера",
    update: "Обновить",
    updating: "Обновление...",
    myHistory: "Моя посещаемость",
    advantages: "Преимущества",
    whyUs: "Почему именно система Davomat 1.0?",
    bottomCtaTitle: "Реформируйте посещаемость сегодня",
    bottomCtaDesc: "Полностью откажитесь от бумажных журналов. Перейдите на современную систему с использованием Excel и динамических QR-кодов.",
    bottomCtaBtn: "Подключить систему",
    footerText: "Все права защищены.",
    schoolsStat: "Школ-партнеров",
    studentsStat: "Активных учеников",
    stabilityStat: "Стабильность системы",
    logTitle: "Журнал входа (Сегодня)",
    noLogs: "Нет сканирований. Нажмите кнопку слева.",
    monitorDesc: "Телефон ученика сканируется камерой школьного сканера. Данные автоматически обновляются в центральной базе данных.",
    feature1Title: "Динамические QR-коды",
    feature1Desc: "QR-коды в приложении обновляются каждые 30 секунд, поэтому их невозможно сфотографировать, распространить или подделать.",
    feature2Title: "Импорт и Экспорт",
    feature2Desc: "Загружайте данные учеников через Excel за секунды и легко скачивайте ежемесячные или еженедельные отчеты в формате Excel.",
    feature3Title: "Централизованная база",
    feature3Desc: "Облачная база данных хранит статистику всех школ, классов и учеников отдельно друг от друга в полной безопасности.",
    feature4Title: "Мобильное приложение ученика",
    feature4Desc: "Красивое и удобное приложение, написанное на Flutter, где ученики авторизуются по своим паролям и показывают QR-код.",
    feature5Title: "Гарантия безопасности",
    feature5Desc: "Личные данные всех учеников и школьной администрации полностью защищены с помощью Supabase JWT и шифрования SSL.",
    feature6Title: "Группировка классов",
    feature6Desc: "Очень простое управление классами и руководством. Каждый классный руководитель видит и контролирует только своих учеников.",
    downloadTitle: "Скачайте приложение",
    downloadDesc: "Установите Davomat 1.0 и станьте хозяином своей истории посещаемости.",
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
  },
  en: {
    features: "Features",
    simulator: "Demo Simulator",
    stats: "Numbers",
    login: "Sign In",
    dashboard: "Dashboard",
    dashboardGo: "Go to Dashboard",
    getStarted: "Get Started",
    heroTitle1: "School attendance is now",
    heroTitle2: "absolutely smart and simple",
    heroSubtitle: "Unforgeable 30-second dynamic QR codes. Real-time transparent integration between parents, teachers, and school administration.",
    simulateScan: "Simulate Scanning",
    scanning: "Scanning...",
    success: "CONFIRMED",
    present: "Present",
    late: "Late",
    activeActivity: "Activity",
    todayStudents: "Students present today",
    lateStudents: "Number of late arrivals",
    excelDownload: "Download Excel",
    excelReady: "All attendance sheets ready",
    interactiveZone: "Interactive Zone",
    howItWorks: "How does it work?",
    liveTry: "Try it live",
    phoneLabel: "STUDENT PHONE",
    monitorLabel: "SCHOOL SCANNER MONITOR",
    qrActive: "ATTENDANCE QR ACTIVE",
    qrLabel: "ATTENDANCE QR CODE",
    noConnection: "No connection to server",
    setupServer: "Configure server address",
    update: "Refresh",
    updating: "Refreshing...",
    myHistory: "My Attendance",
    advantages: "Advantages",
    whyUs: "Why Davomat 1.0?",
    bottomCtaTitle: "Reform attendance today",
    bottomCtaDesc: "Ditch paper registers completely. Transition to a modern system using Excel and dynamic QR codes.",
    bottomCtaBtn: "Connect System",
    footerText: "All rights reserved.",
    schoolsStat: "Partner schools",
    studentsStat: "Active students",
    stabilityStat: "System stability",
    logTitle: "Access log (Today)",
    noLogs: "No scans yet. Click the button on the left.",
    monitorDesc: "The student's phone is scanned via the school scanner camera. Data is automatically synchronized with the central database.",
    feature1Title: "Dynamic QR Codes",
    feature1Desc: "QR codes in the app refresh every 30 seconds, making it impossible to share or forge the attendance mark.",
    feature2Title: "Export and Import",
    feature2Desc: "Upload student details via Excel in seconds, and download monthly or weekly attendance reports in Excel format easily.",
    feature3Title: "Centralized Database",
    feature3Desc: "Cloud database stores statistics of all schools, classes, and students separately and securely.",
    feature4Title: "Student Mobile App",
    feature4Desc: "A beautiful Flutter-built mobile app where students log in using their credentials and present their dynamic QR codes.",
    feature5Title: "Security Guarantee",
    feature5Desc: "Personal details of all students and school administration are fully secured via Supabase JWT and SSL encryption.",
    feature6Title: "Class Grouping",
    feature6Desc: "Highly intuitive management of classes and school administration. Each class teacher controls only their respective students.",
    downloadTitle: "Download the App",
    downloadDesc: "Install Davomat 1.0 and take ownership of your attendance history.",
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
  }
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setVisible(true)
    }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  const { ref, visible } = useInView()
  useEffect(() => {
    if (!visible) return
    let start = 0
    const step = target / 40
    const t = setInterval(() => {
      start += step
      if (start >= target) {
        setVal(target)
        clearInterval(t)
      } else {
        setVal(Math.floor(start))
      }
    }, 20)
    return () => clearInterval(t)
  }, [visible, target])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

function ParticleCloud() {
  return null
}

function FloatingShape({ icon: Icon, delay = 0, className = '' }: { icon: React.ElementType; delay?: number; className?: string }) {
  return (
    <div className={`absolute animate-float opacity-20 dark:opacity-30 ${className}`} style={{ animationDelay: `${delay}s` }}>
      <Icon className="w-12 h-12 text-blue-500 dark:text-blue-400" />
    </div>
  )
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [lang, setLang] = useState<Language>('uz')

  const [simName, setSimName] = useState('Aliyev Rustam')
  const [simClass, setSimClass] = useState('10-B')
  const [qrToken, setQrToken] = useState('DAV-2026-X7')
  const [simStatus, setSimStatus] = useState<string | null>(null)
  const [scannedLogs, setScannedLogs] = useState<Array<{ name: string; cls: string; time: string; status: string }>>([])

  const supabase = createClient()
  const t = translations[lang]

  useEffect(() => {
    // Load saved preferences on client mount without hydration mismatch
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | null) || 'dark'
    setTheme(savedTheme)
    const savedLang = (localStorage.getItem('lang') as Language | null) || 'uz'
    setLang(savedLang)
    setQrToken(Math.random().toString(36).substring(7).toUpperCase())

    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
    })

    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    return () => window.removeEventListener('scroll', handleScroll)
  }, [supabase.auth])

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

  const handleSimulateScan = () => {
    if (simStatus) return
    setSimStatus('scanning')
    setTimeout(() => {
      setSimStatus('success')
      const now = new Date()
      const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setScannedLogs(prev => [
        { name: simName, cls: simClass, time: timeStr, status: t.present },
        ...prev.slice(0, 2)
      ])
      setTimeout(() => {
        const students = [
          { name: lang === 'en' ? 'Smith John' : 'Sirojiddinov Shahzod', cls: '11-A' },
          { name: lang === 'en' ? 'Taylor Jessica' : 'Karimova Gulnoza', cls: '9-B' },
          { name: lang === 'en' ? 'Davis Michael' : 'Yusupov Farhod', cls: '10-A' },
          { name: lang === 'en' ? 'Miller Emma' : 'Aliyeva Madina', cls: '10-B' }
        ]
        const next = students[Math.floor(Math.random() * students.length)]
        setSimName(next.name)
        setSimClass(next.cls)
        setSimStatus(null)
      }, 1500)
    }, 1200)
  }

  const { ref: featRef, visible: featVisible } = useInView()
  const { ref: simRef, visible: simVisible } = useInView()
  const { ref: ctaRef, visible: ctaVisible } = useInView()
  const { ref: downloadRef, visible: downloadVisible } = useInView()

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-blue-500/20 selection:text-blue-300 dark:selection:bg-blue-500/30">
      <ParticleCloud />

      {/* ── Dynamic Grid Background ── */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.15] dark:opacity-[0.25]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Radial Blue-Indigo glow */}
      <div className="fixed top-[-10%] left-[50%] -translate-x-1/2 w-[700px] h-[550px] rounded-full bg-gradient-to-br from-blue-600/10 to-indigo-600/5 blur-[120px] pointer-events-none z-[1] opacity-70 dark:opacity-100" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none z-[1]" />

      {/* Floating decorative shapes */}
      <FloatingShape icon={Sparkles} delay={0} className="top-20 left-[10%]" />
      <FloatingShape icon={Zap} delay={2} className="top-40 right-[15%]" />
      <FloatingShape icon={Star} delay={4} className="bottom-40 left-[20%]" />
      <FloatingShape icon={Trophy} delay={1} className="bottom-20 right-[10%]" />

      {/* ════════════════════════════════════
          NAVBAR
      ════════════════════════════════════ */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 dark:bg-background/85 backdrop-blur-md border-b border-border shadow-sm dark:shadow-black/20'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs text-white font-black shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all">
              ◈
            </span>
            <span className="text-sm font-bold tracking-widest uppercase text-slate-900 dark:text-stone-200 group-hover:text-black dark:group-hover:text-white transition-colors">
              Davomat 1.0
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[11px] font-bold tracking-widest uppercase text-slate-600 dark:text-stone-400">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.features}</a>
            <a href="#simulator" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.simulator}</a>
            <a href="#download" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.downloadTitle}</a>
            <a href="#stats" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{t.stats}</a>
          </nav>

          <div className="flex items-center gap-4">
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
              {isLoggedIn ? t.dashboard : t.login}
            </Link>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="text-xs font-bold tracking-widest uppercase px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all hover:scale-[1.03] active:scale-95 shadow-lg shadow-blue-500/25"
            >
              {isLoggedIn ? t.dashboardGo : t.getStarted}
            </Link>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════
          HERO
      ════════════════════════════════════ */}
      <section className="relative z-10 pt-32 pb-24 px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-8 shadow-inner animate-fade-in-up">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-time QR va Excel hisobot tizimi</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight leading-[1.08] mb-6 max-w-4xl mx-auto text-slate-900 dark:text-white animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {t.heroTitle1}
          <br />
          <span className="font-semibold bg-gradient-to-r from-blue-600 via-indigo-400 to-indigo-600 bg-clip-text text-transparent animate-gradient">
            {t.heroTitle2}
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-600 dark:text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-light animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {t.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-20 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <Link
            href={isLoggedIn ? "/dashboard" : "/login"}
            className="group flex items-center gap-2 px-7 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-widest uppercase shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-95 animate-pulse-glow"
          >
            {isLoggedIn ? t.dashboardGo : t.login}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#simulator"
            className="px-7 py-3.5 rounded-full border border-border bg-muted dark:bg-muted hover:bg-slate-200 dark:hover:bg-muted text-slate-700 dark:text-stone-300 font-semibold text-xs tracking-widest uppercase transition-all backdrop-blur-md hover:scale-105"
          >
            {t.simulateScan}
          </a>
        </div>

        {/* Dashboard Mockup */}
        <div className="relative max-w-4xl mx-auto rounded-3xl border border-border bg-card shadow-2xl dark:shadow-black/40 transition-all p-3 animate-scale-in" style={{ animationDelay: '0.4s' }}>
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-blue-500/10 to-transparent blur-md opacity-50" />
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted dark:bg-muted">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-stone-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-stone-700" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-stone-700" />
              </div>
              <div className="text-[10px] text-slate-500 dark:text-stone-500 tracking-wider font-mono">davomat-smart.uz/monitoring</div>
              <div className="w-10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border text-foreground">
              <div className="p-5 text-left space-y-4">
                <div className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">{t.activeActivity}</div>
                <div className="space-y-2">
                  <div className="h-2 w-24 bg-slate-200 dark:bg-stone-800 rounded" />
                  <div className="h-6 w-16 bg-muted border border-border rounded flex items-center px-2 text-xs font-bold">142 ta</div>
                  <div className="text-[10px] text-slate-500 dark:text-muted-foreground">{t.todayStudents}</div>
                </div>
              </div>
              <div className="p-5 text-left space-y-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-stone-400 font-bold">{t.late}</div>
                <div className="space-y-2">
                  <div className="h-2 w-24 bg-slate-200 dark:bg-stone-800 rounded" />
                  <div className="h-6 w-16 bg-muted border border-border rounded flex items-center px-2 text-xs font-bold">8 ta</div>
                  <div className="text-[10px] text-slate-500 dark:text-muted-foreground">{t.lateStudents}</div>
                </div>
              </div>
              <div className="p-5 text-left space-y-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-stone-400 font-bold">{t.stats}</div>
                <div className="space-y-2.5">
                  <div className="h-6 w-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-[10px] font-bold tracking-widest uppercase">
                    {t.excelDownload}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-muted-foreground text-center">{t.excelReady}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          STUDENT ZONE HIGHLIGHT
      ════════════════════════════════════ */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 dark:from-blue-500/20 dark:via-indigo-500/10 dark:to-purple-500/20 rounded-3xl border border-blue-500/20 p-8 md:p-12 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="text-left space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider">
                  <Flame className="w-3.5 h-3.5" />
                  {t.studentZone}
                </div>
                <h2 className="text-2xl md:text-3xl font-light tracking-tight text-slate-900 dark:text-white">
                  {t.whyStudents}
                </h2>
                <p className="text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                  {t.studentZoneDesc}
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { icon: Target, text: t.stat1 },
                    { icon: Timer, text: t.stat2 },
                    { icon: Heart, text: t.stat3 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-white/5 border border-border text-xs">
                      <item.icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold text-slate-700 dark:text-stone-300">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-center">
                <div className="relative w-48 h-96 bg-slate-900 dark:bg-slate-950 rounded-[3rem] border-4 border-slate-800 shadow-2xl overflow-hidden animate-float">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl" />
                  <div className="h-full w-full flex flex-col items-center justify-center p-4 space-y-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <QrCode className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-[10px] text-center text-slate-400 font-mono">
                      {t.qrLabel}
                    </div>
                    <div className="w-24 h-24 bg-white rounded-xl flex items-center justify-center">
                      <div className="w-20 h-20 grid grid-cols-6 gap-0.5">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <div key={i} className={`rounded-sm ${(i * 7 + 13) % 5 === 0 ? 'bg-slate-900' : 'bg-slate-200'}`} />
                        ))}
                      </div>
                    </div>
                    <div className="text-[8px] text-blue-400 font-mono animate-pulse">
                      ● {t.qrActive}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          LIVE SIMULATOR
      ════════════════════════════════════ */}
      <section id="simulator" className="py-24 px-6 border-y border-border bg-muted/50 dark:bg-muted/30">
        <div ref={simRef} className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-block text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-extrabold mb-3 animate-fade-in-up">
              {t.interactiveZone}
            </div>
            <h2 className="text-3xl font-light tracking-tight text-slate-900 dark:text-white animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              {t.howItWorks} <span className="font-semibold text-blue-600 dark:text-blue-400">{t.liveTry}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Phone Simulator */}
            <div className={`bg-card border border-border rounded-3xl p-6 flex flex-col justify-between min-h-[360px] relative shadow-lg transition-all duration-700 ${simVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
              <div className="absolute top-4 right-4 text-[9px] font-mono text-slate-400 dark:text-stone-600">{t.phoneLabel}</div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black animate-pulse-glow">
                    {simName[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{simName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-muted-foreground">{simClass} sinfi · ID: ST0924</div>
                  </div>
                </div>

                {/* QR Display */}
                <div className="h-44 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                  {simStatus === 'scanning' && (
                    <div className="absolute inset-0 bg-slate-950/80 dark:bg-slate-950/90 flex items-center justify-center text-xs text-blue-400 font-mono tracking-widest uppercase animate-pulse">
                      {t.scanning}
                    </div>
                  )}
                  {simStatus === 'success' && (
                    <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-xs text-white font-bold tracking-wider gap-1 animate-fade-in-up">
                      <CheckCircle2 className="w-8 h-8 text-white animate-bounce-gentle" />
                      {t.success}
                    </div>
                  )}

                  <div className="w-28 h-28 grid grid-cols-6 gap-0.5 opacity-90">
                    {Array.from({ length: 36 }).map((_, i) => (
                      <div key={i} className={`rounded-sm ${(i * 7 + 13) % 5 === 0 || (i > 8 && i < 15) ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    ))}
                  </div>
                  <div className="text-[8px] text-slate-400 dark:text-stone-500 mt-2 tracking-widest font-mono">TOKEN: {qrToken}</div>
                </div>
              </div>

              <button
                onClick={handleSimulateScan}
                disabled={simStatus !== null}
                className="mt-6 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-muted dark:disabled:bg-muted text-white disabled:text-slate-400 dark:disabled:text-muted-foreground text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95"
              >
                {simStatus === 'scanning' ? t.scanning : simStatus === 'success' ? t.success : t.simulateScan}
              </button>
            </div>

            {/* School Monitor Simulator */}
            <div className={`bg-card border border-border rounded-3xl p-6 flex flex-col justify-between min-h-[360px] relative text-left shadow-lg transition-all duration-700 ${simVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`} style={{ transitionDelay: '0.1s' }}>
              <div className="absolute top-4 right-4 text-[9px] font-mono text-slate-400 dark:text-stone-600">{t.monitorLabel}</div>

              <div className="space-y-4">
                <div className="text-xs uppercase tracking-wider text-slate-600 dark:text-stone-400 font-bold border-b border-border pb-2">{t.logTitle}</div>

                <div className="space-y-2">
                  {scannedLogs.length === 0 ? (
                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 dark:text-stone-600 text-xs border border-dashed border-border rounded-xl">
                      <QrCode className="w-8 h-8 mb-2 opacity-30" />
                      {t.noLogs}
                    </div>
                  ) : (
                    scannedLogs.map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted border border-border rounded-xl animate-fade-in-up">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">{log.name}</div>
                            <div className="text-[9px] text-slate-500 dark:text-muted-foreground">{log.cls}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-500 dark:text-stone-400 font-mono">{log.time}</div>
                          <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">{log.status}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="text-[10px] text-slate-500 dark:text-muted-foreground border-t border-border pt-3">
                {t.monitorDesc}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          DOWNLOAD SECTION
      ════════════════════════════════════ */}
      <section id="download" className="py-24 px-6">
        <div ref={downloadRef} className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-widest uppercase mb-4">
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadTitle}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900 dark:text-white mb-4">
              {t.heroTitle1} <span className="font-semibold text-blue-600 dark:text-blue-400">{t.heroTitle2}</span>
            </h2>
            <p className="text-sm text-slate-600 dark:text-muted-foreground max-w-2xl mx-auto">
              {t.downloadDesc}
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 transition-all duration-700 ${downloadVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {/* Android Download Card */}
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">APK</h3>
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

            {/* iOS Download Card */}
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">TestFlight</h3>
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

          {/* Download Features Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[
              { icon: QrCode, label: t.downloadFeature1, color: 'blue' },
              { icon: Database, label: t.downloadFeature2, color: 'indigo' },
              { icon: ShieldCheck, label: t.downloadFeature3, color: 'emerald' },
              { icon: Smartphone, label: t.downloadFeature4, color: 'purple' },
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

      {/* ════════════════════════════════════
          FEATURES GRID
      ════════════════════════════════════ */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-extrabold mb-3">
            {t.advantages}
          </div>
          <h2 className="text-3xl sm:text-4xl font-light tracking-tight text-slate-900 dark:text-white">
            {t.whyUs}
          </h2>
        </div>

        <div
          ref={featRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            {
              icon: <QrCode className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature1Title,
              desc: t.feature1Desc
            },
            {
              icon: <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature2Title,
              desc: t.feature2Desc
            },
            {
              icon: <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature3Title,
              desc: t.feature3Desc
            },
            {
              icon: <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature4Title,
              desc: t.feature4Desc
            },
            {
              icon: <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature5Title,
              desc: t.feature5Desc
            },
            {
              icon: <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
              title: t.feature6Title,
              desc: t.feature6Desc
            }
          ].map((f, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border border-border bg-card transition-all duration-300 hover:border-blue-500/30 hover:scale-[1.01] shadow-sm hover:shadow-md ${
                featVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-xs text-slate-600 dark:text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════
          STATS NUMBERS
      ════════════════════════════════════ */}
      <section id="stats" className="py-20 border-t border-border">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {[
            { target: 50, suffix: '+', title: t.schoolsStat },
            { target: 20000, suffix: '+', title: t.studentsStat },
            { target: 99, suffix: '.9%', title: t.stabilityStat },
          ].map((stat, i) => (
            <div key={i} className="space-y-1">
              <div className="text-3xl md:text-4xl font-light tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300 bg-clip-text text-transparent">
                <AnimatedNumber target={stat.target} suffix={stat.suffix} />
              </div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-muted-foreground">{stat.title}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════════
          BOTTOM CALL TO ACTION
      ════════════════════════════════════ */}
      <section className="py-24 px-6 border-t border-border">
        <div ref={ctaRef} className="max-w-3xl mx-auto text-center">
          <div className={`p-10 md:p-14 rounded-3xl border border-border bg-card relative overflow-hidden transition-all duration-700 ${
            ctaVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}>
            <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

            <Rocket className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4 animate-float" />
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4 text-slate-900 dark:text-white">
              {t.bottomCtaTitle}
            </h2>
            <p className="text-slate-600 dark:text-muted-foreground text-xs sm:text-sm max-w-lg mx-auto mb-8 font-light">
              {t.bottomCtaDesc}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                href={isLoggedIn ? "/dashboard" : "/login"}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-blue-500/25"
              >
                {isLoggedIn ? t.dashboardGo : t.bottomCtaBtn}
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/download"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full border border-border bg-muted hover:bg-slate-200 dark:hover:bg-muted text-slate-700 dark:text-stone-300 text-xs font-bold uppercase tracking-widest transition-all"
              >
                <Download className="w-4 h-4" />
                {t.downloadBtn}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          FOOTER
      ════════════════════════════════════ */}
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
            <Link href="/download" className="text-blue-600 dark:text-blue-400 font-semibold transition-colors">
              {t.downloadTitle} →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

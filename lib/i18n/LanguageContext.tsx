'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Language, translations, TranslationKey } from './translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, fallback?: string) => string
}

const LANG_KEY = 'davomat_lang'

const LanguageContext = createContext<LanguageContextType>({
  language: 'uz',
  setLanguage: () => {},
  t: (key: TranslationKey, fallback?: string) => fallback || key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('uz')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Language | null
      if (saved && (saved === 'uz' || saved === 'en' || saved === 'ru')) {
        setLanguageState(saved)
      }
    } catch {
      // localStorage error fallback
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // ignore
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const langDict = translations[language] || translations['uz']
      return (langDict as any)[key] || (translations['uz'] as any)[key] || fallback || key
    },
    [language]
  )

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

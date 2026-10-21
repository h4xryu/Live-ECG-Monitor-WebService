import type React from "react"
import "@/app/globals.css"
import { Inter } from "next/font/google"
import Link from "next/link"
import { ThemeProvider } from "@/components/theme-provider"
import { ECGDataProvider } from "@/context/ecg-data-context"
import { ModelProvider } from "@/context/model-context"
import { ThemeToggle } from "@/components/theme-toggle"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "ECG Arrhythmia Classification",
  description: "Web-based ECG arrhythmia classification system",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ECGDataProvider>
            <ModelProvider>
              <div className="min-h-screen flex flex-col">
                <header className="border-b">
                  <div className="container mx-auto py-3 px-4 md:px-6 flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold hover:opacity-80">
                      ECG Arrhythmia Classification
                    </Link>
                    <div className="flex items-center gap-4">
                      <Link href="/tools" className="text-sm font-medium hover:underline">
                        분석 도구
                      </Link>
                      <ThemeToggle />
                    </div>
                  </div>
                </header>
                <main className="flex-1">{children}</main>
                <footer className="border-t py-4">
                  <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} ECG Arrhythmia Classification System
                  </div>
                </footer>
              </div>
            </ModelProvider>
          </ECGDataProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}


import './globals.css'
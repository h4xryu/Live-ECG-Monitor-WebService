"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** The live view moved to the homepage ("/"). This just redirects old links/bookmarks there. */
export default function LiveRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/")
  }, [router])
  return null
}

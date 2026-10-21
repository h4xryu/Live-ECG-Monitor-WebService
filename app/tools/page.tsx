"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileUpload } from "@/components/file-upload"
import { ModelManager } from "@/components/model-manager"
import { ClassificationResults } from "@/components/classification-results"
import { HelpSection } from "@/components/help-section"
import { FullECGGridView } from "@/components/full-ecg-grid-view"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useECGData } from "@/context/ecg-data-context"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function Home() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const [activeTab, setActiveTab] = useState("upload")
  const { ecgData } = useECGData()

  // Add a loading state to handle data loading
  const [isLoading, setIsLoading] = useState(true)

  // Update the useEffect to handle async operations properly
  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  // Add this useEffect to handle data loading
  useEffect(() => {
    if (ecgData !== undefined) {
      // Add a small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [ecgData])

  // Handle tab change
  const handleTabChange = (value: string) => {
    // Only show loading when switching to visualization tab from upload
    if (value === "visualization" && activeTab === "upload" && ecgData?.rawData) {
      setIsLoading(true)

      // Add a small delay to ensure the loading state is visible
      setTimeout(() => {
        setIsLoading(false)
      }, 800)
    }

    setActiveTab(value)

    // Update URL without full page navigation
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    window.history.pushState({}, "", url)
  }

  // Update the return statement to show a loading indicator if needed
  return (
    <main className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">ECG Arrhythmia Classification</h1>
          <p className="text-muted-foreground">
            Upload ECG signals, detect R-peaks, and classify arrhythmias using pre-trained models
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="visualization">Full Grid View</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="help">Help</TabsTrigger>
          </TabsList>

          {isLoading && activeTab === "visualization" && (
            <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
              <div className="bg-card p-8 rounded-lg shadow-lg flex flex-col items-center">
                <LoadingSpinner size="lg" />
                <h3 className="mt-4 text-xl font-semibold">Loading...</h3>
                <p className="mt-2 text-muted-foreground">Preparing ECG data visualization</p>
              </div>
            </div>
          )}
          {!isLoading && (
            <>
              <TabsContent value="upload" className="py-4">
                <FileUpload />
              </TabsContent>
              <TabsContent value="visualization" className="py-4">
                <FullECGGridView key={`ecg-view-${ecgData?.fileName || "empty"}`} />
              </TabsContent>
              <TabsContent value="models" className="py-4">
                <ModelManager />
              </TabsContent>
              <TabsContent value="results" className="py-4">
                <ClassificationResults />
              </TabsContent>
              <TabsContent value="help" className="py-4">
                <HelpSection />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState, Fragment } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useData } from "@/contexts/data-context"
import {
SidebarProvider,
SidebarInset,
SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
Breadcrumb,
BreadcrumbItem,
BreadcrumbLink,
BreadcrumbList,
BreadcrumbPage,
BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Maximize, Minimize } from "lucide-react"

function getBreadcrumbs(pathname: string) {
const segments = pathname.split("/").filter(Boolean)
const breadcrumbs = []

for (let i = 0; i < segments.length; i++) {
const segment = segments[i]
const path = "/" + segments.slice(0, i + 1).join("/")
const isLast = i === segments.length - 1


}

return breadcrumbs
}

export default function DashboardLayout({
children,
}: {
children: React.ReactNode
}) {
const router = useRouter()
const pathname = usePathname()
const { user, loading: authLoading } = useAuth()
const { loading: dataLoading } = useData()

const [isFullscreen, setIsFullscreen] = useState(false)

const toggleFullscreen = () => {
if (!document.fullscreenElement) {
document.documentElement.requestFullscreen()
setIsFullscreen(true)
} else {
document.exitFullscreen()
setIsFullscreen(false)
}
}

// Sync state if user presses ESC
useEffect(() => {
const handler = () => {
setIsFullscreen(!!document.fullscreenElement)
}



}, [])

// Redirect if not authenticated
useEffect(() => {
if (!authLoading && !user) {
router.push("/login")
}
}, [user, authLoading, router])

if (authLoading || !user) {
return ( <div className="flex items-center justify-center min-h-screen bg-background"> <div className="flex flex-col items-center gap-4"> <Spinner className="w-8 h-8 text-primary" /> <p className="text-muted-foreground">Loading...</p> </div> </div>
)
}

const breadcrumbs = getBreadcrumbs(pathname)

return ( <SidebarProvider> <AppSidebar />

  <SidebarInset>
    <header className="flex h-14 items-center justify-between border-b bg-background px-4 sticky top-0 z-10">

      {/* LEFT SIDE */}
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.path}>
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.path}>
                      {crumb.title}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>

                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* RIGHT SIDE */}
      <button
        onClick={toggleFullscreen}
        className="p-2 rounded-md hover:bg-muted transition"
        title="Toggle Fullscreen"
      >
        {isFullscreen ? (
          <Minimize className="w-5 h-5" />
        ) : (
          <Maximize className="w-5 h-5" />
        )}
      </button>

    </header>

    <main className="flex-1 p-4 md:p-6">
      {dataLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner className="w-8 h-8 text-primary" />
        </div>
      ) : (
        children
      )}
    </main>
  </SidebarInset>
</SidebarProvider>


)
}

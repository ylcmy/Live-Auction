"use client"

import { useToast } from "@/design-system/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/design-system/components/ui/toast"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

type ToastVariant = "default" | "destructive" | "success" | "warning" | "info"

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: typeof Info; iconColor: string }> = {
  default: { container: "border-slate-200 bg-white text-slate-900", icon: Info, iconColor: "text-slate-500" },
  destructive: { container: "border-red-200 bg-red-50 text-red-900", icon: XCircle, iconColor: "text-red-500" },
  success: { container: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2, iconColor: "text-emerald-500" },
  warning: { container: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, iconColor: "text-amber-500" },
  info: { container: "border-sky-200 bg-sky-50 text-sky-900", icon: Info, iconColor: "text-sky-500" },
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const variant = (props.variant ?? "default") as ToastVariant
        const config = VARIANT_STYLES[variant] ?? VARIANT_STYLES.default
        const Icon = config.icon
        return (
          <Toast key={id} {...props} className={`${config.container} rounded-xl shadow-lg`}>
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle className="text-sm font-semibold">{title}</ToastTitle>}
                {description && (
                  <ToastDescription className="text-sm opacity-80">{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose className="opacity-60 hover:opacity-100" />
          </Toast>
        )
      })}
      <ToastViewport className="gap-3" />
    </ToastProvider>
  )
}

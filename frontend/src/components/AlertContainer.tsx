import { Alert, AlertDescription } from "./ui/alert"
import { useNotifyStore } from "../store/notifyStore"
import { ExclamationTriangleIcon, CheckCircledIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { useEffect } from "react"

const ALERT_TIMEOUT = 5000

type AlertIconProps = {
  severity: string;
  className: string;
}

const AlertIcon = ({ severity, className }: AlertIconProps) => {
  const icons = {
    error: <ExclamationTriangleIcon className={`${className} text-destructive`} />,
    success: <CheckCircledIcon className={`${className} text-green-500`} />,
    info: <InfoCircledIcon className={`${className} text-blue-500`} />
  }
  return icons[severity as keyof typeof icons] || icons.info
}

const getAlertStyles = (severity: string) => {
  const baseStyles = "animate-in slide-in-from-right duration-300 h-12"
  const severityStyles = {
    error: "bg-destructive/10",
    success: "bg-green-500/10",
    info: "bg-blue-500/10"
  }
  return `${baseStyles} ${severityStyles[severity as keyof typeof severityStyles] || ''}`
}

const AlertContainer = () => {
  const { notifications, removeNotification } = useNotifyStore()

  useEffect(() => {
    const timers = notifications.map(notification => 
      setTimeout(() => removeNotification(notification.id), ALERT_TIMEOUT)
    )
    return () => timers.forEach(clearTimeout)
  }, [notifications, removeNotification])

  if (!notifications.length) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2">
      {notifications.map(({ id, severity, message }) => (
        <Alert
          key={id}
          variant={severity === 'error' ? 'destructive' : 'default'}
          className={getAlertStyles(severity)}
        >
          <AlertIcon severity={severity} className="h-5 w-5" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

export default AlertContainer
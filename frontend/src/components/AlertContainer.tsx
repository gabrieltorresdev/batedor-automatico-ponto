import { Alert, AlertDescription, AlertTitle } from "./ui/alert"
import { useNotifyStore } from "../store/notifyStore"
import { ExclamationTriangleIcon, CheckCircledIcon, InfoCircledIcon } from "@radix-ui/react-icons"
import { useEffect } from "react"

const ALERT_TIMEOUT = 5000 // 5 seconds

const AlertContainer = () => {
    const { notifications, removeNotification } = useNotifyStore()

    useEffect(() => {
        notifications.forEach((notification) => {
            const timer = setTimeout(() => {
                removeNotification(notification.id)
            }, ALERT_TIMEOUT)

            return () => clearTimeout(timer)
        })
    }, [notifications, removeNotification])

    const getIcon = (severity: string) => {
        switch (severity) {
            case 'error':
                return <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
            case 'success':
                return <CheckCircledIcon className="h-5 w-5 text-green-500" />
            default:
                return <InfoCircledIcon className="h-5 w-5 text-blue-500" />
        }
    }

    if (notifications.length === 0) return null

    return (
        <div className="fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2">
            {notifications.map((notification) => (
                <Alert
                    key={notification.id}
                    variant={notification.severity === 'error' ? 'destructive' : 'default'}
                    className={`animate-in slide-in-from-right duration-300 h-12 ${
                        notification.severity === 'success' ? 'bg-green-500/10' : 
                        notification.severity === 'info' ? 'bg-blue-500/10' : ''
                    }`}
                >
                    {getIcon(notification.severity)}
                    <AlertDescription>
                        {notification.message}
                    </AlertDescription>
                </Alert>
            ))}
        </div>
    )
}

export default AlertContainer 
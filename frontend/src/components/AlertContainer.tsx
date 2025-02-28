import { Alert, AlertDescription } from "./ui/alert"
import { useNotifyStore } from "../store/notifyStore"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { useEffect } from "react"

const ALERT_TIMEOUT = 4000 // 4 seconds

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
                return <AlertCircle className="h-4 w-4 text-destructive" />
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-amber-500" />
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            default:
                return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    if (notifications.length === 0) return null

    return (
        <div className="fixed inset-x-4 bottom-16 md:bottom-4 z-50 flex flex-col gap-2 max-w-xs mx-auto left-0 right-0">
            <AnimatePresence>
                {notifications.map((notification) => (
                    <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Alert
                            variant={notification.severity === 'error' ? 'destructive' : 'default'}
                            className={`flex items-center py-2 px-3 shadow-md border-border/50 backdrop-blur-sm
                                ${notification.severity === 'success' ? 'bg-green-500/10 border-green-400/30 dark:border-green-700/40' : 
                                notification.severity === 'warning' ? 'bg-amber-500/10 border-amber-400/30 dark:border-amber-700/40' :
                                notification.severity === 'info' ? 'bg-blue-500/10 border-blue-400/30 dark:border-blue-700/40' : 
                                'bg-destructive/10 dark:bg-destructive/20'}`}
                        >
                            <div className="flex items-center gap-2">
                                {getIcon(notification.severity)}
                                <AlertDescription className="text-xs font-medium">
                                    {notification.message}
                                </AlertDescription>
                            </div>
                        </Alert>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    )
}

export default AlertContainer
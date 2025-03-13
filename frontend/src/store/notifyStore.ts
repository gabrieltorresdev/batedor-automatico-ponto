import { create } from 'zustand'

type NotifySeverity = 'error' | 'warning' | 'info' | 'success'

interface NotifyMessage {
    message: string
    severity: NotifySeverity
    id: string
    timestamp: number
}

interface NotifyStore {
    notifications: NotifyMessage[]
    addNotification: (message: string, severity: NotifySeverity) => void
    removeNotification: (id: string) => void
    clearNotifications: () => void
}

const MAX_NOTIFICATIONS = 3

export const useNotifyStore = create<NotifyStore>((set) => ({
    notifications: [],
    addNotification: (message, severity) => set((state) => {
        const newNotification = {
            message,
            severity,
            id: crypto.randomUUID(),
            timestamp: Date.now()
        };
        
        const updatedNotifications = [
            newNotification,
            ...state.notifications
        ].slice(0, MAX_NOTIFICATIONS);
        
        return { notifications: updatedNotifications };
    }),
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
    clearNotifications: () => set({ notifications: [] })
}))
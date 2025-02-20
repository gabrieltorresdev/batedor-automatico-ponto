import { create } from 'zustand'

type NotifySeverity = 'error' | 'warning' | 'info' | 'success'

interface NotifyMessage {
    message: string
    severity: NotifySeverity
    id: string
}

interface NotifyStore {
    notifications: NotifyMessage[]
    addNotification: (message: string, severity: NotifySeverity) => void
    removeNotification: (id: string) => void
    clearNotifications: () => void
}

export const useNotifyStore = create<NotifyStore>((set) => ({
    notifications: [],
    addNotification: (message, severity) => set((state) => ({
        notifications: [{
            message,
            severity,
            id: crypto.randomUUID()
        }]
    })),
    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((notification) => notification.id !== id)
    })),
    clearNotifications: () => set({ notifications: [] })
})) 
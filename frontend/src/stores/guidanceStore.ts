import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GuidanceState {
  dismissedGuidance: Set<string>
  dismissedNotifications: Set<string>
  userPreferences: {
    showGuidance: boolean
    showNotifications: boolean
  }
  dismissGuidance: (id: string) => void
  dismissNotification: (id: string) => void
  resetGuidance: () => void
  updatePreferences: (prefs: Partial<GuidanceState['userPreferences']>) => void
  isGuidanceDismissed: (id: string) => boolean
  isNotificationDismissed: (id: string) => boolean
}

export const useGuidanceStore = create<GuidanceState>()(
  persist(
    (set, get) => ({
      dismissedGuidance: new Set<string>(),
      dismissedNotifications: new Set<string>(),
      userPreferences: {
        showGuidance: true,
        showNotifications: true,
      },
      dismissGuidance: (id: string) =>
        set((state) => {
          // Ensure dismissedGuidance is a Set (handle case where it might be an array from persistence)
          const currentSet = state.dismissedGuidance instanceof Set 
            ? state.dismissedGuidance 
            : new Set(Array.isArray(state.dismissedGuidance) ? state.dismissedGuidance : [])
          const newSet = new Set(currentSet)
          newSet.add(id)
          return { dismissedGuidance: newSet }
        }),
      dismissNotification: (id: string) =>
        set((state) => {
          // Ensure dismissedNotifications is a Set (handle case where it might be an array from persistence)
          const currentSet = state.dismissedNotifications instanceof Set 
            ? state.dismissedNotifications 
            : new Set(Array.isArray(state.dismissedNotifications) ? state.dismissedNotifications : [])
          const newSet = new Set(currentSet)
          newSet.add(id)
          return { dismissedNotifications: newSet }
        }),
      resetGuidance: () =>
        set({
          dismissedGuidance: new Set(),
          dismissedNotifications: new Set(),
        }),
      updatePreferences: (prefs) =>
        set((state) => ({
          userPreferences: { ...state.userPreferences, ...prefs },
        })),
      isGuidanceDismissed: (id: string) => {
        const dismissed = get().dismissedGuidance
        // Handle both Set and Array (from persistence)
        if (dismissed instanceof Set) {
          return dismissed.has(id)
        } else if (Array.isArray(dismissed)) {
          return dismissed.includes(id)
        }
        return false
      },
      isNotificationDismissed: (id: string) => {
        const dismissed = get().dismissedNotifications
        // Handle both Set and Array (from persistence)
        if (dismissed instanceof Set) {
          return dismissed.has(id)
        } else if (Array.isArray(dismissed)) {
          return dismissed.includes(id)
        }
        return false
      },
    }),
    {
      name: 'guidance-storage',
      // Custom serialization to handle Sets
      partialize: (state) => ({
        dismissedGuidance: Array.from(state.dismissedGuidance),
        dismissedNotifications: Array.from(state.dismissedNotifications),
        userPreferences: state.userPreferences,
      }),
      // Custom deserialization to convert arrays back to Sets
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert arrays back to Sets after rehydration
          if (Array.isArray(state.dismissedGuidance)) {
            state.dismissedGuidance = new Set(state.dismissedGuidance)
          }
          if (Array.isArray(state.dismissedNotifications)) {
            state.dismissedNotifications = new Set(state.dismissedNotifications)
          }
        }
      },
    }
  )
)


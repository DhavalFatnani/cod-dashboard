import { useGuidanceStore } from '../stores/guidanceStore'
import { useUserStore } from '../stores/userStore'

export interface GuidanceConfig {
  id: string
  title: string
  message: string
  actionLabel?: string
  actionUrl?: string
  dismissible?: boolean
  priority?: 'low' | 'medium' | 'high'
  showForRoles?: string[]
  showForStates?: string[]
}

export function useGuidance(config: GuidanceConfig) {
  const { profile } = useUserStore()
  const {
    isGuidanceDismissed,
    dismissGuidance,
    userPreferences,
  } = useGuidanceStore()

  const shouldShow = (): boolean => {
    // Check if guidance is disabled
    if (!userPreferences.showGuidance) return false

    // Check if already dismissed
    if (isGuidanceDismissed(config.id)) return false

    // Check role filter
    if (config.showForRoles && profile?.role) {
      if (!config.showForRoles.includes(profile.role)) return false
    }

    return true
  }

  const dismiss = () => {
    dismissGuidance(config.id)
  }

  return {
    shouldShow: shouldShow(),
    dismiss,
    config,
  }
}


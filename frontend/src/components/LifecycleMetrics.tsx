interface LifecycleMetricsProps {
  selectedStage: string | null
  onFilterChange?: (filters: { money_state?: string; cod_type?: string; payment_type?: string }) => void
}

export default function LifecycleMetrics(_props: LifecycleMetricsProps) {
  // Component returns nothing - metrics removed as per user request
  return null
}

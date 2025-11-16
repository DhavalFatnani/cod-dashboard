export const MoneyState = {
  Uncollected: 'uncollected',
  CollectedUnbundled: 'collected_unbundled',
  Bundled: 'bundled',
  AcceptedByAsm: 'accepted_by_asm',
  InSuperbundle: 'in_superbundle',
  InDepositbundle: 'in_depositbundle',
  Deposited: 'deposited',
  Reconciled: 'reconciled',
} as const;

export type MoneyState = typeof MoneyState[keyof typeof MoneyState];

const allowedTransitions: Record<MoneyState, MoneyState[]> = {
  [MoneyState.Uncollected]: [MoneyState.CollectedUnbundled],
  [MoneyState.CollectedUnbundled]: [MoneyState.Bundled],
  [MoneyState.Bundled]: [MoneyState.AcceptedByAsm],
  [MoneyState.AcceptedByAsm]: [MoneyState.InSuperbundle],
  [MoneyState.InSuperbundle]: [MoneyState.InDepositbundle],
  [MoneyState.InDepositbundle]: [MoneyState.Deposited],
  [MoneyState.Deposited]: [MoneyState.Reconciled],
  [MoneyState.Reconciled]: [],
};

export function canTransition(from: MoneyState, to: MoneyState): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

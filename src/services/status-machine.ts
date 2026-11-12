import type { PaymentStatus } from '../schemas/payment';
import { IllegalTransitionError } from '../errors/app-error';

const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['succeeded', 'failed'],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export const CLIENT_STATUSES = ['cancelled'] as const satisfies readonly PaymentStatus[];

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (from === to) {
    return;
  }

  if (!canTransition(from, to)) {
    throw new IllegalTransitionError(from, to);
  }
}

export function isClientStatus(status: PaymentStatus): boolean {
  return (CLIENT_STATUSES as readonly PaymentStatus[]).includes(status);
}

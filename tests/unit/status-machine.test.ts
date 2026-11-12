import { IllegalTransitionError } from '../../src/errors/app-error';
import {
  assertTransition,
  canTransition,
  isClientStatus,
} from '../../src/services/status-machine';

describe('status machine', () => {
  it('allows pending to processing or cancelled', () => {
    expect(canTransition('pending', 'processing')).toBe(true);
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('pending', 'succeeded')).toBe(false);
  });

  it('allows processing to succeeded or failed', () => {
    expect(canTransition('processing', 'succeeded')).toBe(true);
    expect(canTransition('processing', 'failed')).toBe(true);
    expect(canTransition('processing', 'cancelled')).toBe(false);
  });

  it('rejects transitions out of terminal states', () => {
    expect(canTransition('succeeded', 'failed')).toBe(false);
    expect(canTransition('failed', 'pending')).toBe(false);
    expect(canTransition('cancelled', 'processing')).toBe(false);
  });

  it('treats same-status updates as no-ops', () => {
    expect(() => assertTransition('succeeded', 'succeeded')).not.toThrow();
  });

  it('throws on illegal transitions', () => {
    expect(() => assertTransition('succeeded', 'cancelled')).toThrow(
      IllegalTransitionError,
    );
  });

  it('only exposes cancelled as a client status', () => {
    expect(isClientStatus('cancelled')).toBe(true);
    expect(isClientStatus('succeeded')).toBe(false);
  });
});

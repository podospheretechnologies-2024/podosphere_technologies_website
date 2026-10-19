import { describe, it, expect, vi } from 'vitest';
import { HttpError } from '@/shared/server/http-error';
import {
  resolveAgencyApprovalTransition,
  resolvePortalApprovalTransition,
} from './approval-transitions';

vi.mock('server-only', () => ({}));

describe('resolveAgencyApprovalTransition', () => {
  it('submit_internal: draft or REJECTED → INTERNAL', () => {
    expect(resolveAgencyApprovalTransition(null, 'submit_internal')).toEqual({
      approvalStep: 'INTERNAL',
      error: null,
    });
    expect(resolveAgencyApprovalTransition('REJECTED', 'submit_internal')).toEqual({
      approvalStep: 'INTERNAL',
      error: null,
    });
  });

  it('submit_internal refuses an in-flight step', () => {
    expect(() => resolveAgencyApprovalTransition('INTERNAL', 'submit_internal')).toThrow(
      'Post is already in an approval step'
    );
    expect(() => resolveAgencyApprovalTransition('CLIENT', 'submit_internal')).toThrow(HttpError);
  });

  it('submit_client: draft / INTERNAL / REJECTED → CLIENT', () => {
    expect(resolveAgencyApprovalTransition(null, 'submit_client').approvalStep).toBe('CLIENT');
    expect(resolveAgencyApprovalTransition('INTERNAL', 'submit_client').approvalStep).toBe(
      'CLIENT'
    );
    expect(resolveAgencyApprovalTransition('REJECTED', 'submit_client').approvalStep).toBe(
      'CLIENT'
    );
  });

  it('submit_client refuses CLIENT or APPROVED', () => {
    expect(() => resolveAgencyApprovalTransition('CLIENT', 'submit_client')).toThrow(
      'Post is already waiting for the client or approved'
    );
    expect(() => resolveAgencyApprovalTransition('APPROVED', 'submit_client')).toThrow(HttpError);
  });

  it('approve: INTERNAL → CLIENT only', () => {
    expect(resolveAgencyApprovalTransition('INTERNAL', 'approve')).toEqual({
      approvalStep: 'CLIENT',
      error: null,
    });
    expect(() => resolveAgencyApprovalTransition('CLIENT', 'approve')).toThrow(
      'Only posts in internal review can be approved by the agency'
    );
  });

  it('reject: INTERNAL or CLIENT → REJECTED with a required reason', () => {
    expect(resolveAgencyApprovalTransition('INTERNAL', 'reject', ' needs edits ')).toEqual({
      approvalStep: 'REJECTED',
      error: 'needs edits',
    });
    expect(resolveAgencyApprovalTransition('CLIENT', 'reject', 'no')).toEqual({
      approvalStep: 'REJECTED',
      error: 'no',
    });
    expect(() => resolveAgencyApprovalTransition('INTERNAL', 'reject', '  ')).toThrow(
      'A rejection reason is required'
    );
    expect(() => resolveAgencyApprovalTransition(null, 'reject', 'x')).toThrow(
      'Only posts in review can be rejected'
    );
  });
});

describe('resolvePortalApprovalTransition', () => {
  it('approve → APPROVED and QUEUE', () => {
    expect(resolvePortalApprovalTransition('approve')).toEqual({
      approvalStep: 'APPROVED',
      state: 'QUEUE',
      error: null,
    });
  });

  it('reject → REJECTED with reason or default copy', () => {
    expect(resolvePortalApprovalTransition('reject', 'Please revise')).toEqual({
      approvalStep: 'REJECTED',
      error: 'Please revise',
    });
    expect(resolvePortalApprovalTransition('reject')).toEqual({
      approvalStep: 'REJECTED',
      error: 'Changes requested by client',
    });
  });
});

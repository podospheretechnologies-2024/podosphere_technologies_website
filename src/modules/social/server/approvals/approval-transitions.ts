import 'server-only';
import type { SocialApprovalStep } from '@/generated/prisma/client';
import { HttpError } from '@/shared/server/http-error';

export type AgencyApprovalAction = 'submit_internal' | 'submit_client' | 'approve' | 'reject';

export type AgencyApprovalResult = {
  approvalStep: SocialApprovalStep;
  error?: string | null;
};

export type PortalApprovalResult = {
  approvalStep: 'APPROVED' | 'REJECTED';
  state?: 'QUEUE';
  error?: string | null;
};

/**
 * Pure agency approval state machine (draft group already loaded + authorize).
 * Mirrors `approvalService.agencyAction` transition rules.
 */
export function resolveAgencyApprovalTransition(
  step: SocialApprovalStep | null,
  action: AgencyApprovalAction,
  reason?: string
): AgencyApprovalResult {
  if (action === 'submit_internal') {
    if (step !== null && step !== 'REJECTED') {
      throw new HttpError(400, 'Post is already in an approval step');
    }
    return { approvalStep: 'INTERNAL', error: null };
  }

  if (action === 'submit_client') {
    if (step === 'CLIENT' || step === 'APPROVED') {
      throw new HttpError(400, 'Post is already waiting for the client or approved');
    }
    return { approvalStep: 'CLIENT', error: null };
  }

  if (action === 'approve') {
    if (step !== 'INTERNAL') {
      throw new HttpError(400, 'Only posts in internal review can be approved by the agency');
    }
    return { approvalStep: 'CLIENT', error: null };
  }

  if (action === 'reject') {
    if (step !== 'INTERNAL' && step !== 'CLIENT') {
      throw new HttpError(400, 'Only posts in review can be rejected');
    }
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new HttpError(400, 'A rejection reason is required');
    }
    return { approvalStep: 'REJECTED', error: trimmed };
  }

  throw new HttpError(400, 'Unknown approval action');
}

/**
 * Pure client-portal decide transitions (post already confirmed at CLIENT step).
 */
export function resolvePortalApprovalTransition(
  action: 'approve' | 'reject',
  reason?: string
): PortalApprovalResult {
  if (action === 'approve') {
    return { approvalStep: 'APPROVED', state: 'QUEUE', error: null };
  }
  const trimmed = reason?.trim() || 'Changes requested by client';
  return { approvalStep: 'REJECTED', error: trimmed };
}

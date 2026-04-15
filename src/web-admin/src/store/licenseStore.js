/**
 * License Store (Zustand)
 *
 * Manages license request state for both user-facing and admin views.
 */

import { create } from 'zustand';
import {
  createLicenseRequest,
  getUserLicenseRequests,
  getAllLicenseRequests,
  approveLicenseRequest,
  rejectLicenseRequest,
  getPendingCount,
} from '../services/licenseService';

export const useLicenseStore = create((set, get) => ({
  // ── User state ──────────────────────────────────────────────────────────────
  /** Array of the current user's license requests */
  myRequests: [],
  myRequestsLoading: false,
  myRequestsError: null,

  // ── Admin state ─────────────────────────────────────────────────────────────
  /** All license requests (admin view) */
  allRequests: [],
  allRequestsLoading: false,
  allRequestsError: null,

  /** Count of pending requests for sidebar badge */
  pendingCount: 0,

  // ── Submission state ────────────────────────────────────────────────────────
  submitting: false,
  submitError: null,

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Fetch the current user's license requests */
  fetchMyRequests: async (userId) => {
    set({ myRequestsLoading: true, myRequestsError: null });
    try {
      const requests = await getUserLicenseRequests(userId);
      set({ myRequests: requests, myRequestsLoading: false });
    } catch (err) {
      set({ myRequestsError: err.message, myRequestsLoading: false });
    }
  },

  /** Submit a new license request */
  submitRequest: async (data) => {
    set({ submitting: true, submitError: null });
    try {
      const id = await createLicenseRequest(data);
      // Refresh user's requests
      await get().fetchMyRequests(data.userId);
      set({ submitting: false });
      return id;
    } catch (err) {
      set({ submitError: err.message, submitting: false });
      throw err;
    }
  },

  /** Fetch all requests (admin) */
  fetchAllRequests: async () => {
    set({ allRequestsLoading: true, allRequestsError: null });
    try {
      const requests = await getAllLicenseRequests();
      set({ allRequests: requests, allRequestsLoading: false });
    } catch (err) {
      set({ allRequestsError: err.message, allRequestsLoading: false });
    }
  },

  /** Admin approves a request and generates JWT */
  approveRequest: async ({ requestId, adminEmail, tier, durationDays, userId, email }) => {
    const jwt = await approveLicenseRequest({ requestId, adminEmail, tier, durationDays, userId, email });
    // Update local state immediately
    set((state) => ({
      allRequests: state.allRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'approved', approvedTier: tier, jwt, approvedBy: adminEmail }
          : r,
      ),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
    return jwt;
  },

  /** Admin rejects a request */
  rejectRequest: async ({ requestId, adminEmail, reason }) => {
    await rejectLicenseRequest({ requestId, adminEmail, reason });
    set((state) => ({
      allRequests: state.allRequests.map((r) =>
        r.id === requestId
          ? { ...r, status: 'rejected', rejectedBy: adminEmail }
          : r,
      ),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }));
  },

  /** Fetch count of pending requests */
  fetchPendingCount: async () => {
    try {
      const count = await getPendingCount();
      set({ pendingCount: count });
    } catch {
      // Silently ignore
    }
  },
}));

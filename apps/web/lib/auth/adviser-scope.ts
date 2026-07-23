/**
 * Per-adviser data scoping helpers (Advisor Access Plan).
 * When canViewAllClients is OFF, advisers only see records linked to them
 * via Case.assignedAdviserId or Client.assignedMember.userId.
 */

export function isRestrictedAdviser(
  user: { role?: string | null; canViewAllClients?: boolean | null } | null | undefined,
): boolean {
  return user?.role === 'ADVISER' && !user.canViewAllClients;
}

/** Cases the adviser may see: assigned on the case, or on the linked client. */
export function caseAssignedToAdviserWhere(adviserUserId: string) {
  return {
    OR: [
      { assignedAdviserId: adviserUserId },
      { client: { assignedMember: { userId: adviserUserId } } },
    ],
  };
}

/** Clients the adviser may see: member assignment or any case assigned to them. */
export function clientAssignedToAdviserWhere(adviserUserId: string) {
  return {
    OR: [
      { assignedMember: { userId: adviserUserId } },
      { cases: { some: { assignedAdviserId: adviserUserId } } },
    ],
  };
}

/** Messages linked to an assigned client or assigned case. */
export function messageAssignedToAdviserWhere(adviserUserId: string) {
  return {
    OR: [
      { client: { assignedMember: { userId: adviserUserId } } },
      { client: { cases: { some: { assignedAdviserId: adviserUserId } } } },
      { case: { assignedAdviserId: adviserUserId } },
      { case: { client: { assignedMember: { userId: adviserUserId } } } },
    ],
  };
}

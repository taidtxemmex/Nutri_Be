import { UserRole } from '../../config/enums/role.enum';

/**
 * Standard User Context interface representing the currently authenticated user
 * performing an action in the system.
 *
 * Adheres to Universal DRY Code Law and SSOT (Single Source of Truth).
 */
export interface UserContext {
  id: string;
  role?: UserRole | string;
}

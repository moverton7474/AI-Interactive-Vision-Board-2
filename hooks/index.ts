/**
 * Hooks Index
 *
 * Export all custom hooks from a single location
 */

export {
  useAuthz,
  NoAccessMessage,
  RequireRole,
  type PlatformRole,
  type TeamRole,
  type TeamMembership,
  type Goal,
  type UseAuthzReturn,
  type NoAccessProps,
  type RequireRoleProps
} from './useAuthz';

export {
  useLandingHeroVideos,
  type VideoSource,
  type JourneyKey,
  type LandingHeroVideosConfig
} from './useLandingHeroVideos';

export {
  useEntitlementPolling
} from './useEntitlementPolling';

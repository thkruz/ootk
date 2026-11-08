/**
 * @author Theodore Kruczek
 * @license AGPL-3.0-or-later
 * @copyright (c) 2025-2026 Kruczek Labs LLC
 */

export { atmosphericLossModel } from './AtmosphericLossModel';
export type { AtmosphericLossParams, SurfaceMeteorology } from './AtmosphericLossModel';

export { P618_MAX_GHZ, P618_MIN_GHZ, rainAttenuation, totalAttenuation } from './P618RainAttenuation';
export type {
  RainAttenuationParams, RainAttenuationResult, TotalAttenuationParams,
} from './P618RainAttenuation';

export {
  gasInstantaneousAttenuation, gasSlantAttenuation, gasSpecificAttenuation, P676_ANNEX2_MAX_GHZ, P676_MAX_GHZ, P676_MIN_GHZ,
} from './P676GasAttenuation';
export type { GasInstantaneousParams, GasSlantOptions, GasSpecificAttenuation } from './P676GasAttenuation';

export { P835_TOP_KM, referenceAtmosphere } from './P835ReferenceAtmosphere';
export type { ReferenceAtmosphereState } from './P835ReferenceAtmosphere';

export { P838_MAX_GHZ, P838_MIN_GHZ, rainCoefficients, rainSpecificAttenuation } from './P838RainCoefficients';
export type { RainCoefficients } from './P838RainCoefficients';

export { P839_RAIN_HEIGHT_OFFSET_KM, rainHeightFromIsotherm, rainHeightFromLatitude } from './P839RainHeight';

export {
  cloudAttenuation, cloudMassAbsorptionCoefficient, cloudSpecificAttenuationCoefficient, P840_MAX_GHZ, P840_MIN_ELEVATION_DEG,
  P840_MIN_GHZ, waterPermittivity,
} from './P840CloudAttenuation';
export type { CloudAttenuationParams, WaterPermittivity } from './P840CloudAttenuation';

/**
 * relativity.js — Relativistic "when" calculations for the solar system.
 *
 * All numbers are correct to the level of precision meaningful for a
 * K6 telephone box navigating the geocentric orrery.
 *
 * Sources: MTW §26.1, Shapiro (1964), USNO Circular 179 §2.6.
 */

// Physical constants
const C      = 299792458;            // m/s
const AU_M   = 1.495978707e11;       // metres per AU (IAU 2012)
const GM_SUN = 1.32712440018e20;     // m³/s² (TCB-compatible)
const R_EARTH_AU = 1.0;              // Earth is our reference

// 2GM/c³ — the "Sun's gravitational time unit"
const SHAPIRO_K = 2 * GM_SUN / (C ** 3);   // ≈ 9.852 μs

// Standard gravitational parameters (m³/s²) per body
const GM = {
  moon   : 4.9048695e12,
  mercury: 2.2032e13,
  venus  : 3.24859e14,
  earth  : 3.986004418e14,   // reference; used only for cancellation
  mars   : 4.282837e13,
  jupiter: 1.26686534e17,
  saturn : 3.7931187e16,
  uranus : 5.793987e15,
  neptune: 6.836529e15,
  pluto  : 8.71e11,
  sun    : GM_SUN,
};

// Mean surface / cloud-top radii (m)
const R_SURFACE = {
  moon   : 1.7374e6,
  mercury: 2.4397e6,
  venus  : 6.0518e6,
  earth  : 6.3781e6,
  mars   : 3.3895e6,
  jupiter: 7.1492e7,
  saturn : 6.0268e7,
  uranus : 2.5559e7,
  neptune: 2.4764e7,
  pluto  : 1.188e6,
  sun    : 6.957e8,
};

/**
 * Light travel time from Earth to a body at `distAU` AU.
 * @returns seconds
 */
export function lightTravelTime(distAU) {
  return (distAU * AU_M) / C;
}

/**
 * Shapiro delay — extra travel time for light passing near the Sun.
 *
 * Δt = (2GM/c³) · ln( (r_e + r_p + d) / (r_e + r_p - d) )
 *
 * where r_e = Earth–Sun dist (AU), r_p = body–Sun dist (AU), d = Earth–body dist (AU).
 * We use r_e = 1, and approximate r_p from the body's heliocentric distance if given,
 * otherwise fall back to `distAU` as a lower bound.
 *
 * @param {number} distAU        Earth–body distance (AU)
 * @param {number} bodyHelioAU   body–Sun distance (AU); defaults to distAU if unknown
 * @returns seconds of extra delay
 */
export function shapiroDelay(distAU, bodyHelioAU) {
  const re = R_EARTH_AU;
  const rp = bodyHelioAU ?? distAU;
  const d  = distAU;
  // Guard: at conjunction (body behind Sun) the argument can be ≤ 0; clamp it.
  const arg = (re + rp + d) / Math.max(re + rp - d, 1e-6);
  return SHAPIRO_K * Math.log(arg);
}

/**
 * Gravitational time dilation rate relative to Earth.
 * Positive → clocks at body run FASTER than on Earth (body is farther from Sun).
 * Negative → clocks at body run SLOWER (body is closer to Sun).
 *
 * Δf/f ≈ (GM/c²) · (1/r_earth − 1/r_body)
 *
 * @param {number} bodyHelioAU   body–Sun heliocentric distance in AU
 * @returns dimensionless (fractional rate difference; multiply by 1e9 for ppb)
 */
export function gravTimeDilation(bodyHelioAU) {
  const rs     = GM_SUN / (C ** 2);        // Schwarzschild radius / 2 ≈ 1477 m
  const r_e    = R_EARTH_AU * AU_M;
  const r_b    = bodyHelioAU * AU_M;
  return rs * (1 / r_e - 1 / r_b);
}

/**
 * Gravitational time dilation from the planet's own surface gravity,
 * relative to Earth's surface.
 *
 * Δf/f = (GM_body / (R_body × c²)) − (GM_earth / (R_earth × c²))
 * Positive → clocks run FASTER (weaker gravity than Earth).
 * Negative → clocks run SLOWER (stronger gravity).
 *
 * @param {string} bodyKey  — key in GM / R_SURFACE tables
 * @returns dimensionless fraction
 */
export function planetSurfaceDilation(bodyKey) {
  const key = bodyKey.toLowerCase();
  const gm  = GM[key];
  const rs  = R_SURFACE[key];
  if (!gm || !rs) return 0;
  const gmC2 = C ** 2;
  const bodyPotential  = gm / (rs * gmC2);
  const earthPotential = GM.earth / (R_SURFACE.earth * gmC2);
  return earthPotential - bodyPotential;   // positive = body clocks faster than Earth
}

/**
 * Gravitational lensing data for a body.
 *
 * Einstein ring angular radius for a source at infinity:
 *   θ_E = sqrt(4GM / (c² × D_L))      [radians]
 *
 * Limb deflection:
 *   α = 4GM / (c² × R_surface)        [radians]
 *
 * @param {string} bodyKey
 * @param {number} distAU   distance from the observer (Earth) to the body in AU
 * @returns {{
 *   einsteinRing_mas : number,   // Einstein ring radius in milli-arcseconds (D_src = ∞)
 *   limbDeflection_as: number,   // deflection at limb in arcseconds
 *   display: { einsteinRing: string, limbDeflection: string }
 * }}
 */
export function lensingData(bodyKey, distAU) {
  const key = bodyKey.toLowerCase();
  const gm  = GM[key];
  const rs  = R_SURFACE[key];
  if (!gm || !rs) return null;

  const D_L = distAU * AU_M;   // distance to lens in metres

  // Einstein radius (source at infinity, source behind lens on same line)
  const thetaE_rad  = Math.sqrt(4 * gm / (C ** 2 * D_L));
  const thetaE_mas  = thetaE_rad * (180 / Math.PI) * 3600 * 1000;

  // Deflection at the body's limb
  const alpha_rad   = 4 * gm / (C ** 2 * rs);
  const alpha_as    = alpha_rad * (180 / Math.PI) * 3600;

  function fmtAngle(as) {
    if (as >= 1)   return `${as.toFixed(3)} ″`;
    if (as >= 0.001) return `${(as * 1000).toFixed(2)} mas`;
    return `${(as * 1e6).toFixed(2)} μas`;
  }

  return {
    einsteinRing_mas : thetaE_mas,
    limbDeflection_as: alpha_as,
    display: {
      einsteinRing  : fmtAngle(thetaE_mas / 1000),
      limbDeflection: fmtAngle(alpha_as),
    },
  };
}

/**
 * Compute the full relativistic "when" packet for a solar system body.
 *
 * @param {number} distAU        Earth–body distance in AU
 * @param {number} bodyHelioAU   body–Sun heliocentric distance in AU
 * @param {string} [bodyKey]     body key for surface-gravity and lensing calculations
 * @returns {{
 *   lightDelay_s   : number,  // light travel time, seconds
 *   shapiro_s      : number,  // Shapiro delay, seconds
 *   totalDelay_s   : number,  // light + Shapiro, seconds
 *   gravDilation   : number,  // fractional rate vs Earth (dimensionless)
 *   gravDilation_ppb: number, // same in parts-per-billion
 *   clockDrift_us_d : number, // μs/day clock drift relative to Earth
 *   display: {
 *     lightDelay : string,   // "8.3 min"
 *     shapiro    : string,   // "+240 μs"
 *     gravRate   : string,   // "+8.0 ppb" or "−15.6 ppb"
 *     drift      : string,   // "+0.69 μs/day"
 *     totalOffset: string,   // "−8.3 min + 240 μs (Shapiro)"
 *   }
 * }}
 */
export function relativisticWhen(distAU, bodyHelioAU, bodyKey) {
  const lt          = lightTravelTime(distAU);
  const shap        = shapiroDelay(distAU, bodyHelioAU);
  const solarGrav   = gravTimeDilation(bodyHelioAU);
  const surfGrav    = bodyKey ? planetSurfaceDilation(bodyKey) : 0;
  const totalGrav   = solarGrav + surfGrav;
  const gravPpb     = totalGrav * 1e9;
  const driftUsDay  = totalGrav * 86400 * 1e6;
  const lens        = bodyKey ? lensingData(bodyKey, distAU) : null;

  // ── Formatters ────────────────────────────────────────────────────
  function fmtDelay(s) {
    if (s < 1)  return `${(s * 1000).toFixed(1)} ms`;
    if (s < 60) return `${s.toFixed(1)} s`;
    return `${(s / 60).toFixed(2)} min`;
  }
  function fmtUs(s) {
    const us = s * 1e6;
    if (Math.abs(us) < 1000) return `${us.toFixed(0)} μs`;
    return `${(us / 1000).toFixed(2)} ms`;
  }
  function fmtPpb(v) {
    const sign = v >= 0 ? '+' : '−';
    return `${sign}${Math.abs(v).toFixed(1)} ppb`;
  }
  function fmtDrift(us) {
    const sign = us >= 0 ? '+' : '−';
    return `${sign}${Math.abs(us).toFixed(2)} μs/day`;
  }

  return {
    lightDelay_s     : lt,
    shapiro_s        : shap,
    totalDelay_s     : lt + shap,
    solarGrav        : solarGrav,
    surfaceGrav      : surfGrav,
    totalGrav,
    gravDilation_ppb : gravPpb,
    clockDrift_us_d  : driftUsDay,
    lensing          : lens,
    display: {
      lightDelay     : fmtDelay(lt),
      shapiro        : '+' + fmtUs(shap),
      gravRate       : fmtPpb(gravPpb),
      solarGrav      : fmtPpb(solarGrav * 1e9),
      surfaceGrav    : fmtPpb(surfGrav * 1e9),
      drift          : fmtDrift(driftUsDay),
      totalOffset    : `−${fmtDelay(lt)} · Shapiro +${fmtUs(shap)}`,
      lensRing       : lens ? lens.display.einsteinRing   : '—',
      lensDeflection : lens ? lens.display.limbDeflection : '—',
    },
  };
}

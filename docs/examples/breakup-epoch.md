# Breakup Epoch Estimation

This example estimates when a satellite broke up from nothing but its fragments' element sets. Every fragment leaves the parent from one point at one instant, so at the event epoch all fragment orbit planes pass through the parent's radius vector. Afterwards, J2 nodal regression (a function of each fragment's own a, e and i) fans the planes out. Carrying each fragment's RAAN back with its own secular J2 rate, the spread of the planes reaches a minimum near the event epoch. Use it to date a fragmentation from a debris catalog and to place it on the ground track of the parent.

<<< ../../examples/breakup-epoch.ts#imports

## Run it

```bash
npm run build
npx tsx ./examples/breakup-epoch.ts
```

## Synthetic fragment cloud

The script builds a known answer: one parent state, 60 random 50 m/s kicks, and each fragment's mean elements carried 90 days forward with `j2SecularRates`, the same secular model the estimator uses. `fragmentDispersionStats` summarizes the cloud at a common epoch (the latest fragment epoch by default): the RAAN spread and how fast the planes fan out.

<<< ../../examples/breakup-epoch.ts#synthetic-cloud

## Estimating the epoch

`estimateBreakupEpoch` accepts TLE lines (or `Tle` instances), `ClassicalElements`, or plain mean elements. The search window ends at the earliest fragment epoch (the event cannot be later) and reaches back `lookbackDays` (default 30, capped at 730). The spread is evaluated on a coarse grid (default window / 2000, between 1 minute and 6 hours), the global minimum is polished with a golden-section search, and the uncertainty combines a bootstrap over the fragments with a cross-check against a second metric. RAAN is carried back with the closed-form secular rate rather than SGP4: the plane orientation is all the method needs, and one multiply-add per fragment per trial keeps a 500-fragment search well under 100 ms.

<<< ../../examples/breakup-epoch.ts#estimate

### Spread metrics

- `plane` (default): the RMS angle between the fragment orbit planes and the best common line through the Earth's centre (the smallest eigenvalue of the mean outer product of the plane normals). In the secular model it is exactly zero at the event. A small along-line term (`alongLineWeight`, default 0.003) keeps a usable minimum when the breakup happened near the orbit's highest or lowest latitude, where RAAN drift alone turns the planes about the common line.
- `raan`: the circular standard deviation of RAAN. It is simpler, but a cross-track kick changes both RAAN and inclination, so the initial RAAN offsets correlate with the drift rates and the minimum is biased. The bias does not shrink with the age of the elements: in synthetic LEO clouds it is 1.5 to 3 days whether the cloud is 20 or 400 days old.

### Quality flags

| Quality | Reason | Meaning |
| ------- | ------ | ------- |
| `none` | `too-few-fragments` | Fewer than 3 usable element sets. No epoch. |
| `none` | `indistinguishable-drift-rates` | The fragments' RAAN rates are (nearly) identical, so the planes never converge. No epoch. |
| `weak` | `few-fragments` | Fewer than 10 fragments. |
| `weak` | `minimum-at-window-edge` | The minimum is at the window edge; the event may lie outside the window. Widen `lookbackDays`. |
| `weak` | `flat-valley` | The spread barely changes across the window. |
| `weak` | `large-uncertainty` | The 1-sigma uncertainty exceeds 3 days (`maxGoodUncertaintySec`). |
| `weak` | `old-elements` | The median element epoch is more than 180 days after the estimate (`oldElementsDays`). |

## Locating the breakup

`breakupLocationAtEpoch` propagates the parent to the estimated epoch and converts to geodetic coordinates with `J2000.toITRF().toGeodetic()`. TLE input goes through SGP4; classical or plain mean elements are carried with the secular J2 rates.

<<< ../../examples/breakup-epoch.ts#location

## Real TLEs: Cosmos 1408

The ootk SGP4 test fixture holds a 2022 catalog snapshot that includes over a thousand Cosmos 1408 fragments from the 2021-11-15 ASAT test. Their TLEs are up to 9 months old relative to the event, so drag has lowered many orbits. The default drag filter drops fragments whose mean-motion derivative exceeds 5e-4 rev/day^2, the default drag model adds the quadratic RAAN term from that derivative for the rest, and the default `trimFraction` of 0.1 drops the planes farthest from the cloud.

<<< ../../examples/breakup-epoch.ts#real-tles

## Assumptions and limits

- Secular J2 only. No drag beyond the optional ndot term, no third-body or higher zonal effects, no SGP4 short-periodic terms.
- Element sets lose information with age: drag changes a (and so the drift rate) differently for every fragment. The method works best within weeks of the event; months later it still finds the right month, flagged `old-elements`.
- The bootstrap measures the statistical scatter. Model error (drag, mis-associated objects) shows up only through the metric cross-check, so treat `weak` estimates as a starting point for a closer look.
- Leave the parent out of the fragment list; it did not receive a kick like the fragments.

## Output

```txt
Fragments: 60, RAAN spread now: 5.72 deg
RAAN rate spread: 0.0626 deg/day

=== Estimate (synthetic) ===
Epoch:       2021-11-15T02:36:14.012Z
True epoch:  2021-11-15T02:47:00.000Z
1-sigma:     0.18 h
Spread:      0.0167 deg at the minimum, 0.3498 deg now
Quality:     good

=== Parent at the estimated epoch ===
Lat -11.28 deg, lon 35.33 deg, alt 472.1 km (secular-j2)

=== Estimate (Cosmos 1408 debris, TLEs up to 2022-08) ===
Fragments:   180 used, 840 dropped by the drag filter, 20 trimmed
Epoch:       2021-11-15T06:40:56.886Z (event: 2021-11-15T02:47Z)
1-sigma:     1.91 days
Quality:     weak old-elements
```

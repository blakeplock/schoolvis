# Dependency Register and Licensing

## Required policy

Only **Apache-2.0** or **MIT** for all direct, transitive, optional, build, and development dependencies. No GPL-family, MPL, source-available, proprietary, unknown, or ambiguous licenses.

## v0.1 approved inventory

| Component | License | Notes |
|---|---|---|
| SchoolVis source | Apache-2.0 | `LICENSE` and SPDX headers |
| Node.js built-in modules | Node.js distribution | No third-party npm module; Node itself is distributed under the MIT license, with separately licensed bundled third-party components; review deployment distribution when bundling |
| Browser platform APIs | N/A | Native features, no package dependency |

**npm direct dependencies: 0 · npm transitive dependencies: 0.** No third-party JS, CSS, fonts, SDKs, icon sets, or telemetry are loaded.

## Procedure for adding a dependency

1. Confirm necessity; prefer Node/browser built-ins.
2. Pin the exact version in the lockfile and inspect lockfile-integrity hashes.
3. Inspect upstream source license and distributable/bundled licenses for that exact release; do not accept registry metadata as sufficient proof.
4. Traverse full transitive dependency inventory, including optional/install-time packages.
5. Accept only MIT or Apache-2.0; document the exact name/version/license and source evidence here and in `package.json` license attestations.
6. Re-run the license gate, npm audit, checks, and security review.
7. For GitHub Actions, review action licenses and pin immutable commit SHAs.

The automated license script is a gate, not a substitute for legal or security review. An attestation in `package.json` is only as trustworthy as its review.

# Sprout Hollow Valley roadmap

Updated: 2026-09-18

This roadmap records factual delivery state. A checked item is evidence-backed; an
unchecked item remains work, even when the surrounding source has been implemented.

## Release recovery: version 1.2.12

- [x] Repair the installed 3D Farm renderer's catalogue-validation failure.
- [x] Repair the later startup starvation caused by the settings language-preview refresh
  loop.
- [x] Merge the renderer recovery into the `1.2.12` source candidate.
- [x] Build and headlessly launch a local unsigned `1.2.12` Squirrel installer with a
  complete Farm canvas, HUD, startup-log load record, and no recorded renderer error.
- [ ] Run the complete current local validation inventory against the final release commit.
- [x] Build and inspect the published installer and update assets, including sizes,
  hashes, packaged icon sizes, and unsigned state.
- [x] Publish exactly one immutable `v1.2.12` release with verified Squirrel assets and
  download proof.
- [x] Confirm the source candidate CI/Pages runs and the successful `v1.2.12` release
  workflow run at tag target `941c922a45c4658a34b321bdcdadd468e15633ef`.

## Runtime evidence

- [x] Define all 700 authored structure exterior placements and their interior mappings.
- [x] Implement persistent estate farming, orchards, factory production, NPC life state,
  sanitation, and versioned 3D save data.
- [x] Capture a real installed Farm surface after the renderer recovery.
- [ ] Drive the installed application through every structure, room, door, station,
  sanitation route, estate plot, factory queue, NPC interaction, and save/reload path.
- [ ] Record deterministic long-run and performance evidence for the authored world.
- [ ] Add stable installed-artifact automation for those interactions rather than relying
  on source-only checks or a single launch.

## Landing page and documentation

- [x] Keep the GitHub Pages site explicitly non-playable and link it to genuine Farm
  captures.
- [x] Restore the current landing capture gallery and palette contract.
- [ ] Reconcile every row in `docs/VALLEY-COMPLETENESS.md` with an implementation link,
  documentation article, localization, test, packaged-artifact interaction, and real
  capture.
- [ ] Refresh the release capture matrix for every user-facing destination, setting,
  editor, dialog, empty state, failure state, narrow layout, and light/dark appearance.

## Fresh-machine and release tooling

- [x] Keep Squirrel.Windows packaging unsigned and preserve the application's packaged
  icon.
- [ ] Prove `download-dependencies.bat`, `build.bat`, `build-installer.bat`, and `run.bat`
  on a fresh Windows environment with their silent-mode contracts.
- [ ] Verify installer provenance, hashes, unsigned state, and update assets in the batch
  scripts themselves, not only in release automation.

## Repository closure conditions

- [x] Re-inventory all branches, linked working trees, stashes, tags, releases, and
  divergence immediately before closure. On 2026-09-18, the primary checkout had
  only `main`, no linked working trees, no stashes, and no conflict state. `main`
  and `origin/main` were both `c562aa31e4bea7865d9df6ffee0ea8dfdaf9da50`.
  `upstream/main` was fetched but retained as a separate diverged lineage at
  `e6f317a9c9cefc4e80dcd31749834ae1d2b38a46` with a `132 18` split.
- [ ] Integrate every completed lane into `main`, preserve any unmerged work, and prove
  each retained source commit is present on the published `main`.
- [ ] Perform irreversible branch, working-tree, and stash cleanup only after final
  release and ancestry proof plus current explicit user authorization.

## Primary Oak Kay closeout, 2026-09-18

- [x] Verify that no linked working tree, stash, unmerged index entry, conflict
  marker, or recoverable local file requires a preservation commit.
- [x] Verify the current `main` ref on the origin with `git ls-remote`.
- [x] Preserve the fetched upstream divergence without merging unrelated source
  lineage into the primary repository.
- [ ] Create an external archive before any future removal. This remains
  pending because this inventory identified no removal candidate.
- [ ] Remove only proven redundant linked working trees, branches, or stashes in a
  future closeout after archive, ownership, ancestry, and remote-ref proof.

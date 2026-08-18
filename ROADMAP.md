# Sprout Hollow Valley roadmap

Updated: 2026-08-18

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
- [ ] Rebuild and inspect the final installer, update packages, icon sizes, hashes, and
  unsigned state from that exact commit.
- [ ] Publish one new immutable `v1.2.12` release with its verified Squirrel assets,
  release notes, line-count evidence, required metadata, and download proof.
- [ ] Confirm the final `main` CI result and release workflow result for the published tag.

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

- [ ] Re-inventory all branches, linked working trees, stashes, tags, releases, and
  divergence immediately before closure.
- [ ] Integrate every completed lane into `main`, preserve any unmerged work, and prove
  each retained source commit is present on the published `main`.
- [ ] Perform irreversible branch, working-tree, and stash cleanup only after final
  release and ancestry proof plus current explicit user authorization.

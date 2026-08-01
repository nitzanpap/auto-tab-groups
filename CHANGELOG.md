# Changelog

All notable changes to Auto Tab Groups are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Releases before 3.5.2 predate this file; see the
[commit history](https://github.com/nitzanpap/auto-tab-groups/commits/master)
for those.

## [Unreleased]

## [3.13.0]

### Added

- "Move tab to its group's window", from the right-click menu or an (unassigned)
  keyboard shortcut. Sends a tab to the window where its group already lives,
  for people who keep windows roughly by topic. Grouping still never moves tabs
  between windows on its own ([#90], closes [#68]).

## [3.12.0]

### Added

- Optional "wait until I view a new tab before grouping it". Off by default.
  When on, a tab opened in the background from another tab stays next to the
  tab it came from until you switch to it, instead of being filed away before
  you have seen it. Foreground tabs, tabs with no opener, and the "Group Tabs"
  button are unaffected ([#89], addresses [#68] / [#88]).

## [3.11.0]

### Added

- Rules can match query strings. A pattern containing `?` is matched against
  the query as well as the host and path, so tabs on one domain can be split by
  a parameter — `domain.cz/?ticket={ticket}` puts each ticket in its own group,
  and a regex capture does the same. Patterns written before this behave
  exactly as they did ([#87], closes [#27]).

## [3.10.0]

### Added

- Keyboard shortcuts for turning auto-grouping on or off, grouping all tabs,
  ungrouping all tabs, and collapsing or expanding every group. No keys are
  assigned by default — installing takes none of your existing shortcuts, and
  nothing fires until you assign keys in the browser's own shortcut settings.
  Advanced → Keyboard shortcuts opens that page ([#86], closes [#25]).

## [3.9.1]

### Fixed

- The first-run setup could fire long after install. Storage stays empty until
  you change a setting, and the browser shuts down idle service workers — so a
  later restart looked like a fresh install and excluded whatever groups existed
  by then, including ones the extension had created itself. Auto-grouping then
  silently stopped managing them ([#84]).

## [3.9.0]

### Added

- Groups can be excluded from auto-grouping. Right-click a tab to exclude its
  group; the popup and sidebar list every exclusion and let you remove one.
  Groups that already exist when the extension is first installed are excluded
  automatically, so installing no longer dissolves organization you built by
  hand ([#82], closes [#23]).

## [3.8.1]

### Fixed

- The rule editor always showed "Create Custom Rule", even when adding a
  blacklist rule, editing a rule, or creating one from a group. The translation
  pass overwrote the title that mode setup had already applied ([#81]).

## [3.8.0]

### Added

- Rule priority and per-rule minimum tabs are editable in the rule editor.
  Both fields existed and were honoured, but could only be set by exporting
  rules, editing the JSON and re-importing ([#80]).

### Fixed

- Clearing a per-rule minimum had no effect — the previous value was kept.

## [3.7.1]

### Fixed

- Rule priority is honoured when matching tabs. It was documented as
  "higher = more priority" and validated on import, but never read: overlapping
  rules resolved by creation order instead. Rules that share a priority keep
  their existing order, so nothing changes unless you set one ([#79],
  closes [#78]).

## [3.7.0]

### Added

- Catch-all rules. A rule whose pattern is a lone `*` collects tabs nothing else
  claimed — every unmatched tab in rules-only mode, or tabs that can't form
  their own group in domain mode. Browser pages and blacklisted tabs are never
  collected ([#77], closes [#29]).

## [3.6.0]

### Added

- Opt-in setting to remove the "System" group. Off by default; turning it on
  keeps browser pages and new empty tabs ungrouped and dissolves any existing
  System group ([#76], closes [#31]).

### Fixed

- Dissolving the System group only affected the current window, and missed
  groups carrying a sort-index prefix.

## [3.5.2]

### Fixed

- Tab groups for internationalized domains showed punycode — `Xn--mnchen-3ya`
  instead of `München` ([#75], closes [#74]).

[unreleased]: https://github.com/nitzanpap/auto-tab-groups/compare/v3.13.0...HEAD
[3.13.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.13.0
[3.12.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.12.0
[3.11.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.11.0
[3.10.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.10.0
[3.9.1]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.9.1
[3.9.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.9.0
[3.8.1]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.8.1
[3.8.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.8.0
[3.7.1]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.7.1
[3.7.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.7.0
[3.6.0]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.6.0
[3.5.2]: https://github.com/nitzanpap/auto-tab-groups/releases/tag/v3.5.2
[#23]: https://github.com/nitzanpap/auto-tab-groups/issues/23
[#25]: https://github.com/nitzanpap/auto-tab-groups/issues/25
[#27]: https://github.com/nitzanpap/auto-tab-groups/issues/27
[#68]: https://github.com/nitzanpap/auto-tab-groups/issues/68
[#88]: https://github.com/nitzanpap/auto-tab-groups/issues/88
[#29]: https://github.com/nitzanpap/auto-tab-groups/issues/29
[#31]: https://github.com/nitzanpap/auto-tab-groups/issues/31
[#74]: https://github.com/nitzanpap/auto-tab-groups/issues/74
[#75]: https://github.com/nitzanpap/auto-tab-groups/pull/75
[#76]: https://github.com/nitzanpap/auto-tab-groups/pull/76
[#77]: https://github.com/nitzanpap/auto-tab-groups/pull/77
[#78]: https://github.com/nitzanpap/auto-tab-groups/issues/78
[#79]: https://github.com/nitzanpap/auto-tab-groups/pull/79
[#80]: https://github.com/nitzanpap/auto-tab-groups/pull/80
[#81]: https://github.com/nitzanpap/auto-tab-groups/pull/81
[#82]: https://github.com/nitzanpap/auto-tab-groups/pull/82
[#84]: https://github.com/nitzanpap/auto-tab-groups/pull/84
[#86]: https://github.com/nitzanpap/auto-tab-groups/pull/86
[#87]: https://github.com/nitzanpap/auto-tab-groups/pull/87
[#89]: https://github.com/nitzanpap/auto-tab-groups/pull/89
[#90]: https://github.com/nitzanpap/auto-tab-groups/pull/90

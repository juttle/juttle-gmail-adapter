# Change Log
This file documents all notable changes to juttle-gmail-adapter. The release numbering uses [semantic versioning](http://semver.org).

## 0.6.0
Released 2016-03-23

### Minor Changes
- Update to reflect changes in juttle 0.7.0. This release is compatible with adapter version 0.7.0. [[#40](https://github.com/juttle/juttle-gmail-adapter/pull/40)].

## 0.5.1
Released 2016-03-09

### Minor Changes
- Reorganize code layout to more closely match reference version in [juttle-adapter-template](https://github.com/juttle/juttle-adapter-template) [[#36](https://github.com/juttle/juttle-gmail-adapter/pull/36)]
- Added code coverage tests [[#29](https://github.com/juttle/juttle-gmail-adapter/issues/29)]
- Minor changes to filter expression parsing [[#33](https://github.com/juttle/juttle-gmail-adapter/pull/33)]
- Add an ecosystem image to the top level README that shows where the adapter fits into the overall ecosystem. [[#37](https://github.com/juttle/juttle-gmail-adapter/pull/37)]
- Update adapter walkthrough to rely on the more [general version](https://github.com/juttle/juttle/blob/master/docs/adapters/adapter_api.md) for overall discussion. This walkthrough describes gmail-specific features. [[#35](https://github.com/juttle/juttle-gmail-adapter/pull/35)]

## 0.5.0
Released 2016-02-26

### Major Changes
- Update code and READMEs to reflect changes in juttle 0.5.0, including the concept of adapter versioning. This release is compatible with adapter version 0.5.0. [[#31](https://github.com/juttle/juttle-gmail-adapter/pull/31)]

### Minor Changes
- Update to use ES6 features, including classes, fat arrow for this scoping, let instead of var, etc. [[#31](https://github.com/juttle/juttle-gmail-adapter/pull/31)]
- Unit tests can now run using a local juttle config file in addition to a config provided via the environment. [[#27](https://github.com/juttle/juttle-gmail-adapter/pull/27)]
- Small changes to the setup instructions. [[#28](https://github.com/juttle/juttle-gmail-adapter/pull/28)]

### Bug Fixes
- Some unit tests were falsely passing when they should have been failing. Updated and fixed any problems. [[#31](https://github.com/juttle/juttle-gmail-adapter/pull/31)]

## 0.4.2
Released 2016-01-21

### Major Changes

### Minor Changes
 - Minor documentation fixes.

### Bug Fixes

## 0.4.1
Released 2016-01-20

### Major Changes

### Minor Changes
 - Fix minor problem with juttle dependency in package.json.

### Bug Fixes

## 0.4.0
Released 2016-01-20

### Major Changes
 - NOTICE: As part of the update to juttle 0.3.0, the configuration syntax for adapters changed from the name of the module ("juttle-gmail-adapter") to the type of the adapter ("gmail").

### Minor Changes
- Update to handle changes in juttle 0.3.0.

### Bug Fixes
- Eliminate unnecessary emit_eof call for write adapter [juttle/juttle#131]

## 0.3.0
Released 2016-01-08

### Major Changes
- Add support for a write proc which sends program outputs as email messages [#10]

### Minor Changes

## 0.2.0
Released 2016-01-06

### Major Changes
- Add support for live reads of messages when a -to is specified in the future [#7]
- Add support for filtering expressions in the ``read gmail`` command. [#8]
- Add walkthrough notes that provide details on how the gmail adapter is implemented. Will be a useful reference for others who want to write their own adapters. [#5]

### Minor Changes
- Update to changes in juttle 0.2.0.
- Add comprehensive unit tests and TravisCI integration. [#12]

## 0.1.1
Released 2015-12-21

### Major Changes
- Switch to using the -raw option to provide the gmail search expression.

### Minor Changes

## 0.1.0
Released 2015-12-19

### Major Changes
- Initial version.

### Minor Changes

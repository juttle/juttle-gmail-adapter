# Change Log
This file documents all notable changes to juttle-gmail-adapter. The release numbering uses [semantic versioning](http://semver.org).

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
 - IMPORTANT CHANGE: As a part of the upgrade to juttle 0.3.0, the format for ``juttle-config.js`` files has changed. The configuration for the gmail adapter is now associated with the property ``gmail`` and not ``juttle-gmail-adapter``. So configuration files containing:

```
{
    "adapters": {
        "juttle-gmail-adapter": {...}
    }
}
```

Should change to:

```
{
    "adapters": {
        "gmail": {...}
    }
}
```

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

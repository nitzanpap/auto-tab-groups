# Frontend Validation Synchronization Fix

## Issue

The frontend validation in `rules-modal.js` had a less comprehensive `isValidDomainFormat` function compared to the backend `validateDomain` function in `RulesUtils.js`. This caused wildcard domains like `*.mozilla.org` to be incorrectly rejected with "Invalid domain format" errors in the UI, even though the backend supported them.

## Root Cause

- Frontend used a simplified validation that only checked basic pattern matching
- Backend had more comprehensive validation with additional edge case handling
- The two validation methods were out of sync

## Solution

Synchronized the frontend `isValidDomainFormat` method to match the backend `validateDomain` logic:

- Added comprehensive edge case validation (dots, hyphens, consecutive dots)
- Maintained consistent wildcard pattern validation
- Added proper length limits and domain format checks

## Changes Made

- Updated `extension/src/public/rules-modal.js`:
  - Enhanced `isValidDomainFormat` method with complete validation logic
  - Added checks for invalid patterns (leading/trailing dots and hyphens)
  - Added check for consecutive dots
  - Maintained wildcard pattern support

## Testing

- Verified that `*.mozilla.org` and other wildcard patterns are now accepted
- Confirmed that invalid patterns are still properly rejected
- Built and tested both Chrome and Firefox extensions successfully

## Result

- Frontend and backend validation are now consistent
- Wildcard domains are properly validated in the UI
- Custom rules can be created with wildcard patterns without validation errors

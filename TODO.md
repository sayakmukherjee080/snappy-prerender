# TODO

Non-critical logic still without a test, per the project's testing rule.

- `src/core/destination.js`: the count of skipped non-file entries while copying a destination tree is not covered, because creating symbolic links needs privileges on Windows.
- `src/core/browser.js`: the download progress percentage guard for a zero-length total is not covered; it only shapes a debug line.

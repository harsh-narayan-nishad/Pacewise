# Uploaded PDF showed the wrong owner

## Question
A PDF uploaded by one person appeared to belong to someone else. Why?

## Findings
- Large PDFs exceed the browser's localStorage quota, so ==the save failed silently==.
- The record saying "this story belongs to user X" was written in the same step, so it was lost too.
- With no owner on record, the app fell back to whoever was signed in.

## Fix
- Ownership is now kept in a separate small list (`customStoryClaims`) that always fits.
- `SessionManager.findCustomStoryOwner` checks that list before trusting anything else.
- A test covers the oversized-PDF case.

## Decision
Never store ownership in the same write as large content.

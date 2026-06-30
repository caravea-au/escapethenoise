# SMTP Implementation

This document tracks email and SMTP guidance for the baseplate.

## Current State

- There is no SMTP-backed form endpoint in `frontend/src/app/api/`.
- There is no email-form validation helper in `frontend/src/lib/`.
- There is no active SMTP-backed frontend form in the current baseplate.

## If Email Is Added Later

- Define the exact form purpose first.
- Add only the fields the new flow needs.
- Document the endpoint, validation rules, and environment variables from the rebuilt implementation.

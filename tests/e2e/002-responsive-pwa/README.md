# Responsive installable shell

The browser and Home Screen entry point retain their hierarchy, manifest, touch targets, and reduced-motion behavior at phone and desktop widths.

## The welcome screen is complete at the phone viewport

![The welcome screen is complete at the phone viewport](./screenshots/000-installable-welcome-phone.png)

**Verifications:**

- [x] The Web App Manifest supplies standalone Home Screen metadata
- [x] The main CTA has an accessible name and at least a 44-pixel target
- [x] The running Git hash is visible and a newer deployed build is actionable
- [x] Reduced motion eliminates the decorative pulse duration

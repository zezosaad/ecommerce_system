# VendorHub Mobile

## Status

Placeholder — Flutter implementation is roadmap-only and tracked under feature FR-MOB-001 / FR-MOB-002.

## Planned Architecture

- **Framework**: Flutter
- **API Contract**: The mobile client will consume the same REST API (`/api/v1/*`) via the typed `@vendorhub/api-client` envelope shapes.
- **Auth**: Supabase Auth (Flutter SDK) with JWT-based session management.
- **State**: Riverpod or equivalent.

## Getting Started (when implemented)

```bash
cd apps/mobile
flutter pub get
flutter run
```

## API Contract Reference

See `specs/001-platform-bootstrap/contracts/` for OpenAPI specifications.

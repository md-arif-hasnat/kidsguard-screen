# Contributing to KidsGuard

Thank you for your interest in helping protect families! Please follow these standards to maintain project quality.

## Coding Standards

### Android (Kotlin/Compose)
- Follow **Clean Architecture** patterns (Repository, ViewModel, UI).
- Use **StateFlow** for reactive UI updates.
- Keep Composables stateless where possible.
- Use `androidx.compose.material3` for all UI components.

### Web Dashboard (Next.js/TS)
- Use **Functional Components** and **Hooks**.
- Use **Tailwind CSS** for all styling.
- Strictly type everything with **TypeScript interfaces**.
- Ensure all Firestore listeners include an `unsubscribe` cleanup.

---

## Commit Message Style
Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

- `feat:` for new features.
- `fix:` for bug fixes.
- `docs:` for documentation updates.
- `style:` for UI/CSS changes.
- `refactor:` for code restructuring.

**Example**: `feat: add child-specific safe zone support`

---

## Branch Strategy
- `main`: Production-ready stable code.
- `beta`: Release candidates for testing.
- `dev`: Primary development branch.
- `feature/*`: Specific features being built.

---

## Testing Checklist
Before submitting a Pull Request:
1. [ ] Android build passes (`./gradlew assembleDebug`).
2. [ ] Web build passes (`npm run build`).
3. [ ] Firebase security rules are not violated.
4. [ ] No hardcoded mock data remains in production code paths.
5. [ ] No sensitive keys or tokens are printed in logs.

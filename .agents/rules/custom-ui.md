# Custom UI Control Rules

- Do not use native HTML select controls in product UI.
- Use the shared `frontend/src/components/common/CustomSelect.jsx` component for dropdown and selection controls.
- Reuse other shared custom controls when available instead of browser-native UI.
- Keep custom controls keyboard accessible and provide an appropriate accessible label.
- Use a native control only when the user explicitly requests it or a platform limitation requires it. Document the reason when this exception is necessary.
- **Input Icon Padding Rule**: When placing icons inside input containers (such as search or prefix icons), wrap element resets in `@layer base` and ensure input padding (`!pl-12` or `paddingLeft: 3.25rem`) provides at least 48px/3rem clearance to avoid overlapping placeholder or user text.

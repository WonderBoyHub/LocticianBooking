# Frontend Structure Analysis

## Current src/ Folder Structure

### ✅ KEEP - Essential & Actively Used

#### 1. **app/** (84KB)
- **Purpose**: Next.js App Router - all routes and layouts
- **Usage**: Core routing structure
- **Status**: ✅ Essential - DO NOT REMOVE

#### 2. **components/** (760KB)
- **Purpose**: All React UI components
- **Usage**: Used by pages and app routes
- **Imports**: Used everywhere
- **Status**: ✅ Essential - DO NOT REMOVE

#### 3. **pages/** (380KB)
- **Purpose**: Reusable page components
- **Usage**: Imported by 8+ app routes (LandingPage, LoginPage, BookingPage, etc.)
- **Why Keep**: These are the actual page implementations, app routes just wrap them
- **Status**: ✅ Essential - DO NOT REMOVE

#### 4. **store/** (116KB)
- **Purpose**: Redux store, slices, and RTK Query API
- **Usage**: State management across the app
- **Status**: ✅ Essential - DO NOT REMOVE

#### 5. **schemas/** (60KB)
- **Purpose**: Zod validation schemas
- **Usage**: Form validation across pages
- **Status**: ✅ Essential - DO NOT REMOVE

#### 6. **i18n/** (36KB) + **i18n.ts**
- **Purpose**: Internationalization (Danish/English)
- **Usage**: Used by app/providers.tsx and throughout components
- **Status**: ✅ Essential - DO NOT REMOVE

#### 7. **lib/** (16KB)
- **Purpose**: Utility libraries
- **Contents**:
  - `api-client.ts` - SSR/SSG compatible API client
  - `react-router-dom.tsx` - React Router compatibility shim
  - `navigation.tsx` - Navigation utilities
- **Status**: ✅ Essential - DO NOT REMOVE

#### 8. **config/** (12KB)
- **Purpose**: App configuration (env variables, constants)
- **Usage**: Used by API client, store, services
- **Status**: ✅ Essential - DO NOT REMOVE

#### 9. **types/** (12KB)
- **Purpose**: TypeScript type definitions
- **Usage**: Type safety across the app
- **Status**: ✅ Essential - DO NOT REMOVE

#### 10. **utils/** (12KB)
- **Purpose**: Utility functions
- **Usage**: Helpers used across components
- **Status**: ✅ Essential - DO NOT REMOVE

#### 11. **services/** (8KB)
- **Purpose**: API services (socket.io, etc.)
- **Usage**: WebSocket connections, external services
- **Status**: ✅ Essential - DO NOT REMOVE

#### 12. **styles/** (8KB)
- **Purpose**: Global CSS and Tailwind
- **Usage**: Imported by app layout
- **Status**: ✅ Essential - DO NOT REMOVE

#### 13. **hooks/** (8KB)
- **Purpose**: Custom React hooks
- **Usage**: Reusable logic across components
- **Status**: ✅ Essential - DO NOT REMOVE

#### 14. **middleware.ts**
- **Purpose**: Next.js middleware for auth
- **Usage**: Route protection
- **Status**: ✅ Essential - DO NOT REMOVE

---

### ❌ REMOVE - Empty/Unused

#### 15. **test/** (0KB)
- **Purpose**: Test setup files
- **Contents**: Empty directory
- **Status**: ❌ REMOVE - Empty folder

---

## Size Breakdown

```
Total src size: ~1.5MB

Essential folders:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
components/     760KB  (50%)  UI components
pages/          380KB  (25%)  Page implementations
store/          116KB  (8%)   Redux store
app/            84KB   (5%)   Next.js routes
schemas/        60KB   (4%)   Validation
i18n/           36KB   (2%)   Translations
lib/            16KB   (1%)   Utilities
config/         12KB   (1%)   Configuration
types/          12KB   (1%)   TypeScript types
utils/          12KB   (1%)   Helper functions
services/       8KB    (<1%)  External services
styles/         8KB    (<1%)  Global CSS
hooks/          8KB    (<1%)  Custom hooks

Removable:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
test/           0KB    Empty folder
```

## Recommendations

### ✅ Keep Everything Except

1. **Remove `test/` folder** - Empty, no files
   ```bash
   rm -rf src/test
   ```

### Why Keep `pages/` Folder?

Many developers ask: "Why keep pages/ if we have app/?"

**Answer**: Different purposes!

- **app/** = Next.js routes (thin wrappers with metadata)
  ```tsx
  // app/login/page.tsx
  export const metadata = { title: 'Login' }
  export default function Login() {
    return <LoginPage />  // ← Imports from pages/
  }
  ```

- **pages/** = Actual page implementations (the business logic)
  ```tsx
  // pages/auth/LoginPage.tsx
  export const LoginPage = () => {
    // 200+ lines of actual login logic
    return <form>...</form>
  }
  ```

**Benefits of this structure**:
1. ✅ Separation of concerns (routing vs logic)
2. ✅ Reusable components (pages can be used outside routes)
3. ✅ Easier testing (test page components directly)
4. ✅ Cleaner code organization

### Alternative: Consolidate (Not Recommended)

You *could* move all page logic into app/ routes, but this would:
- ❌ Mix routing config with business logic
- ❌ Make components harder to reuse
- ❌ Make testing more complex
- ❌ Reduce code organization

## Final Structure (Recommended)

```
src/
├── app/              ✅ Next.js routes (thin wrappers)
├── pages/            ✅ Page implementations (business logic)
├── components/       ✅ UI components
├── store/            ✅ Redux store
├── schemas/          ✅ Validation
├── i18n/             ✅ Translations
├── lib/              ✅ Utilities
├── config/           ✅ Configuration
├── types/            ✅ TypeScript types
├── utils/            ✅ Helpers
├── services/         ✅ External services
├── styles/           ✅ Global CSS
├── hooks/            ✅ Custom hooks
└── middleware.ts     ✅ Auth middleware
```

## Conclusion

**No bloat found!** All folders (except empty `test/`) are actively used and essential.

The structure follows Next.js best practices:
- ✅ Clean separation of concerns
- ✅ Logical organization
- ✅ Everything has a purpose
- ✅ No redundant code

**Action**: Remove only the empty `test/` folder.

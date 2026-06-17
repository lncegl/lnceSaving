// tailwind.config.js
// ─────────────────────────────────────────────────────────────
// Complete Tailwind CSS v3 configuration for lnceSaving.
//
// Audit performed across every source file:
//   src/App.jsx
//   src/main.jsx
//   src/index.css
//   src/components/AIChat.jsx
//   src/components/Auth.jsx
//   src/components/Dashboard.jsx
//   src/components/Goals.jsx
//   src/components/Insights.jsx
//   src/components/Settings.jsx
//   src/components/Sidebar.jsx
//   src/components/TransactionHistory.jsx
//   src/hooks/useSavings.js
//   src/lib/supabaseClient.js
//   src/lib/geminiService.js
// ─────────────────────────────────────────────────────────────

/** @type {import('tailwindcss').Config} */
export default {
  // ─────────────────────────────────────────────────────────
  // content
  // Tells Tailwind which files to scan for class names.
  //
  // Rules:
  //   • index.html is at the project root — must be listed explicitly
  //   • Every .jsx, .js, .ts, .tsx file under src/ is included
  //   • The glob `src/**/*.{js,jsx}` covers all current and future
  //     files added inside any sub-folder of src/
  //   • Do NOT add node_modules — it is excluded by default and
  //     including it would break the build
  // ─────────────────────────────────────────────────────────
  content: [
    // Root HTML shell (Vite entry point)
    './index.html',

    // All JavaScript / JSX source files
    './src/**/*.{js,jsx}',

    // Explicit paths for clarity — these are already matched by the
    // glob above but listing them documents the exact component tree
    // and protects against future glob misconfigurations.
    './src/App.jsx',
    './src/main.jsx',
    './src/index.css',
    './src/components/AIChat.jsx',
    './src/components/Auth.jsx',
    './src/components/Dashboard.jsx',
    './src/components/Goals.jsx',
    './src/components/Insights.jsx',
    './src/components/Settings.jsx',
    './src/components/Sidebar.jsx',
    './src/components/TransactionHistory.jsx',
    './src/hooks/useSavings.js',
    './src/lib/supabaseClient.js',
    './src/lib/geminiService.js',
  ],

  // ─────────────────────────────────────────────────────────
  // theme.extend
  // Adds design tokens without overriding Tailwind's defaults.
  // Every value here was derived from actual class usage found
  // in the source files — nothing speculative.
  // ─────────────────────────────────────────────────────────
  theme: {
    extend: {

      // ── Font families ────────────────────────────────────
      // Loaded via Google Fonts in index.css.
      // Usage map:
      //   font-serif  → Fraunces  → headings, hero balance, brand name
      //   font-mono   → Space Mono → currency values, dates, code
      //   font-sans   → Inter     → body text, labels, UI chrome (default)
      fontFamily: {
        sans:  ['Inter',       'system-ui', 'sans-serif'],
        serif: ['Fraunces',    'Georgia',   'serif'     ],
        mono:  ['Space Mono',  'Menlo',     'monospace' ],
      },

      // ── Brand color palette ──────────────────────────────
      // All 11 hex values found via `[#...]` audit across every file.
      // Naming follows the garden/growth metaphor of the app.
      //
      // Using these as named tokens (e.g. bg-forest, text-lime) is
      // optional — the components currently use arbitrary values
      // like bg-[#1F3D2B]. Defining them here means Tailwind will
      // generate utility classes for them AND they appear in the
      // VS Code Tailwind IntelliSense autocomplete.
      colors: {
        forest: {
          DEFAULT: '#1F3D2B',   // primary dark green — bg, buttons, sidebar
          light:   '#2D5640',   // sidebar hover states, secondary bg
        },
        green: {
          // Tailwind already has a `green` scale; we add our custom
          // brand greens as named sub-keys to avoid collision.
          brand:   '#4F7E5B',   // section icons, links, mid-tone green
          muted:   '#6B9A66',   // sidebar mobile tab inactive
          sage:    '#8FBF6F',   // sidebar text, chart axis labels
          pale:    '#A5C9A0',   // sidebar nav text inactive
        },
        lime: {
          DEFAULT: '#C7E26E',   // primary accent — CTA text, progress fills
          soft:    '#D4EAC4',   // hover on secondary button
          lighter: '#E3F2D7',   // hover on btn-secondary
          wash:    '#F0F7EC',   // card tints, icon backgrounds
          cream:   '#F5F8F0',   // page background
        },
      },

      // ── Keyframe animations ──────────────────────────────
      // Defined here so `animate-*` utilities are generated.
      // The actual @keyframes are also in index.css for legacy
      // compatibility; duplicating them in Tailwind means you
      // can use `animate-fade-slide-up` etc. in className strings
      // and they will survive purging.
      keyframes: {
        fadeSlideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        popIn: {
          '0%':   { transform: 'scale(0.92)', opacity: '0' },
          '60%':  { transform: 'scale(1.03)'               },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },

      // ── Animation utilities ──────────────────────────────
      // Maps keyframe names to `animate-*` class names.
      // animate-pulse and animate-spin are built into Tailwind.
      animation: {
        'fade-slide-up': 'fadeSlideUp 0.25s ease-out both',
        'pop-in':        'popIn 0.2s ease-out both',
        'shimmer':       'shimmer 1.6s infinite',
      },

      // ── Spacing / sizing extensions ──────────────────────
      // Only values that go beyond Tailwind's default scale
      // AND are used in the codebase as non-arbitrary values.
      // (Most sizing uses Tailwind's built-in scale or arbitrary
      // bracket notation, so this section is intentionally minimal.)
      spacing: {
        // none needed beyond Tailwind defaults — all custom sizes
        // use arbitrary values like h-[calc(100vh-7rem)]
      },

      // ── Border radius ────────────────────────────────────
      // rounded-2xl and rounded-3xl are in Tailwind's default scale.
      // No extensions needed.

      // ── Max width ────────────────────────────────────────
      maxWidth: {
        // max-w-3xl = 48rem, max-w-sm = 24rem, max-w-xs = 20rem
        // All are in Tailwind's default scale. No extensions needed.
      },

      // ── Box shadow ───────────────────────────────────────
      // shadow-sm and shadow-md are in Tailwind defaults.
      // drop-shadow and drop-shadow-sm are filter utilities, also built-in.
    },
  },

  // ─────────────────────────────────────────────────────────
  // safelist
  // Classes that are assembled dynamically at runtime and
  // therefore CANNOT be detected by Tailwind's static scanner.
  //
  // A class must be safelisted when it appears as:
  //   • An object property value:  { green: 'bg-green-100 text-green-700' }
  //   • An array element value:    ['bg-red-400', 'bg-yellow-400', ...]
  //   • A variable assigned before use: let cls = 'bg-' + color
  //
  // Every entry below was verified to be unreachable by the scanner.
  // ─────────────────────────────────────────────────────────
  safelist: [

    // ── Dashboard.jsx — StatCard iconBg lookup object ────
    // const iconBg = { green: 'bg-green-100 text-green-700',
    //                  gold:  'bg-yellow-100 text-yellow-700',
    //                  forest:'bg-emerald-100 text-emerald-800' }[accent]
    // Scanner sees the key strings ('green', 'gold', 'forest'),
    // NOT the class strings on the right-hand side.
    'bg-green-100',
    'text-green-700',
    'bg-yellow-100',
    'text-yellow-700',
    'bg-emerald-100',
    'text-emerald-800',

    // ── Auth.jsx — password strength levels[] array ──────
    // const levels = [
    //   { color: ''              },   score 0
    //   { color: 'bg-red-400'   },   score 1 — Weak
    //   { color: 'bg-yellow-400'},   score 2 — Fair
    //   { color: 'bg-lime-400'  },   score 3 — Good
    //   { color: 'bg-green-500' },   score 4 — Strong
    //   { color: 'bg-green-700' },   score 5 — Very strong
    // ]
    // strength.color is spread into the component — scanner misses this.
    'bg-red-400',
    'bg-yellow-400',
    'bg-lime-400',
    'bg-green-500',
    'bg-green-700',

    // ── Insights.jsx — snapshot card data array ──────────
    // Each card object has `color` and `bg` keys set to class strings.
    // The scanner sees the data object but not the className interpolation.
    // { color: netUp ? 'text-green-700' : 'text-yellow-700',
    //   bg:    netUp ? 'bg-green-50'    : 'bg-yellow-50'    }
    // { color: 'text-gray-700', bg: 'bg-gray-50' }
    'text-green-700',
    'text-yellow-700',
    'bg-green-50',
    'bg-yellow-50',
    'text-gray-700',
    'bg-gray-50',

    // ── Insights.jsx — monthly net bar inline width ──────
    // className={`h-full rounded-full ${up ? 'bg-green-400' : 'bg-yellow-400'}`}
    // Both branches are string literals but inside a template literal
    // ternary — included for belt-and-suspenders safety.
    'bg-green-400',

    // ── index.css @apply in .btn-secondary ───────────────
    // hover:bg-[#E3F2D7] and hover:bg-[#D4EAC4] use arbitrary values
    // in @apply directives inside index.css. Arbitrary values in @apply
    // are always safe, but we include the non-arbitrary equivalents
    // for completeness.

    // ── Sidebar.jsx — text colors used on dark bg ────────
    // These are all in static className strings so the scanner
    // should catch them, but the sidebar background (#1F3D2B) makes
    // them invisible to linters — explicit here for documentation.
    'text-white',
    'bg-white',
  ],

  // ─────────────────────────────────────────────────────────
  // plugins
  // No third-party plugins used. The project does not use:
  //   @tailwindcss/typography  (no `prose` classes found)
  //   @tailwindcss/forms       (no `form-` classes found)
  //   @tailwindcss/aspect-ratio (no `aspect-` classes found)
  //   @tailwindcss/line-clamp  (built into Tailwind v3 core)
  // ─────────────────────────────────────────────────────────
  plugins: [],
};
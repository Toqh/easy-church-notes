# Context and goals

EasyChurchNotes uses warm writing surfaces, bold boundaries, yellow primary actions, and violet supporting actions. Preserve the note editor, automatic passage previews on Enter/Space, account privacy, and Bible search while replacing the former sage/serif styling.

Based on the user-supplied [neobrutalism skill](https://github.com/bergside/awesome-design-skills/blob/HEAD/skills/neobrutalism/SKILL.md). The supplied skill text is the reference for this implementation.

# Design tokens and foundations

- Colour must come from the semantic variables at the start of `app/globals.css`: primary `#FDC800`, secondary `#432DD7`, surface `#FBFBF9`, text `#1C293C`, success `#16A34A`, warning `#D97706`, danger `#DC2626`.
- Primary actions use dark text on yellow; supporting actions use white on violet. Success and warning text use separate darker ink tokens to meet contrast requirements; do not use the base green/orange as small text on white.
- Use Inter for body/display and JetBrains Mono for labels, version identifiers, and keyboard hints. Fonts load with `display=swap`; system sans/monospace fallbacks must keep the app usable if the font service cannot be reached.
- Typography must use 13/15/17/21/27/35px tokens. Writing uses 17px with 1.9 line-height. Small labels must remain at least 13px.
- Use the 4/8/12/16/24/32px spacing tokens; 48/64px are multiples for document margins. Borders are 1.5px for compact controls, 2px for cards, 3px for major panel boundaries. Corners use 4px.
- Shadows are solid 2/4/8px offsets, with zero blur. Dark mode overrides surface/ink variables; yellow and violet retain their brand roles.

# Component-level rules

| Component | Anatomy and default | Interaction and states |
| --- | --- | --- |
| Main action | Icon + label, yellow fill, 2px border, 4px shadow, 44px minimum height | Hover lifts 1px; press moves 3px into its shadow. Focus has a 3px outline. Disabled uses neutral tokens with no shadow or movement. |
| Navigation | Icon + label + count, 44px row | Selected has yellow fill and a visible border. Hover reveals a border. Long account labels truncate; navigation labels remain readable. |
| Note card | Kind/date, topic, two-line excerpt, preacher/tag | Selected is yellow with dark text and a hard shadow. Hover keeps a visible border. Long topic text wraps; tags truncate inside the card. |
| Editor | Topic, metadata, formatting toolbar, text canvas | Writing surface remains visually quiet. Formatting toggles expose `aria-pressed`. Enter/Space after a reference opens the passage modal in the selected version. Insert places all selected passages at the saved caret. |
| Passage modal | Compact version selector, editable reference, verse text, Cancel / Insert into note | Omit introductory titles, instructions and count headings. Display the reference once, as an editable 21px field; show Update only after an edit. Use a 640px maximum width, 24px padding and 21px passage text (17px on phones). Keep Add another passage quiet; reveal its search form only on request. Multiple verses appear in a continuous list with thin separators. Native top-layer dialog blurs the background by 8px. Loading/error/ready states are explicit; Insert is disabled until every reference is ready. Escape/outside click cancel. Preserve required credits. |
| Inputs | Persistent accessible label, 2px boundary where boxed | Keyboard focus is visible. Use 16px input text on touch devices to avoid viewport zoom. Errors use a message plus a border; colour alone is insufficient. |
| Dialog | Labelled heading, close button, form/actions | Native modal dialog handles focus containment and Escape. Use 3px border and 8px hard shadow. Content scrolls inside the viewport. |
| Feedback | Icon/message, semantic background, boundary | Show saved/sync/loading state in words. Do not replace text with a coloured dot alone. Error text wraps instead of overflowing. |
| Focus mode | Bordered expand/contract control in the editor ribbon | Hide navigation and notebook panels. Keep the editor mounted and retain current text/selection. The same control exits focus mode; passage lookup works in both layouts. |
| Minimized navigation | Bordered sidebar control in the desktop ribbon | Toggle a 72px icon rail while keeping the notebook visible. Icons retain titles and accessible labels. Below 1050px use the scrollable navigation drawer. |
| Appearance | Sun/moon control in navigation and the editor ribbon | Keep the control available in focus mode and on mobile. Expose pressed state and persist the chosen appearance. |

Personal-reflection notes must omit the preacher input and its separator. Switching to sermon or study must restore the field without erasing a previously entered preacher. Keep the tags available for all collections.

The writing surface retains 240–480px of editable bottom padding (40dvh, clamped) even for a short note. Clicking below the last paragraph focuses the end, appending one empty paragraph only when necessary. The viewport grid uses a minmax(0,1fr) row; navigation, notebook list and note area must scroll independently rather than expanding the grid.

Bible search is a modal at every width. At <=1050px navigation becomes a scrollable drawer; at <=760px the notebook and editor occupy separate views. On narrow screens, collapse panels rather than reducing type below 13px. The formatting toolbar may scroll horizontally at very small widths.

# Accessibility requirements and testable acceptance criteria

- Normal text must reach 4.5:1 contrast; large text and control boundaries must reach 3:1 against adjoining surfaces. Test both appearances and selected yellow cards.
- Interactive targets must be at least 24x24px on desktop; main actions are at least 44px high. Icon controls are 44x44px on phones; remove-tag controls are at least 32x32px on phones.
- Every keyboard control must show a 3px focus indicator with a 4px offset, including the writing surface. Focus must remain visible within scrolling containers.
- At 320px width there must be no document-level horizontal overflow. Long titles, metadata, API errors, and translation names must stay within their container.
- Press Enter after `John 3:16` and `Romans 8:28–30`: the full passage preview must appear in the selected translation. Escape closes dialogs; account, search, and editor controls retain accessible names.
- `prefers-reduced-motion` must remove visible movement and spinner animation. Errors must not disappear merely because a user changes appearance.

# Content and tone standards with examples

Use concise, explicit action labels: “New note”, “Search Bible”, “Insert”, “Cancel”, “Restore note”. Say “Bible lookup is unavailable” when a lookup fails; do not imply an empty result proves a passage does not exist. Keep Scripture text and existing user notes unchanged.

# Anti-patterns and prohibited implementations

- Do not introduce raw component-level colours; use semantic tokens. Do not use low-contrast orange text where `--warning-ink` is required.
- Do not add blurred drop shadows, translucent glass panels, or inconsistent corner radii. Backdrop blur is reserved for modal isolation requested by the user.
- Do not reduce text to 8–11px to fit desktop panels; collapse the panels at the documented breakpoints.
- Do not identify a selected state by colour alone: retain the border/shadow. Do not disable focus outlines to preserve the visual style.
- Migration: replace the old global stylesheet rather than append a second theme. Components use the shared classes; backend, stored content, and account flows stay unchanged.

# QA checklist

- [ ] Build and type checking pass.
- [ ] Existing note persistence, account separation, passage preview, search, and mobile tests pass.
- [ ] Desktop, 320px phone, and dark-mode screenshots show no clipped controls or page overflow.
- [ ] Keyboard focus is visible on primary actions, text fields, and toolbar buttons.
- [ ] Colour pairs pass the stated contrast thresholds; mobile target dimensions meet the stated minimums.
- [ ] Enter after a reference/range opens the full modal in normal and Focus modes; editing, multi-insert, version switching and all cancellation methods work.
- [ ] All three panels scroll independently, including the mobile drawer, and desktop navigation minimizes without hiding the notes list.
- [ ] Reduced motion, unavailable Bible service, and long labels remain usable.

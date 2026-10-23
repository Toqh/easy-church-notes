# EasyChurchNotes

A notebook for sermons, Bible study, and personal reflections. Built with React, TypeScript, Tiptap, Supabase, YouVersion, and a public Bible API fallback. The Sites Vinext starter supplies the server and hosting integration.

## Start locally

Requires Node.js 22.13 or newer.

```powershell
cd C:\Users\USER\Documents\bible-notes-app\easychurchnotes
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by the server (normally http://localhost:5173).

Local environment values live in `.dev.vars`, which is excluded from Git. If setting up a new checkout, copy `.dev.vars.example` to `.dev.vars` and fill in:

```dotenv
YOUVERSION_APP_KEY=your_youversion_app_key
API_BIBLE_KEY=your_api_bible_key
API_BIBLE_BASE_URL=https://rest.api.bible/v1
SUPABASE_URL=https://your_project_reference.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Restart the dev server after changing configuration. The YouVersion key is used only in server code. The Supabase URL and publishable key are intentionally provided to the browser; private data is protected by database policies. Never put a Supabase secret/service-role key in this configuration.

## Connect Supabase

1. Create a Supabase project.
2. Open the SQL Editor and run the contents of `supabase/schema.sql`. It creates `public.notes`, enables row-level security, removes anonymous access, and restricts authenticated users to their own notes.
3. In Authentication → URL Configuration, set the Site URL to your app’s origin. Add `http://localhost:5173` and your deployed app origin to allowed redirect URLs.
4. Keep email/password authentication enabled. Email confirmation is supported; configure SMTP for reliable production emails and review the provider’s email limits.
5. Sign up through the app and confirm your email if prompted.

The three initial notes are editable examples saved in guest/device mode. Account notes are separate. After signing in, choose **Import notes from this device** from your account menu to copy those notes into your account. Importing twice does not duplicate existing IDs. Notes are cached per account on the current browser and synced to Supabase after changes. Sync failures leave the device copy intact and display a warning. Edits across multiple devices use last-write-wins; simultaneous collaborative editing is outside this version’s scope.

Recently deleted notes are retained until restored. There is no automatic purge. Export all notes as JSON from the sidebar or account menu; export one note as text from its actions menu. Browser storage is not a substitute for a backup, particularly on shared devices.

## Connect YouVersion

Use an official [YouVersion Platform](https://platform.youversion.com/) app key and enable the required translation agreements. The selector prefers authorised YouVersion editions, then adds NIV, NLT and AMP from the configured [API.Bible](https://api.bible/) key where missing, plus public KJV, ASV and WEB from [wldeh/bible-api](https://github.com/wldeh/bible-api). Only versions returned as accessible to the configured accounts are selectable. API.Bible editions use internal IDs -101/-102/-103; their actual provider IDs are discovered from its catalogue. Other negative IDs identify public editions; none are sent to YouVersion. KJV is the default when available.

- Type `John 3:16`, `Jn 3:16`, `1 Cor 13:4–7`, or another recognised reference, then press Space or Enter. A modal opens over a blurred background in normal and Focus modes. The key is preserved in the note; focus moves into the modal for keyboard access.
- Edit a reference and press Enter or **Update** to reload it. **Add another passage** reveals a search field for additional verses. **Insert into note** inserts the selected passages together at the saved caret, as one undo operation. With no active note, it creates a Bible study note. **Cancel**, Escape and outside click dismiss without inserting. The popup omits introductory headings and repeated reference labels.
- The top-right Bible search accepts a phrase or reference. Phrase searches use YouVersion’s paginated `search-verses` endpoint with `user_intent=text`, then resolve returned references through passages. Results follow the provider’s matching and correction behaviour, rather than an exhaustive exact-phrase concordance. Queries have a 100-character limit. The public fallback has no phrase-search endpoint: it uses an authorised identical YouVersion version when possible; otherwise the interface asks for a reference or another version.
- Public fallback quotes contain the passage and reference/version without a retrieval-source label. YouVersion and API.Bible quotations retain their required credits and translation copyright; API.Bible metadata can include additional publisher information. API.Bible's required FUMS view reporting sends provider tokens and randomly generated device/session identifiers when Scripture appears in previews or saved notes. It sends no note text, account ID or email. Existing saved quotations remain intact when switching versions.
- Popular versions are grouped. Access to NIV, NLT and AMP depends on the agreements enabled for your YouVersion or API.Bible app. API.Bible does not automatically unlock translations merely because a key is present; connection failures show a notice while working versions stay available. TPT and other unavailable versions remain disabled. AMP is not silently substituted with Amplified Classic.
- API calls have timeouts, validated parameters/responses, and explicit handling for unavailable translations and rate limits. Permission/unavailability errors fall back only to the identical translation: NIV/NLT/AMP through API.Bible, or KJV/ASV/WEB through the public provider. API.Bible supports reference lookup and paginated keyword search; the public provider supports reference lookup only. Search pagination preserves the provider that served the first page. The loaders reject mismatched translations and incomplete ranges. Licensed Scripture is not placed in a shared server cache.

Publisher terms determine permitted display, attribution, copying, and retention. Verify the translation agreements cover inserting quotations into saved personal notes. The current reference parser supports all 66 Protestant-canon books, common English abbreviations, and ranges within one chapter. Cross-chapter ranges, chapter-only detection while typing, and other canons are not implemented.

## Keyboard and layout

- Ctrl/⌘ + Alt + N: new note.
- Ctrl/⌘ + Shift + B: open Bible search.
- Standard editor shortcuts: bold, italic, undo, redo.
- Enter or comma in the tag field: add a tag.
- Light/dark appearance is saved on this device. Phone layouts switch between the note list and editor, with a navigation drawer.
- The editor ribbon includes appearance and Focus mode controls. The left navigation and Your Notebook list minimize independently on desktop/tablet. Minimize Your Notebook beside its heading and restore it with **Show notebook** in the ribbon. The current editor remains mounted. Focus mode temporarily hides both panels and preserves their earlier minimized states on exit.
- Personal reflections hide the preacher field. Switching back to a sermon or Bible study restores it without erasing a previously entered name.
- Navigation, the notes list and the writing area scroll independently within the viewport. The mobile navigation drawer scrolls too. Short notes retain 240–480px of editable space below the last paragraph, including in Focus mode; clicking below the text focuses the end and creates a paragraph only when needed.

## Check the app

```powershell
npm.cmd run typecheck
npm.cmd test
.\node_modules\.bin\playwright.cmd test --config=playwright.config.ts
npm.cmd run build
```

Browser tests use an installed Google Chrome and a running dev server on port 5173. Set `TEST_BASE_URL` to use another server. They mock Bible/auth services where needed and do not validate real API credentials. `node scripts/check-services.mjs` checks live connections without creating an account or printing keys. A 401/403 on the anonymous notes check is expected with the access rules in place; do not grant anonymous access to make that check return 200.

`node --experimental-strip-types scripts/check-api-bible.mjs` verifies which NIV, NLT and AMP editions your key can access, then checks reference lookup and search without printing keys or Scripture text. `node scripts/check-secrets.mjs` checks files that Git would include; `node scripts/check-release.mjs .next` scans the Vercel build for configured Bible secrets.

## GitHub and Vercel

The intended repository is `https://github.com/Toqh/easy-church-notes`. Never force push over existing history. The local app directory is the repository root.

Vercel uses the included `vercel.json`: Next.js framework, `npm ci`, `npm run build:vercel`, output `.next`. The default `dev`/`build` scripts retain the existing Vinext/Cloudflare workflow. For Next.js locally:

```powershell
npm.cmd run build:vercel
node --env-file=.dev.vars ./node_modules/next/dist/bin/next start --port 3001
```

Import the GitHub repository into Vercel and add these server environment variables in both Production and Preview: `YOUVERSION_APP_KEY`, `API_BIBLE_KEY`, `API_BIBLE_BASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Mark the Bible keys as sensitive. No `NEXT_PUBLIC_` Bible keys are used. Supabase's publishable key is returned by `/api/config`; the Bible keys are never returned. Set the Supabase Site URL and authentication redirect allowlist to the actual Vercel deployment origin after deployment. Do not upload `.dev.vars`; `.gitignore` and `.vercelignore` exclude local secrets and generated files.

## Hosting

The private Sites identity is recorded in `.openai/hosting.json`. Store production variables with Sites runtime environment tools; `.dev.vars` is never published. Build output is generated under `dist/`. Preserve the starter’s Sites/Vinext build integration. Private Sites hosting adds an owner access gate; Supabase still manages the app’s email/password accounts and note ownership. To make the app available to other people, explicitly change the hosting audience and configure the corresponding Supabase redirect origin.

No keys, local caches, test traces, or build artifacts should be committed. The example configuration files contain names only.

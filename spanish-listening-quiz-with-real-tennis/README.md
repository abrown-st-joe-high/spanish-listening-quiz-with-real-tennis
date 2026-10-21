# Oído — Spanish Listening Practice

A small static site for practicing listening recognition of the Spanish
alphabet (and, by extension, any other sound-based set — numbers are
included as a second example). Plain HTML/CSS/JS, no build step, deploys
directly to GitHub Pages.

Each round plays a sound, then shows four letters (or numbers) to choose
from. Answer choices are weighted toward the letters that give
non-heritage speakers the most trouble — g/j/h/y, s/c/z, m/n/ñ, b/v,
k/q — so those groups get drilled against each other instead of against
easy, unrelated letters.

## Structure

```
index.html            three screens: home, quiz, results
css/style.css
js/app.js             all quiz logic — reads the JSON files, nothing hardcoded
data/modules.json      the list of practice sets shown on the home screen
data/alphabet.json      one set: letters, their names, and confuse-groups
data/numbers.json       a second set, same shape, as an extension example
audio/alphabet/*.mp3    sound files, named to match each item's "id"
audio/numbers/*.mp3
scripts/generate_audio.py   batch-creates the mp3 files (see below)
record.html, tenis.html, tenis-record.html   see the sections further down
```

## Running it

Any static file server works locally, e.g.:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. Opening `index.html` directly via
`file://` will not work — the browser blocks the `fetch()` calls that
load the JSON files.

## Deploying to GitHub Pages

1. Push this folder to a repository.
2. In the repo, go to **Settings → Pages**.
3. Under "Build and deployment," set Source to **Deploy from a branch**,
   pick the branch (usually `main`) and root folder (`/`), save.
4. The site is live at `https://<username>.github.io/<repo-name>/`
   within a minute or two.

No server-side code, database, or build process is involved.

## Adding a new practice set (e.g. days of the week)

1. Create `data/days.json` following the same shape as `data/alphabet.json`:
   an `id`, `title`, `audioPath`, `fallbackLang`, and an `items` array
   where each item has `id`, `label`, `spoken`, and an optional
   `confuseGroup` of other item ids to weight into the multiple choice.
2. Create the matching folder, `audio/days/`.
3. Add one line to `data/modules.json`:
   `{ "id": "days", "label": "Days of the week", "dataFile": "data/days.json" }`

That's the whole extension — no HTML or JS changes needed. The home
screen, question weighting, and results screen all read from the JSON.

## Generating the sound files without recording all of them

Recording 27+ letters (and again for every future set) by hand is the
slow path. Two better options, cheapest first:

**1. Batch neural TTS (recommended) — `scripts/generate_audio.py`**

Uses `edge-tts`, a free wrapper around Microsoft Edge's neural voices —
natural-sounding, no API key, no per-character cost. One run produces
every file for a whole set:

```
pip install -r scripts/requirements.txt
python scripts/generate_audio.py data/alphabet.json
python scripts/generate_audio.py data/numbers.json --voice es-MX-JorgeNeural
```

The script reads each item's `"spoken"` field (e.g. `"jota"` for the
letter J), synthesizes it, and saves it as `audio/alphabet/j.mp3` —
matching the filename the quiz already expects. Re-running only fills
in missing files unless `--overwrite` is passed. List other voices with
`edge-tts --list-voices | grep es-`; `es-ES-AlvaroNeural` (Spain) and
`es-MX-DaliaNeural` (Mexico) are both good starting points, useful if
separate Spain/Latin America accent sets are ever wanted.

**2. No files at all — built-in browser fallback**

The quiz already checks whether an audio file loads; if a file is
missing, it speaks the letter using the browser's own Spanish
text-to-speech voice (`speechSynthesis`) instead of failing. This means
the site is playable the moment it's deployed, before any audio has
been generated — useful for testing the quiz flow, and as a permanent
fallback in browsers with no voice installed for the target `mp3`s. A
small note appears on the results screen whenever that fallback was
used, as a reminder to fill in the real files.

Either path can be mixed: generate the alphabet with `edge-tts` and
leave a future set on the fallback voice until it's worth recording
properly.

## Notes on the confuse-groups

`confuseGroup` in each JSON file is what drives the "special attention"
behavior — when a letter has entries there, the multiple-choice options
are pulled from that list first (falling back to a random letter only
if the group is smaller than needed). Adjust these lists directly in
the JSON to change which letters get drilled against each other.

## Record sounds (`record.html`)

Record any item of any set in the browser. Recordings are saved locally
(IndexedDB) and the quiz uses them immediately, ahead of published files
and the speech fallback. **Download all as ZIP** produces files such as
`audio/numbers/42.webm`; unzip into the repo root and commit to publish
them for everyone. Published `.webm` / `.m4a` files are picked up by the quiz.

## Equipo de Tenis (`tenis.html`, `tenis-record.html`)

Player-specific question and response practice.

- `tenis-record.html`: enter a player name + ID, pick a set, record every
  question and response. Two players = two IDs. The ZIP contains
  `audio/tenis/<id>/…` and `audio/tenis/players.json` (merge the entries
  if players were recorded on different devices).
- `tenis.html`: choose two players (first asks, second answers).
  *Listen & learn* plays question then response after a delay or a space-bar
  press. *Práctica solo* plays the question only; you answer aloud and press
  space to hear the response.
- **Adding content** is done in `data/tenis.json`:
  - a new verb is one line, e.g.
    `{ "inf": "querer", "yo": "quiero", "tú": "quieres", "él": "quiere", "nosotros": "queremos", "ustedes": "quieren" }`
    which generates the questions for every person with matching responses;
  - free phrases go in `"extra"` as `{ "q": "...", "a": ["...", "..."] }`.

## Empty folders

`audio/alphabet/`, `audio/numbers/` and `audio/tenis/` each hold a
`dummy.txt` so GitHub keeps the folder. Delete it once real files exist.

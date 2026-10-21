/* ==========================================================================
   Oído — Spanish listening quiz engine
   Data-driven: add a new practice set by adding a JSON file under /data
   and one line in data/modules.json. No other code changes needed.
   ========================================================================== */

const AUDIO_EXTENSIONS = ["mp3", "ogg", "wav", "webm", "m4a"]; // first one found per file wins

const state = {
  modules: [],
  selectedModule: null,
  moduleData: null,
  roundSize: 10,
  queue: [],
  currentIndex: 0,
  score: 0,
  misses: [],
  usedFallbackAudio: false,
  answered: false,
};

const el = (id) => document.getElementById(id);
const screens = {
  home: el("screen-home"),
  quiz: el("screen-quiz"),
  results: el("screen-results"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

/* ---------------------------- bootstrap ---------------------------- */

async function init() {
  try {
    const res = await fetch("data/modules.json");
    state.modules = await res.json();
  } catch (err) {
    el("module-list").innerHTML =
      '<p style="color:var(--muted)">Could not load data/modules.json.</p>';
    return;
  }
  renderModuleList();
  wireHomeControls();
}

function renderModuleList() {
  const container = el("module-list");
  container.innerHTML = "";
  state.modules.forEach((mod) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "module-row";
    row.dataset.moduleId = mod.id;
    row.innerHTML = `<span class="m-name">${mod.label}</span><span class="m-count"></span>`;
    row.addEventListener("click", () => selectModule(mod, row));
    container.appendChild(row);

    // fill in item count once the file is fetched, without blocking the list
    fetch(mod.dataFile)
      .then((r) => r.json())
      .then((data) => {
        row.querySelector(".m-count").textContent = `${data.items.length} sounds`;
      })
      .catch(() => {
        row.querySelector(".m-count").textContent = "unavailable";
        row.disabled = true;
        row.style.opacity = 0.4;
      });
  });
}

function selectModule(mod, rowEl) {
  document.querySelectorAll(".module-row").forEach((r) => r.classList.remove("selected"));
  rowEl.classList.add("selected");
  state.selectedModule = mod;
  el("start-btn").disabled = false;
}

function wireHomeControls() {
  document.querySelectorAll("#count-choices button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#count-choices button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.roundSize = parseInt(btn.dataset.count, 10);
    });
  });
  el("count-choices").querySelector('[data-count="10"]').classList.add("selected");

  el("start-btn").addEventListener("click", startRound);
  el("again-btn").addEventListener("click", startRound);
  el("home-btn").addEventListener("click", () => showScreen("home"));
  el("play-btn").addEventListener("click", () => playCurrentAudio());
  el("next-btn").addEventListener("click", nextQuestion);
}

/* ---------------------------- round setup ---------------------------- */

async function startRound() {
  const res = await fetch(state.selectedModule.dataFile);
  state.moduleData = await res.json();

  const items = state.moduleData.items;
  const size = state.roundSize === 0 ? items.length : Math.min(state.roundSize, items.length * 3);

  state.queue = buildQueue(items, size);
  state.currentIndex = 0;
  state.score = 0;
  state.misses = [];
  state.usedFallbackAudio = false;
  el("audio-mode-note").textContent = "";

  showScreen("quiz");
  renderQuestion();
}

// Build a shuffled queue; repeats the item pool (reshuffled) if a longer
// round is requested than there are distinct items.
function buildQueue(items, size) {
  const queue = [];
  while (queue.length < size) {
    queue.push(...shuffle([...items]));
  }
  return queue.slice(0, size);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------------------------- question rendering ---------------------------- */

function currentItem() {
  return state.queue[state.currentIndex];
}

function renderQuestion() {
  state.answered = false;
  const items = state.moduleData.items;
  const correct = currentItem();

  el("quiz-progress-label").textContent = `Question ${state.currentIndex + 1} of ${state.queue.length}`;
  el("quiz-score-label").textContent = `Score ${state.score}`;
  el("progress-fill").style.width = `${(state.currentIndex / state.queue.length) * 100}%`;
  el("feedback-row").textContent = "";
  el("feedback-row").className = "feedback-row";
  el("next-btn").classList.remove("visible");

  const options = buildOptions(items, correct);
  const grid = el("options-grid");
  grid.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.textContent = opt.label;
    btn.dataset.itemId = opt.id;
    btn.addEventListener("click", () => handleAnswer(opt, correct, btn, grid));
    grid.appendChild(btn);
  });

  playCurrentAudio();
}

// Picks 3 distractors, preferring the correct item's confuseGroup so the
// hard letters (g/j/h/y, s/c/z, m/n/ñ ...) get drilled together, then
// backfills randomly if the confuse group is smaller than needed.
function buildOptions(items, correct) {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const pool = new Map();

  (correct.confuseGroup || []).forEach((id) => {
    if (byId[id]) pool.set(id, byId[id]);
  });

  const remaining = shuffle(items.filter((i) => i.id !== correct.id && !pool.has(i.id)));
  for (const item of remaining) {
    if (pool.size >= 3) break;
    pool.set(item.id, item);
  }

  const options = [...pool.values()].slice(0, 3);
  options.push(correct);
  return shuffle(options);
}

/* ---------------------------- answering ---------------------------- */

function handleAnswer(chosen, correct, btnEl, grid) {
  if (state.answered) return;
  state.answered = true;

  const isCorrect = chosen.id === correct.id;
  if (isCorrect) {
    state.score += 1;
  } else {
    state.misses.push({ heard: correct.label, picked: chosen.label });
  }

  grid.querySelectorAll(".option-btn").forEach((b) => {
    b.classList.add("disabled");
    if (b.dataset.itemId === correct.id) b.classList.add("correct");
    if (b.dataset.itemId === chosen.id && !isCorrect) b.classList.add("incorrect");
  });

  const feedback = el("feedback-row");
  feedback.textContent = isCorrect ? "Correct." : `Not quite — that was "${correct.label}".`;
  feedback.className = "feedback-row " + (isCorrect ? "correct" : "incorrect");

  el("quiz-score-label").textContent = `Score ${state.score}`;
  el("next-btn").classList.add("visible");
}

function nextQuestion() {
  state.currentIndex += 1;
  if (state.currentIndex >= state.queue.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

/* ---------------------------- results ---------------------------- */

function showResults() {
  showScreen("results");
  el("results-score").textContent = `${state.score}/${state.queue.length}`;
  const pct = Math.round((state.score / state.queue.length) * 100);
  el("results-sub").textContent = `${pct}% correct`;

  const missBox = el("miss-list");
  const missRows = el("miss-rows");
  missRows.innerHTML = "";
  if (state.misses.length > 0) {
    missBox.style.display = "block";
    state.misses.forEach((m) => {
      const row = document.createElement("div");
      row.className = "miss-row";
      row.innerHTML = `<span class="heard">${m.heard}</span><span class="picked">picked ${m.picked}</span>`;
      missRows.appendChild(row);
    });
  } else {
    missBox.style.display = "none";
  }

  if (state.usedFallbackAudio) {
    el("audio-mode-note").textContent =
      "Sound files weren't found for this set, so the browser's Spanish voice stood in. Add files to the matching /audio folder for recorded playback.";
  }
}

/* ---------------------------- audio playback ---------------------------- */

// Local recording first, then each configured extension in turn, then falls back to the
// browser's built-in speech synthesis so the quiz is usable before any
// audio files exist.
async function playCurrentAudio() {
  const item = currentItem();
  const basePath = state.moduleData.audioPath;
  // 1) recordings made on the Record page in this browser
  try {
    const rec = await RecStore.get(basePath + item.id);
    if (rec) {
      new Audio(URL.createObjectURL(rec.blob)).play().catch(() => tryPlayFile(basePath, item, 0));
      return;
    }
  } catch (err) { /* IndexedDB unavailable: fall through */ }
  // 2) published files, then 3) browser speech
  tryPlayFile(basePath, item, 0);
}

function tryPlayFile(basePath, item, extIndex) {
  if (extIndex >= AUDIO_EXTENSIONS.length) {
    speakFallback(item);
    return;
  }
  const url = `${basePath}${item.id}.${AUDIO_EXTENSIONS[extIndex]}`;
  const audio = new Audio(url);
  let settled = false;

  audio.addEventListener("canplaythrough", () => {
    if (settled) return;
    settled = true;
    audio.play().catch(() => speakFallback(item));
  });
  audio.addEventListener("error", () => {
    if (settled) return;
    settled = true;
    tryPlayFile(basePath, item, extIndex + 1);
  });
}

function speakFallback(item) {
  state.usedFallbackAudio = true;
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(item.spoken);
  utter.lang = state.moduleData.fallbackLang || "es-ES";
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

init();

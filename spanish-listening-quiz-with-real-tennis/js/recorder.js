const $ = (id) => document.getElementById(id);
let modules = [], data = null, keys = new Set(), cur = null;
let recorder = null, chunks = [], stream = null;

const keyOf = (item) => data.audioPath + item.id;
const status = (msg, cls = "") => { $("rec-status").textContent = msg; $("rec-status").className = "feedback-row " + cls; };
const tileOf = (item) => $("item-grid").querySelector(`[data-id="${CSS.escape(item.id)}"]`);

async function init() {
  modules = await (await fetch("data/modules.json")).json();
  $("set-select").innerHTML = modules.map((m, i) => `<option value="${i}">${m.label}</option>`).join("");
  $("set-select").addEventListener("change", loadSet);
  $("rec-btn").addEventListener("click", toggleRecord);
  $("play-btn").addEventListener("click", playCurrent);
  $("del-btn").addEventListener("click", deleteCurrent);
  $("next-btn").addEventListener("click", () => select(nextUnrecorded()));
  $("zip-btn").addEventListener("click", downloadZip);
  $("clear-btn").addEventListener("click", clearAll);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.tagName === "SELECT") return; // leave the set dropdown alone
    e.preventDefault();
    selectNextItem();
  });
  loadSet();
}

async function loadSet() {
  data = await (await fetch(modules[$("set-select").value].dataFile)).json();
  keys = new Set(await RecStore.keys());
  const grid = $("item-grid");
  grid.innerHTML = "";
  grid.classList.toggle("art-grid", data.items.some((i) => i.art));
  data.items.forEach((item) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "listen-tile" + (keys.has(keyOf(item)) ? " done" : "");
    t.dataset.id = item.id;
    t.innerHTML = item.art && typeof pixelArtURL === "function" ? `<img class="pix" alt="${item.label}" src="${pixelArtURL(item.art)}">` : item.label;
    t.addEventListener("click", () => select(item));
    grid.appendChild(t);
  });
  select(nextUnrecorded(-1));
}

function nextUnrecorded(from) {
  const items = data.items;
  const start = from === undefined ? items.indexOf(cur) : from;
  for (let i = 1; i <= items.length; i++) {
    const it = items[(start + i) % items.length];
    if (!keys.has(keyOf(it))) return it;
  }
  return cur || items[0];
}

// Right-arrow shortcut: move to the next item in list order (wraps around).
function selectNextItem() {
  const items = data.items;
  select(items[(items.indexOf(cur) + 1) % items.length]);
}

function select(item) {
  if (recorder && recorder.state === "recording") return;
  cur = item;
  document.querySelectorAll(".listen-tile.current").forEach((t) => t.classList.remove("current"));
  const t = tileOf(item);
  if (t) { t.classList.add("current"); t.scrollIntoView({ block: "nearest" }); }
  $("rec-label").textContent = item.label;
  $("rec-spoken").textContent = item.spoken;
  refresh();
  status("");
}

function refresh() {
  const has = keys.has(keyOf(cur));
  $("play-btn").disabled = !has;
  $("del-btn").disabled = !has;
  const done = data.items.filter((i) => keys.has(keyOf(i))).length;
  $("rec-progress").textContent = `${done} of ${data.items.length} recorded in this set`;
}

async function toggleRecord() {
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    status("Microphone blocked or unavailable.", "incorrect");
    return;
  }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  chunks = [];
  const item = cur;
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    // reset the button right away so it never hangs on "Stop"
    $("rec-btn").textContent = "Record";
    $("rec-btn").classList.remove("recording");
    const type = recorder.mimeType || mime || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : "webm";
    try {
      await RecStore.put(keyOf(item), { blob: new Blob(chunks, { type }), ext, savedAt: Date.now() });
      keys.add(keyOf(item));
      const t = tileOf(item);
      if (t) t.classList.add("done");
      refresh();
      status(`Saved ${item.label}.`, "correct");
      playCurrent();
    } catch (err) {
      status("Could not save the recording: " + (err && err.message ? err.message : err), "incorrect");
    }
  };
  recorder.start();
  $("rec-btn").textContent = "Stop";
  $("rec-btn").classList.add("recording");
  status("Recording… say it, then tap Stop.");
}

async function playCurrent() {
  const rec = await RecStore.get(keyOf(cur));
  if (rec) new Audio(URL.createObjectURL(rec.blob)).play().catch(() => {});
}

async function deleteCurrent() {
  await RecStore.del(keyOf(cur));
  keys.delete(keyOf(cur));
  tileOf(cur).classList.remove("done");
  refresh();
  status("Deleted.");
}

async function clearAll() {
  if (!confirm("Delete ALL local recordings in this browser? Download the ZIP first if they are needed.")) return;
  for (const k of await RecStore.keys()) await RecStore.del(k);
  await loadSet();
  status("All local recordings cleared.");
}

async function downloadZip() {
  const all = await RecStore.all();
  if (!all.length) { status("Nothing recorded yet."); return; }
  const files = [];
  for (const r of all) files.push({ name: `${r.key}.${r.ext}`, data: new Uint8Array(await r.blob.arrayBuffer()) });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(buildZip(files));
  a.download = "oido-recordings.zip";
  a.click();
  status(`ZIP with ${files.length} recordings downloaded.`, "correct");
}

init();

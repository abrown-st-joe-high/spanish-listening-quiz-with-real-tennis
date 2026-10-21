const $ = (id) => document.getElementById(id);
let sets = [], set = null, keys = new Set(), cur = null, pid = "";
let recorder = null, chunks = [], stream = null;

const keyOf = (item) => Tenis.key(pid, item);
const status = (msg, cls = "") => { $("rec-status").textContent = msg; $("rec-status").className = "feedback-row " + cls; };
const tileOf = (item) => $("item-grid").querySelector(`[data-id="${CSS.escape(item.id)}"]`);

async function init() {
  sets = Tenis.build(await (await fetch("data/tenis.json")).json());
  $("set-select").innerHTML = sets.map((s, i) => `<option value="${i}">${s.label}</option>`).join("");
  $("set-select").addEventListener("change", loadSet);
  $("use-btn").addEventListener("click", usePlayer);
  $("p-id").addEventListener("change", () => { const n = Tenis.players()[Tenis.slug($("p-id").value)]; if (n) $("p-name").value = n; });
  $("rec-btn").addEventListener("click", toggleRecord);
  $("play-btn").addEventListener("click", playCurrent);
  $("del-btn").addEventListener("click", deleteCurrent);
  $("next-btn").addEventListener("click", () => select(nextUnrecorded()));
  $("zip-btn").addEventListener("click", downloadZip);
  $("clear-btn").addEventListener("click", clearAll);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" || e.altKey || e.ctrlKey || e.metaKey) return;
    if (["SELECT", "INPUT"].includes(e.target.tagName)) return;
    e.preventDefault();
    select(set.items[(set.items.indexOf(cur) + 1) % set.items.length]);
  });
  const last = localStorage.getItem("tenis-last");
  if (last) { $("p-id").value = last; $("p-name").value = Tenis.players()[last] || ""; pid = last; }
  listPlayers();
  loadSet();
}

function listPlayers() {
  $("p-list").innerHTML = Object.keys(Tenis.players()).map((id) => `<option value="${id}">`).join("");
}

function usePlayer() {
  const id = Tenis.slug($("p-id").value);
  if (!id) { status("Enter a player ID first.", "incorrect"); return; }
  pid = id;
  $("p-id").value = id;
  Tenis.savePlayer(id, $("p-name").value.trim());
  localStorage.setItem("tenis-last", id);
  listPlayers();
  loadSet();
  status(`Recording as ${$("p-name").value || id}.`, "correct");
}

async function loadSet() {
  set = sets[$("set-select").value];
  keys = new Set(await RecStore.keys());
  const grid = $("item-grid");
  grid.innerHTML = "";
  set.items.forEach((item) => {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "listen-tile" + (pid && keys.has(keyOf(item)) ? " done" : "");
    t.dataset.id = item.id;
    t.textContent = (item.kind === "q" ? "? " : "→ ") + item.text;
    t.addEventListener("click", () => select(item));
    grid.appendChild(t);
  });
  select(nextUnrecorded(-1));
}

function nextUnrecorded(from) {
  const items = set.items, start = from === undefined ? items.indexOf(cur) : from;
  for (let i = 1; i <= items.length; i++) {
    const it = items[(start + i) % items.length];
    if (!pid || !keys.has(keyOf(it))) return it;
  }
  return cur || items[0];
}

function select(item) {
  if (recorder && recorder.state === "recording") return;
  cur = item;
  document.querySelectorAll(".listen-tile.current").forEach((t) => t.classList.remove("current"));
  const t = tileOf(item);
  if (t) { t.classList.add("current"); t.scrollIntoView({ block: "nearest" }); }
  $("rec-label").textContent = item.text;
  $("rec-spoken").textContent = item.kind === "q" ? "Question" : "Response";
  refresh();
  status("");
}

function refresh() {
  const has = !!pid && keys.has(keyOf(cur));
  $("play-btn").disabled = !has;
  $("del-btn").disabled = !has;
  const done = pid ? set.items.filter((i) => keys.has(keyOf(i))).length : 0;
  $("rec-progress").textContent = pid ? `${$("p-name").value || pid}: ${done} of ${set.items.length} recorded in this set` : "Enter a player name and ID to start.";
}

async function toggleRecord() {
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
  if (!pid) { status("Enter a player name and ID, then tap Use this player.", "incorrect"); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    status("Microphone blocked or unavailable.", "incorrect");
    return;
  }
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
  chunks = [];
  const item = cur, k = keyOf(item);
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    const type = recorder.mimeType || mime || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : "webm";
    await RecStore.put(k, { blob: new Blob(chunks, { type }), ext, savedAt: Date.now() });
    keys.add(k);
    const t = tileOf(item);
    if (t) t.classList.add("done");
    $("rec-btn").textContent = "Record";
    $("rec-btn").classList.remove("recording");
    refresh();
    status(`Saved ${item.text}`, "correct");
    playCurrent();
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
  if (!confirm("Delete ALL Equipo de Tenis recordings in this browser? Download the ZIP first if they are needed.")) return;
  for (const k of await RecStore.keys()) if (k.startsWith("audio/tenis/")) await RecStore.del(k);
  await loadSet();
  status("Local tenis recordings cleared.");
}

async function downloadZip() {
  const all = (await RecStore.all()).filter((r) => r.key.startsWith("audio/tenis/"));
  if (!all.length) { status("Nothing recorded yet."); return; }
  const files = [];
  for (const r of all) files.push({ name: `${r.key}.${r.ext}`, data: new Uint8Array(await r.blob.arrayBuffer()) });
  const used = new Set(all.map((r) => r.key.split("/")[2])), names = {};
  for (const [id, n] of Object.entries(Tenis.players())) if (used.has(id)) names[id] = n;
  files.push({ name: "audio/tenis/players.json", data: new TextEncoder().encode(JSON.stringify(names, null, 2)) });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(buildZip(files));
  a.download = "tenis-recordings.zip";
  a.click();
  status(`ZIP with ${all.length} recordings downloaded.`, "correct");
}

init();

const $ = (id) => document.getElementById(id);
let sets = [], token = 0, release = null, skip = false;

async function init() {
  sets = Tenis.build(await (await fetch("data/tenis.json")).json());
  $("set-select").innerHTML = `<option value="all">All sets</option>` + sets.map((s, i) => `<option value="${i}">${s.label}</option>`).join("");
  const ps = await Tenis.allPlayers(), opts = Object.entries(ps).map(([id, n]) => `<option value="${id}">${n} (${id})</option>`).join("");
  $("pq").innerHTML = opts;
  $("pa").innerHTML = opts;
  if ($("pa").options.length > 1) $("pa").selectedIndex = 1;
  if (!opts) $("msg").textContent = "No players yet. Record two players first.";
  $("go-btn").addEventListener("click", () => (token && running ? stopRun() : run()));
  $("next-btn").addEventListener("click", () => release && release());
  $("mode").addEventListener("change", () => { if (running) run(); });
  const typing = (t) => t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "checkbox");
  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space" || typing(e.target)) return;
    e.preventDefault(); // stops a focused button/checkbox from also "clicking"
    if (e.repeat) return;
    if (e.target !== document.body) e.target.blur();
    if (release) release();
    else if (running) { skip = true; Tenis.stop(); } // pressed while audio plays: skip it
  });
  document.addEventListener("keyup", (e) => { if (e.code === "Space" && !typing(e.target)) e.preventDefault(); });
  // don't leave focus on buttons/checkboxes after a click
  document.addEventListener("click", (e) => { if (e.target.matches("button, input[type=checkbox]")) e.target.blur(); });
}

let running = false;
function stopRun() {
  token++; running = false; skip = false; Tenis.stop();
  release && release();
  $("go-btn").textContent = "Start";
  $("next-btn").disabled = true;
}

function wait(t, auto) {
  if (skip) { skip = false; return Promise.resolve(); }
  return new Promise((res) => {
    let tm = 0;
    const done = () => { clearTimeout(tm); if (release === done) release = null; res(); };
    release = done;
    if (auto) tm = setTimeout(done, parseFloat($("delay").value || 2) * 1000);
  });
}

const hintOn = () => $("hint").checked;
const hintOf = (ans) => (ans.text.startsWith("No") ? "No…" : "Sí…"); // tells the listener which way to answer

function pool() {
  const v = $("set-select").value;
  return v === "all" ? sets.flatMap((s) => s.pairs) : sets[+v].pairs;
}

async function run() {
  stopRun();
  const t = ++token, solo = $("mode").value === "solo";
  const qp = $("pq").value, ap = $("pa").value, show = () => $("show").checked, msg = $("msg");
  if (!qp || !ap) { msg.textContent = "Pick two players."; return; }
  running = true;
  $("go-btn").textContent = "Stop";
  $("next-btn").disabled = false;
  const auto = $("adv").value === "delay";
  while (t === token) {
    const items = pool();
    const pair = items[(Math.random() * items.length) | 0];
    const ans = pair.as[(Math.random() * pair.as.length) | 0];
    $("q-text").textContent = show() ? pair.q.text : "…";
    $("a-text").textContent = hintOn() ? hintOf(ans) : "";
    msg.textContent = "";
    if (!(await Tenis.play(qp, pair.q)) && t === token) msg.textContent = `No recording for “${pair.q.text}” from ${qp}.`;
    if (t !== token) return;
    msg.textContent = solo ? "Your turn: answer out loud, then press space." : msg.textContent;
    await wait(t, solo ? false : auto);
    if (t !== token) return;
    $("a-text").textContent = show() ? ans.text : hintOn() ? hintOf(ans) : "";
    msg.textContent = "";
    if (!(await Tenis.play(ap, ans)) && t === token) msg.textContent = `No recording for “${ans.text}” from ${ap}.`;
    if (t !== token) return;
    await wait(t, auto);
  }
}

init();

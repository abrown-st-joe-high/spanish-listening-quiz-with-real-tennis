/* Shared by tenis-record.html and tenis.html. Needs js/store.js (RecStore) loaded first. */
const Tenis = (() => {
  const PERSONS = ["yo", "tú", "él", "ella", "usted", "nosotros", "ustedes"];
  // who answers a question about person X (the answerer's own point of view)
  const ANSWERER = { yo: "tú", "tú": "yo", "él": "él", ella: "ella", usted: "yo", nosotros: "ustedes", ustedes: "nosotros" };
  const conjKey = (p) => (p === "ella" || p === "usted" ? "él" : p);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const mk = (kind, text) => ({ id: kind + "-" + slug(text), kind, text });

  function addSet(sets, label, pairs) {
    const qs = new Map(), as = new Map(), out = [];
    for (const p of pairs) {
      const q = mk("q", p.q);
      qs.set(q.id, q);
      out.push({ q, as: p.a.map((t) => { const a = mk("a", t); as.set(a.id, a); return a; }) });
    }
    sets.push({ label, items: [...qs.values(), ...as.values()], pairs: out });
  }

  // Turn the JSON config into sets: [{label, items:[{id,kind,text}], pairs:[{q, as:[...]}]}]
  function build(cfg) {
    const sets = [];
    for (const v of cfg.verbs || []) {
      const pairs = [];
      for (const p of PERSONS) {
        const c = v[conjKey(p)];
        if (!c) continue;
        const ap = ANSWERER[p], ac = v[conjKey(ap)];
        const a = [`Sí, ${ac}`, `Sí, ${ap} ${ac}`, `No, no ${ac}`, `No, ${ap} no ${ac}`];
        pairs.push({ q: `¿${cap(p)} ${c}?`, a });
        if ((cfg.bare || []).includes(p)) pairs.push({ q: `¿${cap(c)}?`, a });
      }
      addSet(sets, v.inf, pairs);
    }
    for (const e of cfg.extra || []) addSet(sets, e.set, e.pairs);
    return sets;
  }

  /* players: id -> name (this browser), plus optional published audio/tenis/players.json */
  const players = () => JSON.parse(localStorage.getItem("tenis-players") || "{}");
  const savePlayer = (id, name) => localStorage.setItem("tenis-players", JSON.stringify({ ...players(), [id]: name || id }));
  async function allPlayers() {
    let pub = {};
    try { pub = await (await fetch("audio/tenis/players.json")).json(); } catch (e) {}
    return { ...pub, ...players() };
  }

  const key = (pid, item) => `audio/tenis/${pid}/${item.id}`;

  /* playback: local recording first, then published file (.webm / .m4a). Resolves false if nothing plays. */
  let cur = null;
  const stop = () => { if (cur) { cur.pause(); cur = null; } };
  async function play(pid, item) {
    stop();
    const k = key(pid, item), rec = await RecStore.get(k);
    const urls = rec ? [URL.createObjectURL(rec.blob)] : [k + ".webm", k + ".m4a"];
    for (const u of urls) {
      try {
        await new Promise((res, rej) => { const a = new Audio(u); cur = a; a.onended = res; a.onpause = res; a.onerror = rej; a.play().catch(rej); });
        return true;
      } catch (e) {}
    }
    return false;
  }

  return { build, slug, players, savePlayer, allPlayers, key, play, stop };
})();

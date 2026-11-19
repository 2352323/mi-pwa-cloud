(() => {
  "use strict";

  /* ---------- Datos: esquemas tácticos ----------
     Coordenadas en % dentro de la cancha. x: 0 izquierda → 100 derecha.
     y: 0 arco rival → 100 arco propio. Orden fijo: portero, defensas, medios, delanteros. */
  const FORMATIONS = {
    "4-3-3": {
      desc: "Tres delanteros abiertos y un medio campo de tres que reparte el juego. Es el esquema de los equipos que quieren el balón y presionan arriba.",
      pro: "Amplitud en ataque y superioridad cerca del balón cuando se pierde.",
      con: "Los laterales quedan expuestos si los extremos no vuelven a marcar.",
      slots: [
        [50, 92, "Portero"],
        [14, 72, "Lateral"], [38, 76, "Central"], [62, 76, "Central"], [86, 72, "Lateral"],
        [28, 52, "Interior"], [50, 58, "Pivote"], [72, 52, "Interior"],
        [18, 24, "Extremo"], [50, 18, "Delantero"], [82, 24, "Extremo"]
      ]
    },
    "4-4-2": {
      desc: "Dos líneas de cuatro y una pareja de delanteros. Es el esquema más equilibrado y fácil de entender: cada jugador sabe su zona.",
      pro: "Orden defensivo y dos referencias claras para el pase largo.",
      con: "Con solo dos medios centrales se pierde la mitad de la cancha.",
      slots: [
        [50, 92, "Portero"],
        [14, 72, "Lateral"], [38, 76, "Central"], [62, 76, "Central"], [86, 72, "Lateral"],
        [12, 50, "Volante"], [38, 54, "Volante"], [62, 54, "Volante"], [88, 50, "Volante"],
        [38, 20, "Delantero"], [62, 20, "Delantero"]
      ]
    },
    "3-5-2": {
      desc: "Tres centrales, dos carrileros que suben y bajan toda la banda, y un medio campo de tres. Busca dominar el centro y llegar con muchos hombres.",
      pro: "Mayoría en el medio campo y dos delanteros bien acompañados.",
      con: "Los carrileros deben recorrer toda la banda y se cansan primero.",
      slots: [
        [50, 92, "Portero"],
        [24, 76, "Central"], [50, 80, "Líbero"], [76, 76, "Central"],
        [8, 48, "Carrilero"], [30, 56, "Medio"], [50, 60, "Pivote"], [70, 56, "Medio"], [92, 48, "Carrilero"],
        [38, 20, "Delantero"], [62, 20, "Delantero"]
      ]
    },
    "4-2-3-1": {
      desc: "Dos pivotes protegen la defensa y tres mediapuntas apoyan a un único delantero. Da equilibrio y mucha libertad al jugador de enlace.",
      pro: "Doble escudo en el centro y un 10 que conecta con el '9'.",
      con: "El delantero puede quedar aislado si los mediapuntas no llegan.",
      slots: [
        [50, 92, "Portero"],
        [14, 72, "Lateral"], [38, 76, "Central"], [62, 76, "Central"], [86, 72, "Lateral"],
        [36, 58, "Pivote"], [64, 58, "Pivote"],
        [18, 36, "Extremo"], [50, 38, "Enganche"], [82, 36, "Extremo"],
        [50, 16, "Delantero"]
      ]
    }
  };

  const PITCH = { x: 20, y: 20, w: 640, h: 840 }; // coincide con el SVG
  const STORE_KEY = "pizarra-v1";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (id) => document.getElementById(id);
  const svg = $("board");
  const playersLayer = $("players");
  const nameInput = $("player-name");
  const nameLabel = $("player-label");
  const toast = $("toast");

  /* ---------- Estado ---------- */
  const state = { formation: "4-3-3", pos: [], names: Array(11).fill(""), selected: null };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY));
      if (saved && FORMATIONS[saved.formation] && saved.pos?.length === 11 && saved.names?.length === 11) {
        state.formation = saved.formation;
        state.pos = saved.pos;
        state.names = saved.names.map((n) => String(n).slice(0, 14));
        return true;
      }
    } catch (_) { /* sin almacenamiento: seguimos en memoria */ }
    return false;
  }
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        formation: state.formation, pos: state.pos, names: state.names
      }));
    } catch (_) { /* ignorar */ }
  }

  const formationPos = (key) => FORMATIONS[key].slots.map(([x, y]) => ({ x, y }));
  const toSvg = (p) => ({ x: PITCH.x + (p.x / 100) * PITCH.w, y: PITCH.y + (p.y / 100) * PITCH.h });

  /* ---------- Cancha: franjas de césped ---------- */
  (function drawStripes() {
    const g = $("stripes");
    const n = 10, h = PITCH.h / n;
    for (let i = 0; i < n; i++) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("x", PITCH.x);
      r.setAttribute("y", PITCH.y + i * h);
      r.setAttribute("width", PITCH.w);
      r.setAttribute("height", h + 0.5);
      r.setAttribute("fill", i % 2 ? "#124a37" : "#15563f");
      g.appendChild(r);
    }
  })();

  /* ---------- Jugadores ---------- */
  const NS = "http://www.w3.org/2000/svg";
  const nodes = [];

  function makePlayer(i) {
    const g = document.createElementNS(NS, "g");
    g.classList.add("player");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.dataset.i = i;

    const kit = document.createElementNS(NS, "circle");
    kit.setAttribute("r", 27);
    kit.classList.add("kit");
    const num = document.createElementNS(NS, "text");
    num.classList.add("num");
    num.textContent = i + 1;
    const tag = document.createElementNS(NS, "text");
    tag.classList.add("tag");
    tag.setAttribute("y", 52);

    g.append(kit, num, tag);
    playersLayer.appendChild(g);
    nodes.push({ g, tag });
  }

  function paintPlayer(i) {
    const { g, tag } = nodes[i];
    const p = toSvg(state.pos[i]);
    g.style.transform = `translate(${p.x}px, ${p.y}px)`;
    const role = FORMATIONS[state.formation].slots[i][2];
    const name = state.names[i];
    tag.textContent = name || role;
    tag.classList.toggle("role", !name);
    g.setAttribute("aria-label", `Jugador ${i + 1}, ${name || role}`);
    g.classList.toggle("selected", state.selected === i);
  }
  const paintAll = () => nodes.forEach((_, i) => paintPlayer(i));

  /* ---------- Selección y nombre ---------- */
  function select(i) {
    state.selected = i;
    paintAll();
    const role = FORMATIONS[state.formation].slots[i][2];
    nameInput.disabled = false;
    nameInput.value = state.names[i];
    nameLabel.textContent = `Nombre del jugador ${i + 1} (${role})`;
  }
  nameInput.addEventListener("input", () => {
    if (state.selected == null) return;
    state.names[state.selected] = nameInput.value.trim();
    paintPlayer(state.selected);
    save();
  });
  $("player-form").addEventListener("submit", (e) => e.preventDefault());

  /* ---------- Arrastrar ---------- */
  let drag = null;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function svgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  svg.addEventListener("pointerdown", (e) => {
    const g = e.target.closest(".player");
    if (!g) return;
    const i = Number(g.dataset.i);
    const p = svgPoint(e);
    const cur = toSvg(state.pos[i]);
    drag = { i, dx: cur.x - p.x, dy: cur.y - p.y, moved: false };
    g.classList.add("dragging");
    g.setPointerCapture(e.pointerId);
    select(i);
  });

  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = svgPoint(e);
    const x = clamp(p.x + drag.dx, PITCH.x + 10, PITCH.x + PITCH.w - 10);
    const y = clamp(p.y + drag.dy, PITCH.y + 10, PITCH.y + PITCH.h - 40);
    state.pos[drag.i] = {
      x: ((x - PITCH.x) / PITCH.w) * 100,
      y: ((y - PITCH.y) / PITCH.h) * 100
    };
    drag.moved = true;
    paintPlayer(drag.i);
  });

  function endDrag() {
    if (!drag) return;
    nodes[drag.i].g.classList.remove("dragging");
    if (drag.moved) save();
    drag = null;
  }
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  /* Teclado: flechas mueven al jugador enfocado */
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest(".player");
    if (!g) return;
    const i = Number(g.dataset.i);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); nameInput.focus(); return; }
    const step = e.shiftKey ? 5 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    state.pos[i] = { x: clamp(state.pos[i].x + d[0], 2, 98), y: clamp(state.pos[i].y + d[1], 2, 94) };
    select(i);
    g.focus();
    save();
  });

  /* ---------- Esquemas ---------- */
  const formWrap = $("formations");
  Object.keys(FORMATIONS).forEach((key) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.textContent = key;
    b.dataset.key = key;
    b.addEventListener("click", () => setFormation(key, true));
    formWrap.appendChild(b);
  });

  function renderNotes() {
    const f = FORMATIONS[state.formation];
    $("f-name").textContent = state.formation;
    $("f-desc").textContent = f.desc;
    $("f-pro").textContent = f.pro;
    $("f-con").textContent = f.con;
    formWrap.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-checked", String(b.dataset.key === state.formation)));
  }

  function setFormation(key, resetPos) {
    state.formation = key;
    if (resetPos) state.pos = formationPos(key);
    renderNotes();
    paintAll();
    if (state.selected != null) select(state.selected);
    save();
  }

  $("reset").addEventListener("click", () => {
    state.pos = formationPos(state.formation);
    paintAll();
    save();
    say("Esquema restablecido");
  });

  $("copy").addEventListener("click", async () => {
    const f = FORMATIONS[state.formation];
    const lines = state.pos.map((_, i) => `${i + 1}. ${state.names[i] || "—"} (${f.slots[i][2]})`);
    const text = `Mi once · ${state.formation}\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      say("Alineación copiada");
    } catch (_) {
      say("No se pudo copiar. Selecciona el texto manualmente.");
    }
  });

  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.textContent = ""), 2600);
  }

  /* ---------- Arranque ---------- */
  for (let i = 0; i < 11; i++) makePlayer(i);
  const hadSaved = load();
  if (!hadSaved) state.pos = formationPos(state.formation);
  renderNotes();

  if (!reduceMotion && !hadSaved) {
    // Entrada: todos parten del círculo central y se abren a su posición
    const center = { x: 50, y: 50 };
    const target = state.pos;
    state.pos = target.map(() => ({ ...center }));
    nodes.forEach((n) => (n.g.style.transition = "none"));
    paintAll();
    void svg.getBoundingClientRect();
    requestAnimationFrame(() => {
      nodes.forEach((n, i) => (n.g.style.transition = `transform .9s cubic-bezier(.2,.9,.25,1) ${i * 45}ms`));
      state.pos = target;
      paintAll();
      setTimeout(() => nodes.forEach((n) => (n.g.style.transition = "")), 1800);
    });
  } else {
    paintAll();
  }

  /* ---------- Estado en la nube / PWA ---------- */
  const stHost = $("st-host"), stNet = $("st-net"), stSw = $("st-sw"), stMode = $("st-mode");
  stHost.textContent = location.hostname || "local";
  const paintNet = () => (stNet.textContent = navigator.onLine ? "En línea" : "Sin conexión");
  paintNet();
  addEventListener("online", paintNet);
  addEventListener("offline", paintNet);

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  stMode.textContent = standalone ? "App instalada" : "Página web";

  if ("serviceWorker" in navigator) {
    stSw.textContent = "Activándose…";
    navigator.serviceWorker.register("service-worker.js").then(() => navigator.serviceWorker.ready)
      .then(() => (stSw.textContent = "Listo"))
      .catch(() => (stSw.textContent = "No disponible"));
  } else {
    stSw.textContent = "No disponible";
  }

  let deferred;
  const installBtn = $("install");
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    installBtn.hidden = true;
  });
  addEventListener("appinstalled", () => { installBtn.hidden = true; stMode.textContent = "App instalada"; });
})();

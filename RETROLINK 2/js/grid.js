// Draws the game library: rows of four, search box, category buttons.
// In dev mode the cards can also be edited and dragged into a new order.
(function () {
  const names = window.RETROLINK_CONSOLES || {};

  const gridEl = document.getElementById("grid");
  const tabsEl = document.getElementById("tabs");
  const searchEl = document.getElementById("search");
  const emptyEl = document.getElementById("empty");

  let category = "all";
  let query = "";
  let onOpen = function () {};
  let dragId = null;

  function devOn() { return !!(window.RetroDev && RetroDev.isActive()); }
  function currentGames() { return devOn() ? RetroDev.games() : (window.RETROLINK_LIBRARY || []); }
  function categoryLabel(key) { return names[key] || key.toUpperCase(); }

  function drawTabs(games) {
    // Only show categories that actually have games.
    const keys = [];
    games.forEach(g => { if (keys.indexOf(g.console) === -1) keys.push(g.console); });
    if (category !== "all" && keys.indexOf(category) === -1) category = "all";
    const list = [{ key: "all", label: "All" }].concat(keys.map(k => ({ key: k, label: categoryLabel(k) })));
    tabsEl.textContent = "";
    list.forEach(item => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = item.label;
      b.setAttribute("aria-pressed", String(item.key === category));
      b.addEventListener("click", function () { category = item.key; refresh(); });
      tabsEl.appendChild(b);
    });
  }

  function matches(g) {
    if (category !== "all" && g.console !== category) return false;
    if (!query) return true;
    return (g.title + " " + categoryLabel(g.console)).toLowerCase().indexOf(query) !== -1;
  }

  function clearMarks() {
    gridEl.querySelectorAll(".drop-before, .drop-after").forEach(el => el.classList.remove("drop-before", "drop-after"));
  }

  function makeCard(g, dev) {
    const wrap = document.createElement("div");
    wrap.className = "card-wrap";
    wrap.dataset.id = g.id;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.setAttribute("aria-label", "Play " + g.title);

    const img = document.createElement("img");
    img.src = g.cover;
    img.alt = "";
    img.draggable = false;
    img.loading = "lazy";
    img.addEventListener("error", function () { img.classList.add("broken"); });

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = g.title;

    const tag = document.createElement("span");
    tag.className = "card-tag";
    tag.textContent = categoryLabel(g.console);

    card.append(img, title, tag);
    card.addEventListener("click", function () { onOpen(g); });
    wrap.appendChild(card);

    if (dev) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "edit-btn";
      editBtn.textContent = "Edit";
      editBtn.setAttribute("aria-label", "Edit " + g.title);
      editBtn.addEventListener("click", function () { RetroDev.edit(g.id); });
      wrap.appendChild(editBtn);

      wrap.draggable = true;
      wrap.addEventListener("dragstart", function (e) {
        dragId = g.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/x-retrolink-card", g.id);
        wrap.classList.add("dragging");
      });
      wrap.addEventListener("dragend", function () { dragId = null; wrap.classList.remove("dragging"); clearMarks(); });
      wrap.addEventListener("dragover", function (e) {
        if (!dragId || dragId === g.id) return;
        e.preventDefault();
        const r = wrap.getBoundingClientRect();
        const after = e.clientX > r.left + r.width / 2;
        clearMarks();
        wrap.classList.add(after ? "drop-after" : "drop-before");
      });
      wrap.addEventListener("drop", function (e) {
        if (!dragId || dragId === g.id) return;
        e.preventDefault();
        e.stopPropagation();
        const r = wrap.getBoundingClientRect();
        const id = dragId;
        clearMarks();
        RetroDev.move(id, g.id, e.clientX > r.left + r.width / 2);
      });
    }
    return wrap;
  }

  function drawGrid(games) {
    gridEl.textContent = "";
    const dev = devOn();
    const shown = games.filter(matches);
    shown.forEach(g => gridEl.appendChild(makeCard(g, dev)));

    if (shown.length === 0) {
      emptyEl.hidden = false;
      emptyEl.textContent = games.length === 0
        ? (dev ? "No games yet. Drag game files onto this page to add them." : "No games yet.")
        : "No games match your search. Try a different word or choose All.";
    } else {
      emptyEl.hidden = true;
    }
  }

  function refresh() {
    const games = currentGames();
    drawTabs(games);
    drawGrid(games);
  }

  let started = false;
  window.RetroGrid = {
    start: function (openHandler) {
      if (openHandler) onOpen = openHandler;
      if (!started) {
        started = true;
        searchEl.addEventListener("input", function () {
          query = searchEl.value.trim().toLowerCase();
          refresh();
        });
        // Dropping a card on empty space in the grid moves it to the end.
        gridEl.addEventListener("dragover", function (e) { if (dragId && e.target === gridEl) e.preventDefault(); });
        gridEl.addEventListener("drop", function (e) {
          if (dragId && e.target === gridEl) { e.preventDefault(); const id = dragId; clearMarks(); RetroDev.move(id, null, true); }
        });
      }
      refresh();
    },
    refresh: refresh
  };
})();

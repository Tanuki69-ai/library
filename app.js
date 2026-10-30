(function () {
  const app = document.getElementById("app");
  document.getElementById("year").textContent = new Date().getFullYear();

  const SPINE_COLORS = ["#6b4324", "#7a3e22", "#4a2e17", "#8b5a2b", "#5e3a1c", "#73502c", "#3f2a18", "#8a4a2e"];
  let books = [];
  let fontScale = 1;

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.setAttribute("style", v);
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) n.appendChild(c);
    return n;
  }

  const findBook = id => books.find(b => b.id === id);

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    app.innerHTML = "";
    window.onscroll = null;
    if (parts[0] === "book" && findBook(parts[1])) {
      const book = findBook(parts[1]);
      if (parts[2] !== undefined && book.chapters[parts[2]]) return renderChapter(book, Number(parts[2]));
      return renderBook(book);
    }
    renderShelf();
  }

  function renderShelf() {
    if (books.length === 0) {
      app.appendChild(el("p", { class: "empty", text: "На полке пока пусто." }));
      return;
    }
    // Разбиваем книги на полки по 8 штук
    const perShelf = 8;
    for (let s = 0; s < books.length; s += perShelf) {
      const group = books.slice(s, s + perShelf);
      const shelf = el("section", { class: "shelf" }, [
        el("div", { class: "shelf-label", text: `Полка ${Math.floor(s / perShelf) + 1}` }),
        el("div", { class: "spines" }, group.map((book, k) => {
          const h = 170 + ((s + k) * 37) % 50;
          const color = book.color || SPINE_COLORS[(s + k) % SPINE_COLORS.length];
          return el("a", {
            class: "spine",
            href: `#/book/${book.id}`,
            title: book.title,
            style: `--h:${h}px;--spine:${color}`
          }, [el("span", { class: "spine-title", text: book.title })]);
        })),
        el("div", { class: "plank" })
      ]);
      app.appendChild(shelf);
    }
  }

  function renderBook(book) {
    const list = el("ul", { class: "catalog" }, book.chapters.map((ch, i) =>
      el("li", {}, [el("a", { href: `#/book/${book.id}/${i}`, text: ch.title || `Глава ${i + 1}` })])
    ));
    app.appendChild(el("article", { class: "book-page" }, [
      el("a", { class: "back", href: "#", text: "← на полку" }),
      el("header", { class: "bookplate" }, [
        el("h2", { text: book.title }),
        el("p", { class: "author", text: book.author || "" }),
        book.desc ? el("p", { class: "desc", text: book.desc }) : null
      ]),
      list
    ]));
  }

  function renderChapter(book, i) {
    const ch = book.chapters[i];
    const n = book.chapters.length;
    const bar = el("div", { class: "reader-bar" }, [
      el("a", { href: `#/book/${book.id}`, text: "← " + book.title }),
      el("div", { class: "size" }, [
        el("button", { text: "A−", onclick: () => resize(-1), "aria-label": "Меньше" }),
        el("button", { text: "A+", onclick: () => resize(1), "aria-label": "Больше" })
      ]),
      el("div", { class: "progress", id: "bar" })
    ]);
    const paragraphs = (ch.text || "").split(/\n\s*\n/).filter(p => p.trim());
    const chapter = el("article", { class: "chapter" }, [
      el("h2", { text: ch.title || `Глава ${i + 1}` }),
      el("div", { class: "ornament", text: "❦ ❦ ❦" }),
      ...paragraphs.map(t => el("p", { text: t }))
    ]);
    const pager = el("nav", { class: "pager" }, [
      el("a", { href: i > 0 ? `#/book/${book.id}/${i - 1}` : "#", class: i > 0 ? "" : "disabled", text: "← Назад" }),
      el("a", { href: `#/book/${book.id}`, text: "Оглавление" }),
      el("a", { href: i < n - 1 ? `#/book/${book.id}/${i + 1}` : "#", class: i < n - 1 ? "" : "disabled", text: "Дальше →" })
    ]);
    app.appendChild(bar);
    app.appendChild(chapter);
    app.appendChild(pager);
    window.scrollTo(0, 0);
    window.onscroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = document.getElementById("bar");
      if (p) p.style.width = h > 0 ? (window.scrollY / h * 100) + "%" : "100%";
    };
  }

  function resize(d) {
    fontScale = Math.min(1.4, Math.max(0.8, fontScale + d * 0.1));
    document.body.style.fontSize = (18 * fontScale) + "px";
  }

  document.getElementById("home").setAttribute("href", "#");
  window.addEventListener("hashchange", route);

  fetch("books.json", { cache: "no-cache" })
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(data => {
      books = Array.isArray(data.books) ? data.books : [];
      route();
    })
    .catch(err => {
      app.innerHTML = "";
      app.appendChild(el("p", { class: "empty", text: "Не удалось загрузить books.json (" + err.message + "). Откройте сайт через локальный сервер или на GitHub Pages." }));
    });
})();

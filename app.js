(function () {
  const app = document.getElementById("app");
  document.getElementById("year").textContent = new Date().getFullYear();

  const SPINE_COLORS = ["#6b4324", "#7a3e22", "#4a2e17", "#8b5a2b", "#5e3a1c", "#73502c", "#3f2a18", "#8a4a2e"];
  const TOKEN_KEY = "library-github-token";

  let books = [];
  let sha = null;
  let fontScale = 1;

  // Репозиторий определяется по адресу: tanuki69-ai.github.io/library/
  const host = location.hostname;
  const owner = host.endsWith(".github.io") ? host.split(".")[0] : "";
  const repo = location.pathname.split("/").filter(Boolean)[0] || "";

  const getToken = () => localStorage.getItem(TOKEN_KEY) || "";

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "style") n.setAttribute("style", v);
      else if (k === "onclick") n.onclick = v;
      else if (k === "disabled") n.disabled = v;
      else n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) n.appendChild(c);
    return n;
  }
  const findBook = id => books.find(b => b.id === id);
  const slugify = s => {
    const latin = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return latin || ("book-" + Date.now().toString(36));
  };
  const uniqueId = base => {
    let id = base, n = 2;
    while (findBook(id)) id = base + "-" + n++;
    return id;
  };

  // ---------- сохранение books.json в репозиторий ----------
  async function saveBooks(message) {
    const token = getToken();
    if (!token) throw new Error("Не задан токен. Откройте «Токен» и вставьте его.");
    if (!owner || !repo) throw new Error("Не удалось определить репозиторий по адресу сайта.");

    const api = `https://api.github.com/repos/${owner}/${repo}/contents/books.json`;
    const headers = {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };

    const cur = await fetch(api, { headers });
    if (!cur.ok) throw new Error("GitHub отказал в доступе (" + cur.status + "). Проверьте токен.");
    sha = (await cur.json()).sha;

    const json = JSON.stringify({ books }, null, 2) + "\n";
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));

    const put = await fetch(api, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message: message || "Обновление книг", content: btoa(bin), sha })
    });
    if (!put.ok) throw new Error("Не сохранилось (" + put.status + "): " + (await put.text()).slice(0, 200));
    sha = (await put.json()).content.sha;
  }

  // ---------- маршруты ----------
  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    app.innerHTML = "";
    window.onscroll = null;

    if (parts[0] === "edit") return renderEditHome(parts);
    if (parts[0] === "settings") return renderSettings();

    if (parts[0] === "book" && findBook(parts[1])) {
      const book = findBook(parts[1]);
      if (parts[2] !== undefined && book.chapters[parts[2]]) return renderChapter(book, Number(parts[2]));
      return renderBook(book);
    }
    renderShelf();
  }

  // ---------- читатель ----------
  function renderShelf() {
    if (books.length === 0) {
      app.appendChild(el("p", { class: "empty", text: "На полке пока пусто." }));
      return;
    }
    const perShelf = 8;
    for (let s = 0; s < books.length; s += perShelf) {
      const group = books.slice(s, s + perShelf);
      app.appendChild(el("section", { class: "shelf" }, [
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
      ]));
    }
  }

  function renderBook(book) {
    app.appendChild(el("article", { class: "book-page" }, [
      el("a", { class: "back", href: "#", text: "← на полку" }),
      el("header", { class: "bookplate" }, [
        el("h2", { text: book.title }),
        el("p", { class: "author", text: book.author || "" }),
        book.desc ? el("p", { class: "desc", text: book.desc }) : null
      ]),
      el("ul", { class: "catalog" }, (book.chapters || []).map((ch, i) =>
        el("li", {}, [el("a", { href: `#/book/${book.id}/${i}`, text: ch.title || `Глава ${i + 1}` })])
      ))
    ]));
  }

  function renderChapter(book, i) {
    const ch = book.chapters[i];
    const n = book.chapters.length;
    app.appendChild(el("div", { class: "reader-bar" }, [
      el("a", { href: `#/book/${book.id}`, text: "← " + book.title }),
      el("div", { class: "size" }, [
        el("button", { text: "A−", onclick: () => resize(-1) }),
        el("button", { text: "A+", onclick: () => resize(1) })
      ]),
      el("div", { class: "progress", id: "bar" })
    ]));
    const paragraphs = (ch.text || "").split(/\n\s*\n/).filter(p => p.trim());
    app.appendChild(el("article", { class: "chapter" }, [
      el("h2", { text: ch.title || `Глава ${i + 1}` }),
      el("div", { class: "ornament", text: "❦ ❦ ❦" }),
      ...paragraphs.map(t => el("p", { text: t }))
    ]));
    app.appendChild(el("nav", { class: "pager" }, [
      el("a", { href: i > 0 ? `#/book/${book.id}/${i - 1}` : "#", class: i > 0 ? "" : "disabled", text: "← Назад" }),
      el("a", { href: `#/book/${book.id}`, text: "Оглавление" }),
      el("a", { href: i < n - 1 ? `#/book/${book.id}/${i + 1}` : "#", class: i < n - 1 ? "" : "disabled", text: "Дальше →" })
    ]));
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

  // ---------- редактор ----------
  function editorBar(active) {
    return el("div", { class: "editor-bar" }, [
      el("a", { href: "#/edit", class: active === "home" ? "on" : "", text: "Мои книги" }),
      el("a", { href: "#/settings", class: active === "settings" ? "on" : "", text: "Токен" })
    ]);
  }

  function renderSettings() {
    const input = el("input", { type: "password", placeholder: "github_pat_…" });
    input.value = getToken();
    const msg = el("p", { class: "status" });
    app.appendChild(editorBar("settings"));
    app.appendChild(el("div", { class: "editor-card" }, [
      el("h2", { class: "page-title", text: "Токен для сохранения" }),
      el("p", { class: "hint", text: "Токен хранится только в этом браузере и отправляется только на GitHub." }),
      el("label", {}, [document.createTextNode("Токен"), input]),
      msg,
      el("div", { class: "actions" }, [
        el("button", { class: "danger", text: "Забыть токен", onclick: () => {
          localStorage.removeItem(TOKEN_KEY); input.value = ""; msg.textContent = "Токен удалён.";
        } }),
        el("button", { class: "primary", text: "Сохранить токен", onclick: () => {
          const v = input.value.trim();
          if (!v) return msg.textContent = "Вставьте токен.";
          localStorage.setItem(TOKEN_KEY, v);
          msg.textContent = "Токен сохранён в этом браузере.";
        } })
      ])
    ]));
  }

  function renderEditHome(parts) {
    if (!getToken()) return (location.hash = "#/settings");
    if (parts[1] === "book") return renderBookForm(parts[2] ? findBook(parts[2]) : null);
    if (parts[1] === "chapter") return renderChapterForm(findBook(parts[2]), parts[3] !== undefined ? Number(parts[3]) : null);

    app.appendChild(editorBar("home"));
    app.appendChild(el("div", { class: "toolbar" }, [
      el("button", { class: "primary", text: "+ Новая книга", onclick: () => (location.hash = "#/edit/book") })
    ]));
    if (books.length === 0) app.appendChild(el("p", { class: "empty", text: "Книг пока нет." }));
    books.forEach(b => {
      app.appendChild(el("div", { class: "editor-row" }, [
        el("div", {}, [
          el("strong", { text: b.title }),
          el("span", { class: "hint", text: `  · ${(b.chapters || []).length} гл.` })
        ]),
        el("div", { class: "tools" }, [
          el("a", { href: `#/book/${b.id}`, text: "открыть" }),
          el("a", { href: `#/edit/book/${b.id}`, text: "изменить" })
        ])
      ]));
    });
  }

  function renderBookForm(book) {
    app.appendChild(editorBar("home"));
    const title = el("input", { type: "text" });
    title.value = book ? book.title : "";
    const author = el("input", { type: "text" });
    author.value = book ? (book.author || "") : "";
    const desc = el("textarea", { rows: "3" });
    desc.value = book ? (book.desc || "") : "";
    const color = el("input", { type: "text", placeholder: "#6b4324 (необязательно)" });
    color.value = book ? (book.color || "") : "";
    const msg = el("p", { class: "status" });

    const chapterList = book
      ? el("ul", { class: "chapter-edit" }, (book.chapters || []).map((ch, i) =>
          el("li", {}, [
            el("span", { text: `${i + 1}. ${ch.title || "Без названия"}` }),
            el("span", { class: "tools" }, [
              el("button", { text: "↑", disabled: i === 0, onclick: () => moveChapter(book, i, -1) }),
              el("button", { text: "↓", disabled: i === book.chapters.length - 1, onclick: () => moveChapter(book, i, 1) }),
              el("a", { href: `#/edit/chapter/${book.id}/${i}`, text: "изменить" }),
              el("button", { class: "danger", text: "удалить", onclick: () => deleteChapter(book, i) })
            ])
          ])
        ))
      : el("p", { class: "hint", text: "Сначала сохраните книгу, потом добавите главы." });

    app.appendChild(el("div", { class: "editor-card" }, [
      el("h2", { class: "page-title", text: book ? "Изменить книгу" : "Новая книга" }),
      el("label", {}, [document.createTextNode("Название"), title]),
      el("label", {}, [document.createTextNode("Автор"), author]),
      el("label", {}, [document.createTextNode("Описание"), desc]),
      el("label", {}, [document.createTextNode("Цвет корешка"), color]),
      msg,
      el("div", { class: "actions" }, [
        book ? el("button", { class: "danger", text: "Удалить книгу", onclick: async () => {
          if (!confirm(`Удалить «${book.title}» вместе с главами?`)) return;
          const backup = books;
          books = books.filter(b => b.id !== book.id);
          try { await saveBooks(`Удалена книга: ${book.title}`); location.hash = "#/edit"; }
          catch (e) { books = backup; msg.textContent = e.message; }
        } }) : el("span"),
        el("button", { class: "primary", text: "Сохранить книгу", onclick: async () => {
          if (!title.value.trim()) return (msg.textContent = "Введите название.");
          const data = {
            title: title.value.trim(),
            author: author.value.trim(),
            desc: desc.value.trim(),
            color: color.value.trim() || undefined,
            chapters: book ? book.chapters : []
          };
          let target;
          if (book) { Object.assign(book, data); target = book; }
          else { target = { id: uniqueId(slugify(data.title)), ...data }; books.push(target); }
          try {
            msg.textContent = "Сохраняю…";
            await saveBooks(`Книга: ${target.title}`);
            location.hash = "#/edit/book/" + target.id;
          } catch (e) { msg.textContent = e.message; }
        } })
      ]),
      el("h3", { class: "section-title", text: "Главы" }),
      chapterList,
      book ? el("div", { class: "actions" }, [
        el("a", { href: `#/edit/chapter/${book.id}`, class: "primary-link", text: "+ Новая глава" })
      ]) : null
    ]));
  }

  async function moveChapter(book, i, d) {
    const j = i + d;
    [book.chapters[i], book.chapters[j]] = [book.chapters[j], book.chapters[i]];
    try { await saveBooks(`Порядок глав: ${book.title}`); route(); }
    catch (e) { alert(e.message); }
  }

  async function deleteChapter(book, i) {
    if (!confirm("Удалить главу?")) return;
    const removed = book.chapters.splice(i, 1);
    try { await saveBooks(`Удалена глава: ${book.title}`); route(); }
    catch (e) { book.chapters.splice(i, 0, ...removed); alert(e.message); }
  }

  function renderChapterForm(book, i) {
    app.appendChild(editorBar("home"));
    if (!book) return app.appendChild(el("p", { class: "empty", text: "Книга не найдена." }));
    const existing = (i !== null && book.chapters[i]) ? book.chapters[i] : null;
    const title = el("input", { type: "text", placeholder: `Глава ${book.chapters.length + 1}` });
    title.value = existing ? existing.title : "";
    const text = el("textarea", { class: "body" });
    text.value = existing ? existing.text : "";
    const msg = el("p", { class: "status" });

    app.appendChild(el("div", { class: "editor-card" }, [
      el("h2", { class: "page-title", text: book.title }),
      el("p", { class: "hint", text: existing ? "Редактирование главы" : "Новая глава" }),
      el("label", {}, [document.createTextNode("Название главы"), title]),
      el("label", {}, [document.createTextNode("Текст"), text]),
      el("p", { class: "hint", text: "Абзацы разделяйте пустой строкой." }),
      msg,
      el("div", { class: "actions" }, [
        el("a", { href: `#/edit/book/${book.id}`, text: "← назад" }),
        el("button", { class: "primary", text: "Сохранить главу", onclick: async () => {
          if (!text.value.trim()) return (msg.textContent = "Текст главы пустой.");
          const ch = { title: title.value.trim() || `Глава ${book.chapters.length + 1}`, text: text.value };
          const prev = existing ? book.chapters[i] : null;
          if (existing) book.chapters[i] = ch; else book.chapters.push(ch);
          try {
            msg.textContent = "Сохраняю…";
            await saveBooks(`Глава: ${book.title} — ${ch.title}`);
            location.hash = `#/book/${book.id}/${existing ? i : book.chapters.length - 1}`;
          } catch (e) {
            if (existing) book.chapters[i] = prev; else book.chapters.pop();
            msg.textContent = e.message;
          }
        } })
      ])
    ]));
  }

  // ---------- старт ----------
  window.addEventListener("hashchange", route);

  fetch("books.json", { cache: "no-cache" })
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      books = Array.isArray(data.books) ? data.books : [];
      route();
    })
    .catch(err => {
      app.innerHTML = "";
      app.appendChild(el("p", { class: "empty", text: "Не удалось загрузить books.json (" + err.message + ")." }));
    });
})();

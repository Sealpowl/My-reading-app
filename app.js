/* ============================================================ 我的读书册 — App Logic ============================================================ */
"use strict";

// ─── QUOTES ────────────────────────────────────────────────
const QUOTES = [
  {
    text: "从前的日色变得慢，车，马，邮件都慢，一生只够爱一个人。",
    attr: "木心 《从前慢》",
  },
  { text: "生如夏花之绚烂，死如秋叶之静美。", attr: "泰戈尔" },
  { text: "世界以痛吻我，要我回报以歌。", attr: "泰戈尔" },
  { text: "黑夜给了我黑色的眼睛，我却用它寻找光明。", attr: "顾城 《一代人》" },
  { text: "人生若只如初见，何事秋风悲画扇。", attr: "纳兰性德" },
  { text: "曾经沧海难为水，除却巫山不是云。", attr: "元稹" },
  { text: "生命是一袭华美的袍，爬满了蚤子。", attr: "张爱玲" },
  {
    text: "于千万人之中遇见你所遇见的人，于千万年之中，时间的无涯的荒野里，没有早一步，也没有晚一步，刚巧赶上了。",
    attr: "张爱玲 《爱》",
  },
  { text: "蒹葭苍苍，白露为霜，所谓伊人，在水一方。", attr: "《诗经·蒹葭》" },
  { text: "举杯邀明月，对影成三人。", attr: "李白 《月下独酌》" },
  { text: "人生如逆旅，我亦是行人。", attr: "苏轼" },
  { text: "此情可待成追忆，只是当时已惘然。", attr: "李商隐 《锦瑟》" },
  { text: "问君何能尔？心远地自偏。", attr: "陶渊明 《饮酒》" },
  { text: "一个人，可以被毁灭，但不能被打败。", attr: "海明威 《老人与海》" },
  {
    text: "幸福的家庭都是相似的，不幸的家庭各有各的不幸。",
    attr: "托尔斯泰 《安娜·卡列尼娜》",
  },
  {
    text: "我必须是你近旁的一株木棉，作为树的形象和你站在一起。",
    attr: "舒婷 《致橡树》",
  },
  { text: "春水初生，春林初盛，春风十里，不如你。", attr: "冯唐" },
  { text: "人是生而自由的，却无往不在枷锁之中。", attr: "卢梭 《社会契约论》" },
  { text: "抽刀断水水更流，举杯消愁愁更愁。", attr: "李白" },
  {
    text: "我欲乘风归去，又恐琼楼玉宇，高处不胜寒。",
    attr: "苏轼 《水调歌头》",
  },
];

// ─── STORAGE ───────────────────────────────────────────────
const STORE_KEY = "readingApp_v1";

const Store = {
  get() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : this._default();
    } catch {
      return this._default();
    }
  },
  save(data) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) {
      App.toast("存储空间不足", "error");
    }
  },
  update(fn) {
    const d = this.get();
    fn(d);
    this.save(d);
  },
  _default() {
    return {
      version: 1,
      books: [],
      notes: [],
      discussions: [],
      yearGoal: { year: new Date().getFullYear(), target: 12 },
      settings: {
        provider: "anthropic",
        anthropicKey: "",
        anthropicModel: "claude-sonnet-4-6",
        openaiKey: "",
        openaiModel: "gpt-4o",
        deepseekKey: "",
        deepseekModel: "deepseek-chat",
        geminiKey: "",
        geminiModel: "gemini-2.0-flash",
      },
    };
  },
};

// ─── HELPERS ───────────────────────────────────────────────
function uid(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 6)
  );
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart( 2, "0" )}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(iso)}\n${String(d.getHours()).padStart(2, "0")}:${String( d.getMinutes() ).padStart(2, "0")}`;
}

function nowISO() {
  return new Date().toISOString();
}

function starsStr(n, total = 5) {
  return "★".repeat(n) + "☆".repeat(total - n);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── APP ───────────────────────────────────────────────────
const App = {
  currentTab: "plan",
  currentBookStatus: "在读",
  activeDiscussionId: null,
  _toastTimer: null,
  _searchQuery: "",

  // ── INIT ──────────────────────────────────────────────
  init() {
    this._registerSW();
    this._initQuote();
    document
      .getElementById("screen-home")
      .addEventListener("click", () => this.enterApp());
  },

  _registerSW() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  },

  _initQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    document.getElementById("quote-text").textContent = q.text;
    document.getElementById("quote-attr").textContent = "— " + q.attr;
  },

  enterApp() {
    document.getElementById("screen-home").classList.remove("active");
    document.getElementById("screen-app").classList.add("active");
    const saved = localStorage.getItem("lastTab") || "plan";
    this.switchTab(saved);
  },

  // ── NAVIGATION ────────────────────────────────────────
  switchTab(tab) {
    this.currentTab = tab;
    localStorage.setItem("lastTab", tab);

    // Hide AI chat if switching away
    if (tab !== "ai") this._hideAIChat();

    document
      .querySelectorAll(".tab-panel")
      .forEach((p) => p.classList.remove("active"));
    document.getElementById("tab-" + tab).classList.add("active");

    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });

    const renders = {
      plan: () => this.renderPlan(),
      notes: () => this.renderNotes(),
      ai: () => this.renderAI(),
      books: () => this.renderBooks(),
    };
    renders[tab]?.();
  },

  // ── PLAN TAB ──────────────────────────────────────────
  renderPlan() {
    const data = Store.get();
    const year = new Date().getFullYear();
    const goal = data.yearGoal;
    const readThisYear = data.books.filter(
      (b) =>
        b.status === "已读" &&
        b.finishedDate &&
        b.finishedDate.startsWith(String(year))
    ).length;
    const pct =
      goal.target > 0
        ? clamp(Math.round((readThisYear / goal.target) * 100), 0, 100)
        : 0;
    const reading = data.books.filter((b) => b.status === "在读");

    let html = ` <div class="year-card"> <div class="year-card-header"> <span class="year-label">${year}年阅读目标</span> <span class="edit-link" onclick="App.openYearGoalModal()">编辑目标</span> </div> <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div> <div class="progress-meta"> <span>已读 ${readThisYear} 本</span> <span>目标 ${goal.target} 本 · ${pct}%</span> </div> </div>`;

    html += `<div class="section-title">在读书目</div>`;

    if (reading.length === 0) {
      html += `<div class="empty-state"><span class="empty-state-icon">📖</span>还没有在读的书<br>去书架把书标记为「在读」</div>`;
    } else {
      reading.forEach((b) => {
        const pages = b.pages || 0;
        const read = b.pagesRead || 0;
        const bpct =
          pages > 0 ? clamp(Math.round((read / pages) * 100), 0, 100) : 0;
        html += ` <div class="reading-book-card" onclick="App.openBookProgressModal('${ b.id }')"> <div class="reading-book-title">${escHtml(b.title)}</div> ${ b.author ? `<div class="reading-book-author">${escHtml(b.author)}</div>` : "" } <div class="book-progress-bar"><div class="book-progress-fill" style="width:${bpct}%"></div></div> <div class="book-progress-meta"> <span>${ pages > 0 ? `${read} / ${pages} 页` : "未设置总页数" }</span> <span>${ pages > 0 ? bpct + "%" : "" } <span style="color:var(--accent);font-size:11px">更新进度 ›</span></span> </div> </div>`;
      });
    }

    document.getElementById("plan-content").innerHTML = html;
  },

  openYearGoalModal() {
    const data = Store.get();
    const g = data.yearGoal;
    this.openModal(` <div class="modal-handle"></div> <div class="modal-title">设置年度目标</div> <div class="modal-section"> <div class="modal-label">${new Date().getFullYear()}年目标（本数）</div> <input class="modal-input" type="number" id="goal-input" value="${ g.target }" min="1" max="500" placeholder="12"> </div> <div class="modal-actions"> <button class="btn-secondary" onclick="App.closeModal()">取消</button> <button class="btn-primary" onclick="App.saveYearGoal()">保存</button> </div>`);
    setTimeout(() => document.getElementById("goal-input")?.focus(), 80);
  },

  saveYearGoal() {
    const val = parseInt(document.getElementById("goal-input").value, 10);
    if (!val || val < 1) {
      this.toast("请输入有效数字", "error");
      return;
    }
    Store.update((d) => {
      d.yearGoal.target = val;
      d.yearGoal.year = new Date().getFullYear();
    });
    this.closeModal();
    this.renderPlan();
    this.toast("目标已更新");
  },

  openBookProgressModal(bookId) {
    const data = Store.get();
    const book = data.books.find((b) => b.id === bookId);
    if (!book) return;
    this.openModal(` <div class="modal-handle"></div> <div class="modal-title">${escHtml(book.title)}</div> <div class="modal-section"> <div class="modal-label">总页数</div> <input class="modal-input" type="number" id="prog-total" value="${ book.pages || "" }" placeholder="如：320"> </div> <div class="modal-section"> <div class="modal-label">已读至第几页</div> <input class="modal-input" type="number" id="prog-read" value="${ book.pagesRead || "" }" placeholder="如：150"> </div> <div class="modal-actions"> <button class="btn-secondary" onclick="App.closeModal()">取消</button> <button class="btn-primary" onclick="App.saveBookProgress('${bookId}')">更新</button> </div>`);
    setTimeout(() => document.getElementById("prog-read")?.focus(), 80);
  },

  saveBookProgress(bookId) {
    const total =
      parseInt(document.getElementById("prog-total").value, 10) || 0;
    const read = parseInt(document.getElementById("prog-read").value, 10) || 0;
    Store.update((d) => {
      const b = d.books.find((x) => x.id === bookId);
      if (b) {
        b.pages = total;
        b.pagesRead = clamp(read, 0, total || read);
      }
    });
    this.closeModal();
    this.renderPlan();
    this.toast("进度已更新");
  },

  // ── NOTES TAB ─────────────────────────────────────────
  renderNotes(query = "") {
    this._searchQuery = query;
    const data = Store.get();
    let notes = [...data.notes].sort(
      (a, b) => new Date(b.datetime) - new Date(a.datetime)
    );
    if (query.trim()) {
      const q = query.toLowerCase();
      notes = notes.filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          (n.bookTitle || "").toLowerCase().includes(q) ||
          fmtDate(n.datetime).includes(q)
      );
    }
    const el = document.getElementById("notes-content");
    if (notes.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">✍️</span>${ query ? "没有找到相关随笔" : "还没有写过随笔<br>点击右下角开始记录" }</div>`;
      return;
    }
    el.innerHTML = notes
      .map((n) => {
        const dt = fmtDateTime(n.datetime).split("\n");
        return ` <div class="note-card" onclick="App.openNoteModal('${n.id}')"> <div class="note-card-meta"> <div class="${n.bookTitle ? "note-book-tag" : "note-empty-tag"}">${ n.bookTitle ? escHtml(n.bookTitle) : "" }</div> <div class="note-datetime">${dt[0]}<br>${dt[1]}</div> </div> <div class="note-content">${escHtml(n.content)}</div> ${n.aiEnabled ? `<div class="note-ai-badge">◉ AI可阅读</div>` : ""} </div>`;
      })
      .join("");
  },

  searchNotes(q) {
    const clearBtn = document.getElementById("search-clear");
    if (clearBtn) clearBtn.classList.toggle("hidden", !q);
    this.renderNotes(q);
  },

  clearSearch() {
    const input = document.getElementById("notes-search");
    if (input) input.value = "";
    const clearBtn = document.getElementById("search-clear");
    if (clearBtn) clearBtn.classList.add("hidden");
    this.renderNotes("");
  },

  openNoteModal(noteId = null) {
    const data = Store.get();
    const note = noteId ? data.notes.find((n) => n.id === noteId) : null;
    const bookOptions = data.books
      .map(
        (b) =>
          `<option value="${b.id}" ${ note?.bookId === b.id ? "selected" : "" }>${escHtml(b.title)}</option>`
      )
      .join("");

    this.openModal(` <div class="modal-handle"></div> <div class="modal-title">${note ? "编辑随笔" : "写随笔"}</div> <div class="modal-section"> <textarea class="modal-textarea" id="note-content" placeholder="写下此刻的想法…">${ note ? escHtml(note.content) : "" }</textarea> </div> <div class="modal-section"> <div class="modal-label">关联书目（可选）</div> <select class="modal-select" id="note-book"> <option value="">— 不关联书目 —</option> ${bookOptions} </select> </div> <div class="toggle-row"> <div> <div class="toggle-label">AI可阅读</div> </div> <div class="toggle ${ note?.aiEnabled ? "on" : "" }" id="note-ai-toggle" onclick="this.classList.toggle('on')"></div> </div> <div class="modal-divider"></div> <div class="modal-actions"> ${ note ? `<button class="btn-danger" onclick="App.deleteNote('${noteId}')">删除</button>` : "" } <button class="btn-secondary" onclick="App.closeModal()">取消</button> <button class="btn-primary" onclick="App.saveNote('${ noteId || "" }')">保存</button> </div>`);

    const ta = document.getElementById("note-content");
    ta.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
    setTimeout(() => {
      ta.focus();
      ta.dispatchEvent(new Event("input"));
    }, 80);
  },

  saveNote(noteId) {
    const content = document.getElementById("note-content").value.trim();
    if (!content) {
      this.toast("内容不能为空", "error");
      return;
    }
    const bookEl = document.getElementById("note-book");
    const aiEl = document.getElementById("note-ai-toggle");
    const data = Store.get();
    const bookId = bookEl.value;
    const book = data.books.find((b) => b.id === bookId);

    Store.update((d) => {
      if (noteId) {
        const n = d.notes.find((x) => x.id === noteId);
        if (n) {
          n.content = content;
          n.bookId = bookId || null;
          n.bookTitle = book ? book.title : "";
          n.aiEnabled = aiEl.classList.contains("on");
        }
      } else {
        d.notes.push({
          id: uid("n"),
          content,
          bookId: bookId || null,
          bookTitle: book ? book.title : "",
          datetime: nowISO(),
          aiEnabled: aiEl.classList.contains("on"),
        });
      }
    });
    this.closeModal();
    this.renderNotes(this._searchQuery);
    this.toast(noteId ? "随笔已更新" : "随笔已保存");
  },

  deleteNote(noteId) {
    if (!confirm("确定删除这篇随笔？")) return;
    Store.update((d) => {
      d.notes = d.notes.filter((n) => n.id !== noteId);
    });
    this.closeModal();
    this.renderNotes(this._searchQuery);
    this.toast("已删除");
  },

  // ── AI TAB ────────────────────────────────────────────
  renderAI() {
    const data = Store.get();
    const s = data.settings;
    const hasKey = !!s[(s.provider || "anthropic") + "Key"];
    const el = document.getElementById("ai-content");

    let html = "";
    if (!hasKey) {
      html += ` <div class="api-notice"> <strong>尚未设置 API Key</strong><br> 点击右上角编辑按钮，输入你的 Anthropic API Key 即可开始与 AI 讨论读书心得。<br><br> 标记了「AI可阅读」的随笔会作为上下文提供给 AI。 </div>`;
    }

    if (data.discussions.length === 0) {
      html += `<div class="empty-state"><span class="empty-state-icon">💬</span>${ hasKey ? "还没有讨论记录<br>点击下方开始" : "设置 API Key 后即可开始讨论" }</div>`;
    } else {
      html += data.discussions
        .slice()
        .reverse()
        .map((d) => {
          const last = d.messages[d.messages.length - 1];
          return ` <div class="discussion-card" onclick="App.openDiscussion('${d.id}')"> <div class="discussion-title">${escHtml(d.title)}</div> ${ last ? `<div class="discussion-preview">${ last.role === "user" ? "你：" : "AI：" }${escHtml(last.content)}</div>` : "" } <div class="discussion-meta"> <span>${fmtDate(d.createdAt)}</span> <span>${d.messages.length} 条消息</span> </div> </div>`;
        })
        .join("");
    }

    if (hasKey) {
      html += ` <div style="padding:16px 0 4px;"> <button class="btn-primary" style="width:100%" onclick="App.startNewDiscussion()">＋ 开始新讨论</button> </div>`;
    }

    el.innerHTML = html;
  },

  openAISettings() {
    const s = Store.get().settings;
    const cur = s.provider || "anthropic";

    const providers = [
      {
        id: "anthropic",
        label: "Claude",
        placeholder: "sk-ant-…",
        models: [
          ["claude-sonnet-4-6", "Claude Sonnet 4.6（推荐）"],
          ["claude-haiku-4-5-20251001", "Claude Haiku 4.5（快）"],
        ],
      },
      {
        id: "openai",
        label: "ChatGPT",
        placeholder: "sk-…",
        models: [
          ["gpt-4o", "GPT-4o"],
          ["gpt-4o-mini", "GPT-4o mini（省）"],
          ["o4-mini", "o4-mini"],
        ],
      },
      {
        id: "deepseek",
        label: "DeepSeek",
        placeholder: "sk-…",
        models: [
          ["deepseek-chat", "DeepSeek V3"],
          ["deepseek-reasoner", "DeepSeek R1"],
        ],
      },
      {
        id: "gemini",
        label: "Gemini",
        placeholder: "AIza…",
        models: [
          ["gemini-2.0-flash", "Gemini 2.0 Flash"],
          ["gemini-2.5-pro", "Gemini 2.5 Pro"],
        ],
      },
    ];

    const providerTabs = providers
      .map(
        (p) =>
          `<div class="status-btn ${ cur === p.id ? "active" : "" }" onclick="App._switchProviderTab('${p.id}')">${p.label}</div>`
      )
      .join("");

    const sections = providers
      .map((p) => {
        const keyVal = s[p.id + "Key"] || "";
        const modelVal = s[p.id + "Model"] || p.models[0][0];
        const modelOpts = p.models
          .map(
            ([v, l]) =>
              `<option value="${v}" ${ modelVal === v ? "selected" : "" }>${l}</option>`
          )
          .join("");
        return ` <div id="provider-section-${p.id}" class="${ cur === p.id ? "" : "hidden" }"> <div class="modal-section"> <div class="modal-label">${p.label} API Key</div> <input class="modal-input" type="password" id="key-${ p.id }" value="${escHtml(keyVal)}" placeholder="${p.placeholder}"> </div> <div class="modal-section"> <div class="modal-label">模型</div> <select class="modal-select" id="model-${ p.id }">${modelOpts}</select> </div> </div>`;
      })
      .join("");

    this.openModal(` <div class="modal-handle"></div> <div class="modal-title">AI 设置</div> <div class="modal-section"> <div class="modal-label">选择服务商</div> <div class="status-btns" id="provider-tabs">${providerTabs}</div> <input type="hidden" id="cur-provider" value="${cur}"> </div> ${sections} <div class="modal-section" style="font-size:12px;color:var(--text-3);line-height:1.8"> API Key 仅存在本地，不会上传。<br> 各家 Key 可以分别填，随时切换供应商。 </div> <div class="modal-actions"> <button class="btn-secondary" onclick="App.closeModal()">取消</button> <button class="btn-primary" onclick="App.saveAISettings()">保存</button> </div>`);
  },

  _switchProviderTab(pid) {
    document.getElementById("cur-provider").value = pid;
    document.querySelectorAll("#provider-tabs .status-btn").forEach((b, i) => {
      const ids = ["anthropic", "openai", "deepseek", "gemini"];
      b.classList.toggle("active", ids[i] === pid);
    });
    ["anthropic", "openai", "deepseek", "gemini"].forEach((id) => {
      document
        .getElementById("provider-section-" + id)
        ?.classList.toggle("hidden", id !== pid);
    });
  },

  saveAISettings() {
    const provider = document.getElementById("cur-provider").value;
    Store.update((d) => {
      d.settings.provider = provider;
      ["anthropic", "openai", "deepseek", "gemini"].forEach((id) => {
        const k = document.getElementById("key-" + id)?.value?.trim();
        const m = document.getElementById("model-" + id)?.value;
        if (k !== undefined) d.settings[id + "Key"] = k;
        if (m) d.settings[id + "Model"] = m;
      });
    });
    this.closeModal();
    this.renderAI();
    this.toast("设置已保存");
  },

  startNewDiscussion() {
    this.openModal(` <div class="modal-handle"></div> <div class="modal-title">开始新讨论</div> <div class="modal-section"> <div class="modal-label">你想聊什么？</div> <textarea class="modal-textarea" id="new-disc-input" placeholder="关于最近读的某本书，或者一个读书相关的问题…" style="min-height:100px"></textarea> </div> <div class="modal-section" style="font-size:13px;color:var(--text-3)"> 已标记「AI可阅读」的随笔会自动作为上下文提供给 AI。 </div> <div class="modal-actions"> <button class="btn-secondary" onclick="App.closeModal()">取消</button> <button class="btn-primary" onclick="App.createAndSendDiscussion()">发送</button> </div>`);
    setTimeout(() => document.getElementById("new-disc-input")?.focus(), 80);
  },

  async createAndSendDiscussion() {
    const content = document.getElementById("new-disc-input")?.value?.trim();
    if (!content) {
      this.toast("请输入内容", "error");
      return;
    }
    this.closeModal();

    const data = Store.get();
    const discId = uid("d");
    const disc = {
      id: discId,
      title: content.slice(0, 40) + (content.length > 40 ? "…" : ""),
      createdAt: nowISO(),
      messages: [{ role: "user", content, time: nowISO() }],
    };
    Store.update((d) => d.discussions.push(disc));
    this.openDiscussion(discId);
    await this._sendAIMessage(discId);
  },

  openDiscussion(discId) {
    this.activeDiscussionId = discId;
    document.getElementById("ai-content").classList.add("hidden");
    const chatView = document.getElementById("ai-chat-view");
    chatView.classList.remove("hidden");
    chatView.classList.add("visible");
    this._renderChatView(discId);
  },

  _hideAIChat() {
    this.activeDiscussionId = null;
    document.getElementById("ai-content")?.classList.remove("hidden");
    const chatView = document.getElementById("ai-chat-view");
    chatView.classList.add("hidden");
    chatView.classList.remove("visible");
  },

  _renderChatView(discId) {
    const data = Store.get();
    const disc = data.discussions.find((d) => d.id === discId);
    if (!disc) return;

    const chatView = document.getElementById("ai-chat-view");
    chatView.innerHTML = ` <div class="chat-header"> <button class="chat-back" onclick="App._hideAIChat();App.renderAI()">‹ 返回</button> <div class="chat-title">${escHtml(disc.title)}</div> </div> <div class="chat-messages" id="chat-messages"> ${disc.messages.map((m) => this._bubbleHtml(m)).join("")} </div> <div class="chat-input-bar"> <textarea class="chat-input" id="chat-input" placeholder="继续提问…" rows="1" onkeydown="App._chatKeydown(event)"></textarea> <button class="chat-send" id="chat-send-btn" onclick="App.sendChatMessage()"> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"> <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/> </svg> </button> </div>`;

    const ta = chatView.querySelector("#chat-input");
    ta.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 120) + "px";
    });

    this._scrollChatBottom();
  },

  _bubbleHtml(m) {
    return ` <div class="chat-bubble ${m.role}"> ${escHtml(m.content).replace(/\n/g, "<br>")} <div class="chat-bubble-time">${fmtDateTime(m.time).replace( "\n", " " )}</div> </div>`;
  },

  _chatKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendChatMessage();
    }
  },

  async sendChatMessage() {
    const input = document.getElementById("chat-input");
    const content = input.value.trim();
    if (!content || !this.activeDiscussionId) return;
    input.value = "";
    input.style.height = "auto";

    Store.update((d) => {
      const disc = d.discussions.find((x) => x.id === this.activeDiscussionId);
      if (disc) disc.messages.push({ role: "user", content, time: nowISO() });
    });

    this._appendBubble({ role: "user", content, time: nowISO() });
    await this._sendAIMessage(this.activeDiscussionId);
  },

  async _sendAIMessage(discId) {
    const data = Store.get();
    const disc = data.discussions.find((d) => d.id === discId);
    if (!disc) return;

    const s = data.settings;
    const provider = s.provider || "anthropic";
    const apiKey = s[provider + "Key"];
    const model = s[provider + "Model"];
    if (!apiKey) {
      this.toast("请先设置 API Key", "error");
      return;
    }

    // 打字动画
    const msgEl = document.getElementById("chat-messages");
    const typingId = "typing_" + Date.now();
    if (msgEl) {
      msgEl.insertAdjacentHTML(
        "beforeend",
        ` <div id="${typingId}" class="typing-indicator"> <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div> </div>`
      );
      this._scrollChatBottom();
    }

    // 系统提示 + AI可阅读随笔
    const aiNotes = data.notes.filter((n) => n.aiEnabled);
    const sysParts = [
      "你是一位温和的读书讨论伴侣，对文学、哲学、历史都有涉猎。用自然、真诚的语气回应，不要过于正式。",
    ];
    if (aiNotes.length > 0) {
      sysParts.push("\n以下是用户的部分读书随笔，供你参考：\n");
      aiNotes.forEach((n) =>
        sysParts.push(
          `【${n.bookTitle || "无书名"}】${fmtDate(n.datetime)}\n${n.content}`
        )
      );
    }
    const systemPrompt = sysParts.join("\n");
    const msgs = disc.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      let reply = "";

      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1000,
            system: systemPrompt,
            messages: msgs,
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error?.message || `${res.status}`);
        }
        const json = await res.json();
        reply = json.content?.[0]?.text || "（无回复）";
      } else if (provider === "openai" || provider === "deepseek") {
        const endpoint =
          provider === "openai"
            ? "https://api.openai.com/v1/chat/completions"
            : "https://api.deepseek.com/chat/completions";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: 1000,
            messages: [{ role: "system", content: systemPrompt }, ...msgs],
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error?.message || `${res.status}`);
        }
        const json = await res.json();
        reply = json.choices?.[0]?.message?.content || "（无回复）";
      } else if (provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const contents = msgs.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { maxOutputTokens: 1000 },
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error?.message || `${res.status}`);
        }
        const json = await res.json();
        reply = json.candidates?.[0]?.content?.parts?.[0]?.text || "（无回复）";
      }

      document.getElementById(typingId)?.remove();
      Store.update((d) => {
        const dc = d.discussions.find((x) => x.id === discId);
        if (dc)
          dc.messages.push({
            role: "assistant",
            content: reply,
            time: nowISO(),
          });
      });
      this._appendBubble({ role: "assistant", content: reply, time: nowISO() });
    } catch (err) {
      document.getElementById(typingId)?.remove();
      this.toast("回复失败：" + err.message, "error");
    }
  },

  _appendBubble(msg) {
    const el = document.getElementById("chat-messages");
    if (!el) return;
    el.insertAdjacentHTML("beforeend", this._bubbleHtml(msg));
    this._scrollChatBottom();
  },

  _scrollChatBottom() {
    setTimeout(() => {
      const el = document.getElementById("chat-messages");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  },

  // ── BOOKS TAB ─────────────────────────────────────────
  renderBooks() {
    const data = Store.get();
    const books = data.books.filter((b) => b.status === this.currentBookStatus);
    const el = document.getElementById("books-content");

    if (books.length === 0) {
      const msgs = {
        在读: "还没有在读的书",
        想读: "想读列表空空如也",
        已读: "还没有标记完成的书",
      };
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">📚</span>${ msgs[this.currentBookStatus] }<br>点击右下角添加书目</div>`;
      return;
    }

    el.innerHTML = books
      .map((b) => {
        let footer = "";
        if (b.status === "已读") {
          footer = `<div class="book-stars">${starsStr(b.rating || 0)}</div> ${ b.note ? `<div class="book-card-note">${escHtml(b.note)}</div>` : "" } ${ b.finishedDate ? `<div class="book-finished-date">${b.finishedDate}</div>` : "" }`;
        } else if (b.status === "在读" && b.pages) {
          const pct = clamp(
            Math.round(((b.pagesRead || 0) / b.pages) * 100),
            0,
            100
          );
          footer = `<div class="book-progress-bar" style="margin-top:6px"><div class="book-progress-fill" style="width:${pct}%"></div></div> <div style="font-size:11px;color:var(--text-3);margin-top:4px">${pct}%</div>`;
        }

        return ` <div class="book-card status-${b.status}" onclick="App.openBookModal('${ b.id }')"> <div class="book-card-title">${escHtml(b.title)}</div> ${ b.author ? `<div class="book-card-author">${escHtml(b.author)}</div>` : "" } <div class="book-card-footer">${footer}</div> </div>`;
      })
      .join("");
  },

  switchBookStatus(btn) {
    document
      .querySelectorAll(".status-tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    this.currentBookStatus = btn.data

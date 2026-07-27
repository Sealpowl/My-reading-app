/* ============================================================
   我的读书册 — App Logic
   ============================================================ */

'use strict';

// ─── QUOTES ────────────────────────────────────────────────
const QUOTES = [
  { text: '从前的日色变得慢，车，马，邮件都慢，一生只够爱一个人。', attr: '木心 《从前慢》' },
  { text: '生如夏花之绚烂，死如秋叶之静美。', attr: '泰戈尔' },
  { text: '世界以痛吻我，要我回报以歌。', attr: '泰戈尔' },
  { text: '黑夜给了我黑色的眼睛，我却用它寻找光明。', attr: '顾城 《一代人》' },
  { text: '人生若只如初见，何事秋风悲画扇。', attr: '纳兰性德' },
  { text: '曾经沧海难为水，除却巫山不是云。', attr: '元稹' },
  { text: '生命是一袭华美的袍，爬满了蚤子。', attr: '张爱玲' },
  { text: '于千万人之中遇见你所遇见的人，于千万年之中，时间的无涯的荒野里，没有早一步，也没有晚一步，刚巧赶上了。', attr: '张爱玲 《爱》' },
  { text: '蒹葭苍苍，白露为霜，所谓伊人，在水一方。', attr: '《诗经·蒹葭》' },
  { text: '举杯邀明月，对影成三人。', attr: '李白 《月下独酌》' },
  { text: '人生如逆旅，我亦是行人。', attr: '苏轼' },
  { text: '此情可待成追忆，只是当时已惘然。', attr: '李商隐 《锦瑟》' },
  { text: '问君何能尔？心远地自偏。', attr: '陶渊明 《饮酒》' },
  { text: '一个人，可以被毁灭，但不能被打败。', attr: '海明威 《老人与海》' },
  { text: '幸福的家庭都是相似的，不幸的家庭各有各的不幸。', attr: '托尔斯泰 《安娜·卡列尼娜》' },
  { text: '我必须是你近旁的一株木棉，作为树的形象和你站在一起。', attr: '舒婷 《致橡树》' },
  { text: '春水初生，春林初盛，春风十里，不如你。', attr: '冯唐' },
  { text: '人是生而自由的，却无往不在枷锁之中。', attr: '卢梭 《社会契约论》' },
  { text: '抽刀断水水更流，举杯消愁愁更愁。', attr: '李白' },
  { text: '我欲乘风归去，又恐琼楼玉宇，高处不胜寒。', attr: '苏轼 《水调歌头》' },
];

// ─── STORAGE ───────────────────────────────────────────────
const STORE_KEY = 'readingApp_v1';

const Store = {
  get() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : this._default();
    } catch { return this._default(); }
  },
  save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch(e) {
      App.toast('存储空间不足', 'error');
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
      settings: { apiKey: '', model: 'claude-sonnet-4-6' }
    };
  }
};

// ─── HELPERS ───────────────────────────────────────────────
function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDateTime(iso) {
  const d = new Date(iso);
  return `${fmtDate(iso)}\n${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function nowISO() { return new Date().toISOString(); }

function starsStr(n, total = 5) {
  return '★'.repeat(n) + '☆'.repeat(total - n);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── APP ───────────────────────────────────────────────────
const App = {
  currentTab: 'plan',
  currentBookStatus: '在读',
  activeDiscussionId: null,
  _toastTimer: null,
  _searchQuery: '',

  // ── INIT ──────────────────────────────────────────────
  init() {
    this._registerSW();
    this._initQuote();
    document.getElementById('screen-home').addEventListener('click', () => this.enterApp());
  },

  _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  _initQuote() {
    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    document.getElementById('quote-text').textContent = q.text;
    document.getElementById('quote-attr').textContent = '— ' + q.attr;
  },

  enterApp() {
    document.getElementById('screen-home').classList.remove('active');
    document.getElementById('screen-app').classList.add('active');
    const saved = localStorage.getItem('lastTab') || 'plan';
    this.switchTab(saved);
  },

  // ── NAVIGATION ────────────────────────────────────────
  switchTab(tab) {
    this.currentTab = tab;
    localStorage.setItem('lastTab', tab);

    // Hide AI chat if switching away
    if (tab !== 'ai') this._hideAIChat();

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });

    const renders = { plan: () => this.renderPlan(), notes: () => this.renderNotes(), ai: () => this.renderAI(), books: () => this.renderBooks() };
    renders[tab]?.();
  },

  // ── PLAN TAB ──────────────────────────────────────────
  renderPlan() {
    const data = Store.get();
    const year = new Date().getFullYear();
    const goal = data.yearGoal;
    const readThisYear = data.books.filter(b =>
      b.status === '已读' && b.finishedDate && b.finishedDate.startsWith(String(year))
    ).length;
    const pct = goal.target > 0 ? clamp(Math.round(readThisYear / goal.target * 100), 0, 100) : 0;
    const reading = data.books.filter(b => b.status === '在读');

    let html = `
      <div class="year-card">
        <div class="year-card-header">
          <span class="year-label">${year}年阅读目标</span>
          <span class="edit-link" onclick="App.openYearGoalModal()">编辑目标</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-meta">
          <span>已读 ${readThisYear} 本</span>
          <span>目标 ${goal.target} 本 · ${pct}%</span>
        </div>
      </div>`;

    html += `<div class="section-title">在读书目</div>`;

    if (reading.length === 0) {
      html += `<div class="empty-state"><span class="empty-state-icon">📖</span>还没有在读的书<br>去书架把书标记为「在读」</div>`;
    } else {
      reading.forEach(b => {
        const pages = b.pages || 0;
        const read = b.pagesRead || 0;
        const bpct = pages > 0 ? clamp(Math.round(read / pages * 100), 0, 100) : 0;
        html += `
          <div class="reading-book-card" onclick="App.openBookProgressModal('${b.id}')">
            <div class="reading-book-title">${escHtml(b.title)}</div>
            ${b.author ? `<div class="reading-book-author">${escHtml(b.author)}</div>` : ''}
            <div class="book-progress-bar"><div class="book-progress-fill" style="width:${bpct}%"></div></div>
            <div class="book-progress-meta">
              <span>${pages > 0 ? `${read} / ${pages} 页` : '未设置总页数'}</span>
              <span>${pages > 0 ? bpct + '%' : ''} <span style="color:var(--accent);font-size:11px">更新进度 ›</span></span>
            </div>
          </div>`;
      });
    }

    document.getElementById('plan-content').innerHTML = html;
  },

  openYearGoalModal() {
    const data = Store.get();
    const g = data.yearGoal;
    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">设置年度目标</div>
      <div class="modal-section">
        <div class="modal-label">${new Date().getFullYear()}年目标（本数）</div>
        <input class="modal-input" type="number" id="goal-input" value="${g.target}" min="1" max="500" placeholder="12">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.saveYearGoal()">保存</button>
      </div>`);
    setTimeout(() => document.getElementById('goal-input')?.focus(), 80);
  },

  saveYearGoal() {
    const val = parseInt(document.getElementById('goal-input').value, 10);
    if (!val || val < 1) { this.toast('请输入有效数字', 'error'); return; }
    Store.update(d => { d.yearGoal.target = val; d.yearGoal.year = new Date().getFullYear(); });
    this.closeModal();
    this.renderPlan();
    this.toast('目标已更新');
  },

  openBookProgressModal(bookId) {
    const data = Store.get();
    const book = data.books.find(b => b.id === bookId);
    if (!book) return;
    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${escHtml(book.title)}</div>
      <div class="modal-section">
        <div class="modal-label">总页数</div>
        <input class="modal-input" type="number" id="prog-total" value="${book.pages || ''}" placeholder="如：320">
      </div>
      <div class="modal-section">
        <div class="modal-label">已读至第几页</div>
        <input class="modal-input" type="number" id="prog-read" value="${book.pagesRead || ''}" placeholder="如：150">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.saveBookProgress('${bookId}')">更新</button>
      </div>`);
    setTimeout(() => document.getElementById('prog-read')?.focus(), 80);
  },

  saveBookProgress(bookId) {
    const total = parseInt(document.getElementById('prog-total').value, 10) || 0;
    const read  = parseInt(document.getElementById('prog-read').value, 10) || 0;
    Store.update(d => {
      const b = d.books.find(x => x.id === bookId);
      if (b) { b.pages = total; b.pagesRead = clamp(read, 0, total || read); }
    });
    this.closeModal();
    this.renderPlan();
    this.toast('进度已更新');
  },

  // ── NOTES TAB ─────────────────────────────────────────
  renderNotes(query = '') {
    this._searchQuery = query;
    const data = Store.get();
    let notes = [...data.notes].sort((a,b) => new Date(b.datetime) - new Date(a.datetime));
    if (query.trim()) {
      const q = query.toLowerCase();
      notes = notes.filter(n =>
        n.content.toLowerCase().includes(q) ||
        (n.bookTitle || '').toLowerCase().includes(q) ||
        fmtDate(n.datetime).includes(q)
      );
    }
    const el = document.getElementById('notes-content');
    if (notes.length === 0) {
      el.innerHTML = `<div class="empty-state"><span class="empty-state-icon">✍️</span>${query ? '没有找到相关随笔' : '还没有写过随笔<br>点击右下角开始记录'}</div>`;
      return;
    }
    el.innerHTML = notes.map(n => {
      const dt = fmtDateTime(n.datetime).split('\n');
      return `
        <div class="note-card" onclick="App.openNoteModal('${n.id}')">
          <div class="note-card-meta">
            <div class="${n.bookTitle ? 'note-book-tag' : 'note-empty-tag'}">${n.bookTitle ? escHtml(n.bookTitle) : ''}</div>
            <div class="note-datetime">${dt[0]}<br>${dt[1]}</div>
          </div>
          <div class="note-content">${escHtml(n.content)}</div>
          ${n.aiEnabled ? `<div class="note-ai-badge">◉ AI可阅读</div>` : ''}
        </div>`;
    }).join('');
  },

  searchNotes(q) {
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);
    this.renderNotes(q);
  },

  clearSearch() {
    const input = document.getElementById('notes-search');
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    this.renderNotes('');
  },

  openNoteModal(noteId = null) {
    const data = Store.get();
    const note = noteId ? data.notes.find(n => n.id === noteId) : null;
    const bookOptions = data.books.map(b =>
      `<option value="${b.id}" ${note?.bookId === b.id ? 'selected' : ''}>${escHtml(b.title)}</option>`
    ).join('');

    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${note ? '编辑随笔' : '写随笔'}</div>
      <div class="modal-section">
        <textarea class="modal-textarea" id="note-content" placeholder="写下此刻的想法…">${note ? escHtml(note.content) : ''}</textarea>
      </div>
      <div class="modal-section">
        <div class="modal-label">关联书目（可选）</div>
        <select class="modal-select" id="note-book">
          <option value="">— 不关联书目 —</option>
          ${bookOptions}
        </select>
      </div>
      <div class="toggle-row">
        <div>
          <div class="toggle-label">AI可阅读</div>
        </div>
        <div class="toggle ${note?.aiEnabled ? 'on' : ''}" id="note-ai-toggle" onclick="this.classList.toggle('on')"></div>
      </div>
      <div class="modal-divider"></div>
      <div class="modal-actions">
        ${note ? `<button class="btn-danger" onclick="App.deleteNote('${noteId}')">删除</button>` : ''}
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.saveNote('${noteId || ''}')">保存</button>
      </div>`);

    const ta = document.getElementById('note-content');
    ta.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
    });
    setTimeout(() => { ta.focus(); ta.dispatchEvent(new Event('input')); }, 80);
  },

  saveNote(noteId) {
    const content = document.getElementById('note-content').value.trim();
    if (!content) { this.toast('内容不能为空', 'error'); return; }
    const bookEl = document.getElementById('note-book');
    const aiEl = document.getElementById('note-ai-toggle');
    const data = Store.get();
    const bookId = bookEl.value;
    const book = data.books.find(b => b.id === bookId);

    Store.update(d => {
      if (noteId) {
        const n = d.notes.find(x => x.id === noteId);
        if (n) {
          n.content = content;
          n.bookId = bookId || null;
          n.bookTitle = book ? book.title : '';
          n.aiEnabled = aiEl.classList.contains('on');
        }
      } else {
        d.notes.push({
          id: uid('n'),
          content,
          bookId: bookId || null,
          bookTitle: book ? book.title : '',
          datetime: nowISO(),
          aiEnabled: aiEl.classList.contains('on')
        });
      }
    });
    this.closeModal();
    this.renderNotes(this._searchQuery);
    this.toast(noteId ? '随笔已更新' : '随笔已保存');
  },

  deleteNote(noteId) {
    if (!confirm('确定删除这篇随笔？')) return;
    Store.update(d => { d.notes = d.notes.filter(n => n.id !== noteId); });
    this.closeModal();
    this.renderNotes(this._searchQuery);
    this.toast('已删除');
  },

  // ── AI TAB ────────────────────────────────────────────
  renderAI() {
    const data = Store.get();
    const hasKey = !!data.settings.apiKey;
    const el = document.getElementById('ai-content');

    let html = '';
    if (!hasKey) {
      html += `
        <div class="api-notice">
          <strong>尚未设置 API Key</strong><br>
          点击右上角编辑按钮，输入你的 Anthropic API Key 即可开始与 AI 讨论读书心得。<br><br>
          标记了「AI可阅读」的随笔会作为上下文提供给 AI。
        </div>`;
    }

    if (data.discussions.length === 0) {
      html += `<div class="empty-state"><span class="empty-state-icon">💬</span>${hasKey ? '还没有讨论记录<br>点击下方开始' : '设置 API Key 后即可开始讨论'}</div>`;
    } else {
      html += data.discussions.slice().reverse().map(d => {
        const last = d.messages[d.messages.length - 1];
        return `
          <div class="discussion-card" onclick="App.openDiscussion('${d.id}')">
            <div class="discussion-title">${escHtml(d.title)}</div>
            ${last ? `<div class="discussion-preview">${last.role === 'user' ? '你：' : 'AI：'}${escHtml(last.content)}</div>` : ''}
            <div class="discussion-meta">
              <span>${fmtDate(d.createdAt)}</span>
              <span>${d.messages.length} 条消息</span>
            </div>
          </div>`;
      }).join('');
    }

    if (hasKey) {
      html += `
        <div style="padding:16px 0 4px;">
          <button class="btn-primary" style="width:100%" onclick="App.startNewDiscussion()">＋ 开始新讨论</button>
        </div>`;
    }

    el.innerHTML = html;
  },

  openAISettings() {
    const data = Store.get();
    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">API 设置</div>
      <div class="modal-section">
        <div class="modal-label">Anthropic API Key</div>
        <input class="modal-input" type="password" id="api-key-input" value="${escHtml(data.settings.apiKey)}" placeholder="sk-ant-…">
      </div>
      <div class="modal-section">
        <div class="modal-label">模型</div>
        <select class="modal-select" id="api-model-input">
          <option value="claude-sonnet-4-6" ${data.settings.model === 'claude-sonnet-4-6' ? 'selected' : ''}>Claude Sonnet 4.6（推荐）</option>
          <option value="claude-haiku-4-5-20251001" ${data.settings.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Claude Haiku 4.5（更快更省）</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.saveAISettings()">保存</button>
      </div>`);
  },

  saveAISettings() {
    const key = document.getElementById('api-key-input').value.trim();
    const model = document.getElementById('api-model-input').value;
    Store.update(d => { d.settings.apiKey = key; d.settings.model = model; });
    this.closeModal();
    this.renderAI();
    this.toast('设置已保存');
  },

  startNewDiscussion() {
    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">开始新讨论</div>
      <div class="modal-section">
        <div class="modal-label">你想聊什么？</div>
        <textarea class="modal-textarea" id="new-disc-input" placeholder="关于最近读的某本书，或者一个读书相关的问题…" style="min-height:100px"></textarea>
      </div>
      <div class="modal-section" style="font-size:13px;color:var(--text-3)">
        已标记「AI可阅读」的随笔会自动作为上下文提供给 AI。
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.createAndSendDiscussion()">发送</button>
      </div>`);
    setTimeout(() => document.getElementById('new-disc-input')?.focus(), 80);
  },

  async createAndSendDiscussion() {
    const content = document.getElementById('new-disc-input')?.value?.trim();
    if (!content) { this.toast('请输入内容', 'error'); return; }
    this.closeModal();

    const data = Store.get();
    const discId = uid('d');
    const disc = {
      id: discId,
      title: content.slice(0, 40) + (content.length > 40 ? '…' : ''),
      createdAt: nowISO(),
      messages: [{ role: 'user', content, time: nowISO() }]
    };
    Store.update(d => d.discussions.push(disc));
    this.openDiscussion(discId);
    await this._sendAIMessage(discId);
  },

  openDiscussion(discId) {
    this.activeDiscussionId = discId;
    document.getElementById('ai-content').classList.add('hidden');
    const chatView = document.getElementById('ai-chat-view');
    chatView.classList.remove('hidden');
    chatView.classList.add('visible');
    this._renderChatView(discId);
  },

  _hideAIChat() {
    this.activeDiscussionId = null;
    document.getElementById('ai-content')?.classList.remove('hidden');
    const chatView = document.getElementById('ai-chat-view');
    chatView.classList.add('hidden');
    chatView.classList.remove('visible');
  },

  _renderChatView(discId) {
    const data = Store.get();
    const disc = data.discussions.find(d => d.id === discId);
    if (!disc) return;

    const chatView = document.getElementById('ai-chat-view');
    chatView.innerHTML = `
      <div class="chat-header">
        <button class="chat-back" onclick="App._hideAIChat();App.renderAI()">‹ 返回</button>
        <div class="chat-title">${escHtml(disc.title)}</div>
      </div>
      <div class="chat-messages" id="chat-messages">
        ${disc.messages.map(m => this._bubbleHtml(m)).join('')}
      </div>
      <div class="chat-input-bar">
        <textarea class="chat-input" id="chat-input" placeholder="继续提问…" rows="1" onkeydown="App._chatKeydown(event)"></textarea>
        <button class="chat-send" id="chat-send-btn" onclick="App.sendChatMessage()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>`;

    const ta = chatView.querySelector('#chat-input');
    ta.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    this._scrollChatBottom();
  },

  _bubbleHtml(m) {
    return `
      <div class="chat-bubble ${m.role}">
        ${escHtml(m.content).replace(/\n/g, '<br>')}
        <div class="chat-bubble-time">${fmtDateTime(m.time).replace('\n', ' ')}</div>
      </div>`;
  },

  _chatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendChatMessage();
    }
  },

  async sendChatMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !this.activeDiscussionId) return;
    input.value = '';
    input.style.height = 'auto';

    Store.update(d => {
      const disc = d.discussions.find(x => x.id === this.activeDiscussionId);
      if (disc) disc.messages.push({ role: 'user', content, time: nowISO() });
    });

    this._appendBubble({ role: 'user', content, time: nowISO() });
    await this._sendAIMessage(this.activeDiscussionId);
  },

  async _sendAIMessage(discId) {
    const data = Store.get();
    const disc = data.discussions.find(d => d.id === discId);
    if (!disc) return;
    if (!data.settings.apiKey) { this.toast('请先设置 API Key', 'error'); return; }

    // Show typing indicator
    const msgEl = document.getElementById('chat-messages');
    const typingId = 'typing_' + Date.now();
    if (msgEl) {
      msgEl.insertAdjacentHTML('beforeend', `
        <div id="${typingId}" class="typing-indicator">
          <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
        </div>`);
      this._scrollChatBottom();
    }

    // Build system prompt with AI-readable notes
    const aiNotes = data.notes.filter(n => n.aiEnabled);
    const sysParts = ['你是一位温和的读书讨论伴侣，对文学、哲学、历史都有涉猎。用自然、真诚的语气回应，不要过于正式。'];
    if (aiNotes.length > 0) {
      sysParts.push('\n以下是用户的部分读书随笔，供你参考：\n');
      aiNotes.forEach(n => {
        sysParts.push(`【${n.bookTitle || '无书名'}】${fmtDate(n.datetime)}\n${n.content}`);
      });
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': data.settings.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: data.settings.model || 'claude-sonnet-4-6',
          max_tokens: 1000,
          system: sysParts.join('\n'),
          messages: disc.messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      document.getElementById(typingId)?.remove();

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `请求失败 (${res.status})`);
      }

      const json = await res.json();
      const reply = json.content?.[0]?.text || '（无回复）';

      Store.update(d => {
        const dc = d.discussions.find(x => x.id === discId);
        if (dc) dc.messages.push({ role: 'assistant', content: reply, time: nowISO() });
      });

      this._appendBubble({ role: 'assistant', content: reply, time: nowISO() });
    } catch (err) {
      document.getElementById(typingId)?.remove();
      this.toast('AI 回复失败：' + err.message, 'error');
    }
  },

  _appendBubble(msg) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    el.insertAdjacentHTML('beforeend', this._bubbleHtml(msg));
    this._scrollChatBottom();
  },

  _scrollChatBottom() {
    setTimeout(() => {
      const el = document.getElementById('chat-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  },

  // ── BOOKS TAB ─────────────────────────────────────────
  renderBooks() {
    const data = Store.get();
    const books = data.books.filter(b => b.status === this.currentBookStatus);
    const el = document.getElementById('books-content');

    if (books.length === 0) {
      const msgs = { 在读: '还没有在读的书', 想读: '想读列表空空如也', 已读: '还没有标记完成的书' };
      el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">📚</span>${msgs[this.currentBookStatus]}<br>点击右下角添加书目</div>`;
      return;
    }

    el.innerHTML = books.map(b => {
      let footer = '';
      if (b.status === '已读') {
        footer = `<div class="book-stars">${starsStr(b.rating || 0)}</div>
          ${b.note ? `<div class="book-card-note">${escHtml(b.note)}</div>` : ''}
          ${b.finishedDate ? `<div class="book-finished-date">${b.finishedDate}</div>` : ''}`;
      } else if (b.status === '在读' && b.pages) {
        const pct = clamp(Math.round((b.pagesRead||0)/b.pages*100), 0, 100);
        footer = `<div class="book-progress-bar" style="margin-top:6px"><div class="book-progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px">${pct}%</div>`;
      }

      return `
        <div class="book-card status-${b.status}" onclick="App.openBookModal('${b.id}')">
          <div class="book-card-title">${escHtml(b.title)}</div>
          ${b.author ? `<div class="book-card-author">${escHtml(b.author)}</div>` : ''}
          <div class="book-card-footer">${footer}</div>
        </div>`;
    }).join('');
  },

  switchBookStatus(btn) {
    document.querySelectorAll('.status-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.currentBookStatus = btn.dataset.status;
    this.renderBooks();
  },

  openBookModal(bookId = null) {
    const data = Store.get();
    const book = bookId ? data.books.find(b => b.id === bookId) : null;
    const status = book?.status || '想读';
    const ratingVal = book?.rating || 0;

    const starsHtml = [1,2,3,4,5].map(i =>
      `<span class="star-btn ${i <= ratingVal ? 'lit' : ''}" data-v="${i}" onclick="App._setStars(this,${i})">★</span>`
    ).join('');

    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">${book ? '编辑书目' : '添加书目'}</div>
      <div class="modal-section">
        <div class="modal-label">书名 *</div>
        <input class="modal-input" type="text" id="book-title" value="${book ? escHtml(book.title) : ''}" placeholder="书名">
      </div>
      <div class="modal-section">
        <div class="modal-label">作者</div>
        <input class="modal-input" type="text" id="book-author" value="${book ? escHtml(book.author||'') : ''}" placeholder="作者">
      </div>
      <div class="modal-section">
        <div class="modal-label">状态</div>
        <div class="status-btns">
          <div class="status-btn ${status==='想读'?'active':''}" onclick="App._setBookStatus(this,'想读')">想读</div>
          <div class="status-btn ${status==='在读'?'active':''}" onclick="App._setBookStatus(this,'在读')">在读</div>
          <div class="status-btn ${status==='已读'?'active':''}" onclick="App._setBookStatus(this,'已读')">已读</div>
        </div>
        <input type="hidden" id="book-status" value="${status}">
      </div>
      <div id="book-pages-section" class="modal-section ${status==='在读'?'':'hidden'}">
        <div class="modal-label">总页数</div>
        <input class="modal-input" type="number" id="book-pages" value="${book?.pages||''}" placeholder="如：320">
      </div>
      <div id="book-read-section" class="modal-section ${status==='已读'?'':'hidden'}">
        <div class="modal-label">评分</div>
        <div class="stars-input" id="stars-input">${starsHtml}</div>
        <input type="hidden" id="book-rating" value="${ratingVal}">
      </div>
      <div id="book-note-section" class="modal-section ${status==='已读'?'':'hidden'}">
        <div class="modal-label">简短评语</div>
        <input class="modal-input" type="text" id="book-note" value="${book ? escHtml(book.note||'') : ''}" placeholder="一句话评语（可选）">
      </div>
      <div id="book-date-section" class="modal-section ${status==='已读'?'':'hidden'}">
        <div class="modal-label">读完日期</div>
        <input class="modal-input" type="date" id="book-date" value="${book?.finishedDate || new Date().toISOString().split('T')[0]}">
      </div>
      <div class="modal-divider"></div>
      <div class="modal-actions">
        ${book ? `<button class="btn-danger" onclick="App.deleteBook('${bookId}')">删除</button>` : ''}
        <button class="btn-secondary" onclick="App.closeModal()">取消</button>
        <button class="btn-primary" onclick="App.saveBook('${bookId||''}')">保存</button>
      </div>`);
    setTimeout(() => document.getElementById('book-title')?.focus(), 80);
  },

  _setBookStatus(btn, status) {
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('book-status').value = status;
    document.getElementById('book-pages-section').classList.toggle('hidden', status !== '在读');
    document.getElementById('book-read-section').classList.toggle('hidden', status !== '已读');
    document.getElementById('book-note-section').classList.toggle('hidden', status !== '已读');
    document.getElementById('book-date-section').classList.toggle('hidden', status !== '已读');
  },

  _setStars(el, val) {
    document.getElementById('book-rating').value = val;
    document.querySelectorAll('.star-btn').forEach((s, i) => s.classList.toggle('lit', i < val));
  },

  saveBook(bookId) {
    const title = document.getElementById('book-title').value.trim();
    if (!title) { this.toast('书名不能为空', 'error'); return; }
    const author = document.getElementById('book-author').value.trim();
    const status = document.getElementById('book-status').value;
    const pages = parseInt(document.getElementById('book-pages')?.value, 10) || 0;
    const rating = parseInt(document.getElementById('book-rating')?.value, 10) || 0;
    const note = document.getElementById('book-note')?.value?.trim() || '';
    const finishedDate = document.getElementById('book-date')?.value || '';

    Store.update(d => {
      if (bookId) {
        const b = d.books.find(x => x.id === bookId);
        if (b) { Object.assign(b, { title, author, status, pages, rating, note, finishedDate }); }
      } else {
        d.books.push({ id: uid('b'), title, author, status, pages, pagesRead: 0, rating, note, finishedDate, addedDate: nowISO() });
      }
    });
    this.closeModal();
    this.currentBookStatus = status;
    document.querySelectorAll('.status-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.status === status);
    });
    this.renderBooks();
    this.toast(bookId ? '书目已更新' : '书目已添加');
  },

  deleteBook(bookId) {
    if (!confirm('确定删除这本书？')) return;
    Store.update(d => { d.books = d.books.filter(b => b.id !== bookId); });
    this.closeModal();
    this.renderBooks();
    this.toast('已删除');
  },

  // ── EXPORT / SETTINGS MODAL ───────────────────────────
  openExportModal() {
    this.openModal(`
      <div class="modal-handle"></div>
      <div class="modal-title">设置与数据</div>
      <div class="settings-row" onclick="App.closeModal();App.openAISettings()">
        <div>
          <div class="settings-row-label">API 设置</div>
          <div class="settings-row-sub">设置 Anthropic API Key</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </div>
      <div class="settings-row" onclick="App.exportData()">
        <div>
          <div class="settings-row-label">导出数据</div>
          <div class="settings-row-sub">将所有数据下载为 JSON 文件</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </div>
      <div class="settings-row" onclick="document.getElementById('import-file').click()">
        <div>
          <div class="settings-row-label">导入数据</div>
          <div class="settings-row-sub">从备份文件恢复数据</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </div>
      <input type="file" id="import-file" accept=".json" class="hidden" onchange="App.importData(this)">
      <div class="settings-row" onclick="App.confirmClearData()" style="color:var(--red)">
        <div>
          <div class="settings-row-label" style="color:var(--red)">清除所有数据</div>
          <div class="settings-row-sub">不可恢复，请先备份</div>
        </div>
        <div class="settings-row-arrow" style="color:var(--red)">›</div>
      </div>
      <div style="padding:16px 20px 0;">
        <p style="font-size:12px;color:var(--text-3);line-height:1.8">
          数据存储在本地浏览器中。<br>
          换设备或清除浏览器缓存前，请先导出备份。
        </p>
      </div>`);
  },

  exportData() {
    const data = Store.get();
    const safe = JSON.parse(JSON.stringify(data));
    if (safe.settings) safe.settings.apiKey = ''; // 不导出 API key
    const blob = new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reading-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toast('数据已导出');
  },

  importData(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.books || !data.notes) throw new Error('格式不正确');
        const cur = Store.get();
        data.settings = cur.settings; // 保留当前 API key
        Store.save(data);
        this.closeModal();
        this.renderPlan();
        this.toast('数据已导入');
      } catch (err) {
        this.toast('导入失败：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  },

  confirmClearData() {
    if (!confirm('确定清除所有数据？此操作不可恢复。')) return;
    localStorage.removeItem(STORE_KEY);
    this.closeModal();
    this.renderPlan();
    this.toast('数据已清除');
  },

  // ── MODAL ─────────────────────────────────────────────
  openModal(html) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-inner').innerHTML = html;
    overlay.classList.remove('hidden');
  },

  closeModal(e) {
    if (e && e.target !== document.getElementById('modal-overlay')) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-inner').innerHTML = '';
  },

  // ── TOAST ─────────────────────────────────────────────
  toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast' + (type !== 'info' ? ' ' + type : '');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 2400);
  }
};

// ─── BOOT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());

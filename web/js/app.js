// === 背单词 - 主应用逻辑 ===

// === 遗忘曲线引擎 ===
const ReviewEngine = {
  intervals: [5*60*1000, 30*60*1000, 12*60*60*1000, 24*60*60*1000, 2*24*60*60*1000,
              4*24*60*60*1000, 7*24*60*60*1000, 15*24*60*60*1000, 30*24*60*60*1000],
  calculateNextReview(familiarity, correct) {
    let f = correct ? Math.min(familiarity + 1, 8) : Math.max(0, familiarity - 2);
    const interval = this.intervals[Math.min(f, this.intervals.length - 1)];
    return { familiarity: f, nextReviewTime: Date.now() + interval };
  }
};

// === 应用路由 ===
const App = {
  currentView: 'home',
  history: [],
  currentBook: 'cet4',

  switchTab(tab) {
    const map = { home: 'view-home', learn: 'view-mode-select', review: 'view-review',
                  wordbook: 'view-wordbook', settings: 'view-settings' };
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(map[tab]);
    if (el) el.classList.add('active');
    document.querySelectorAll('.tab-item').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('header-back').classList.add('hidden');
    const titles = { home: '背单词', learn: '学习', review: '复习', wordbook: '词库', settings: '设置' };
    document.getElementById('header-title').textContent = titles[tab] || '';
    const prevView = this.currentView;
    this.currentView = tab;
    this.history = [];
    // 只有从其他tab主动切换到review时才触发，避免初始化时或跳转回首页时误触发
    if (tab === 'review' && prevView !== 'review') ReviewSession.start();
    if (tab === 'wordbook') WordBook.load(this.currentBook);
    if (tab === 'home') this.refreshHome();
  },

  goTo(viewName) {
    const viewMap = {
      'mode-select': 'view-mode-select', 'card-learn': 'view-card-learn',
      'choice-learn': 'view-choice-learn', 'spell-learn': 'view-spell-learn',
      'review': 'view-review', 'wrong-book': 'view-wrong-book',
      'starred': 'view-starred', 'session-complete': 'view-session-complete'
    };
    this.history.push(this.currentView);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById(viewMap[viewName]);
    if (el) el.classList.add('active');
    document.getElementById('header-back').classList.remove('hidden');
    const titles = { 'mode-select': '选择模式', 'card-learn': '卡片学习', 'choice-learn': '选择题',
                     'spell-learn': '拼写', 'review': '复习', 'wrong-book': '错题本',
                     'starred': '收藏夹', 'session-complete': '学习完成' };
    document.getElementById('header-title').textContent = titles[viewName] || '';
    this.currentView = viewName;
    if (viewName === 'wrong-book') this.loadWrongBook();
    if (viewName === 'starred') this.loadStarred();
  },

  goBack() {
    if (this.history.length > 0) {
      const prev = this.history.pop();
      if (['home','learn','review','wordbook','settings'].includes(prev)) {
        this.switchTab(prev);
      } else {
        this.goTo(prev);
      }
    } else {
      this.switchTab('home');
    }
  },

  async refreshHome() {
    const stats = await WordDB.getStats();
    document.getElementById('stat-learned').textContent = stats.totalLearned;
    document.getElementById('stat-review').textContent = stats.dueCount;
    document.getElementById('stat-streak').textContent = stats.streak;
    const dailyGoal = await WordDB.getSetting('dailyGoal', 20);
    const newWords = await WordDB.getTodayNewWords(this.currentBook, dailyGoal);
    document.getElementById('task-new-count').textContent = newWords.length;
    document.getElementById('task-review-count').textContent = stats.dueCount;
    document.getElementById('task-wrong-count').textContent = stats.wrongCount;
    const starredWords = await WordDB.getStarredWords(this.currentBook);
    document.getElementById('task-starred-count').textContent = starredWords.length;
    // Show current book with switch option
    const bookEl = document.getElementById('home-book');
    const book = WORD_BOOKS[this.currentBook];
    const totalWords = (WORDS[this.currentBook] || []).length;
    bookEl.innerHTML = `<div class="book-item active" onclick="App.showBookPicker()"><span class="book-name">${book.name}</span><span class="book-count">${totalWords}词</span><span class="book-switch">切换 ▸</span></div>`;
  },

  async loadWrongBook() {
    const words = await WordDB.getWrongWords(this.currentBook);
    const empty = document.getElementById('wrong-empty');
    const list = document.getElementById('wrong-list');
    if (words.length === 0) { empty.classList.remove('hidden'); list.innerHTML = ''; return; }
    empty.classList.add('hidden');
    list.innerHTML = words.map(w => `<div class="word-item" onclick="WordDetail.show('${w.w}')"><div class="word-item-left"><span class="word-item-word">${w.w}</span><span class="word-item-meaning">${w.m}</span></div><span class="word-item-right">→</span></div>`).join('');
  },

  async loadStarred() {
    const words = await WordDB.getStarredWords(this.currentBook);
    const empty = document.getElementById('starred-empty');
    const list = document.getElementById('starred-list');
    if (words.length === 0) { empty.classList.remove('hidden'); list.innerHTML = ''; return; }
    empty.classList.add('hidden');
    list.innerHTML = words.map(w => `<div class="word-item" onclick="WordDetail.show('${w.w}')"><div class="word-item-left"><span class="word-item-word">${w.w}</span><span class="word-item-meaning">${w.m}</span></div><span class="word-item-right">⭐</span></div>`).join('');
  },

  getWordId(word) { return this.currentBook + ':' + word; },

  showBookPicker() {
    const picker = document.getElementById('modal-book-picker');
    const list = document.getElementById('book-picker-list');
    list.innerHTML = '';
    for (const [id, book] of Object.entries(WORD_BOOKS)) {
      const total = (WORDS[id] || []).length;
      const isActive = id === this.currentBook;
      const opt = document.createElement('div');
      opt.className = 'book-picker-item' + (isActive ? ' active' : '');
      opt.innerHTML = `<span class="book-picker-name">${book.name}</span><span class="book-picker-right"><span class="book-picker-count">${total}词</span>${isActive ? '<span class="book-picker-check">✓</span>' : ''}</span>`;
      const bookId = id;
      opt.addEventListener('click', () => App.switchBook(bookId));
      list.appendChild(opt);
    }
    picker.classList.remove('hidden');
  },

  async switchBook(bookId) {
    this.currentBook = bookId;
    document.getElementById('modal-book-picker').classList.add('hidden');
    await WordDB.setSetting('currentBook', bookId);
    this.refreshHome();
  }
};

// === 卡片模式 ===
const CardMode = {
  words: [], idx: 0, correct: 0, flipped: false, currentWord: null,

  start(words) {
    this.words = words; this.idx = 0; this.correct = 0; this.flipped = false;
    App.goTo('card-learn');
    this.showCurrent();
  },

  async showCurrent() {
    if (this.idx >= this.words.length) { LearnSession.complete(this.words.length, this.correct); return; }
    this.currentWord = this.words[this.idx];
    this.flipped = false;
    const card = document.getElementById('card-word-card');
    card.classList.remove('flipped');
    document.getElementById('card-word').textContent = this.currentWord.w;
    const showPhonetic = await WordDB.getSetting('showPhonetic', true);
    const accent = localStorage.getItem('accent') || 'us';
    const phEl = document.getElementById('card-phonetic');
    phEl.textContent = accent === 'uk' ? (this.currentWord.pk || this.currentWord.p) : this.currentWord.p;
    phEl.style.display = showPhonetic ? '' : 'none';
    document.getElementById('card-meaning').textContent = this.currentWord.m;
    const showExample = await WordDB.getSetting('showExample', true);
    const exEl = document.getElementById('card-example');
    if (this.currentWord.e && showExample) {
      exEl.textContent = this.currentWord.e + (this.currentWord.et ? '\n' + this.currentWord.et : '');
      exEl.style.display = '';
    } else { exEl.style.display = 'none'; }
    const rootEl = document.getElementById('card-root');
    rootEl.textContent = this.currentWord.r ? '💡 ' + this.currentWord.r : '';
    rootEl.style.display = this.currentWord.r ? '' : 'none';
    this.updateProgress();
    this.updateStarBtn();
    if (localStorage.getItem('autoPlay') === 'true') this.speak();
  },

  updateProgress() {
    const pct = (this.idx / this.words.length * 100).toFixed(0);
    document.getElementById('card-progress-fill').style.width = pct + '%';
    document.getElementById('card-progress-text').textContent = `${this.idx + 1}/${this.words.length}`;
  },

  async updateStarBtn() {
    if (!this.currentWord) return;
    const uw = await WordDB.getUserWord(App.getWordId(this.currentWord.w), App.currentBook);
    const btn = document.getElementById('card-star-btn');
    btn.textContent = uw.isStarred ? '★ 已收藏' : '☆ 收藏';
    btn.classList.toggle('starred', uw.isStarred);
  },

  flip() {
    this.flipped = !this.flipped;
    document.getElementById('card-word-card').classList.toggle('flipped', this.flipped);
  },

  async mark(known) {
    if (!this.currentWord) return;
    try {
      const wid = App.getWordId(this.currentWord.w);
      const uw = await WordDB.getUserWord(wid, App.currentBook);
      const review = ReviewEngine.calculateNextReview(uw.familiarity, known);
      await WordDB.setUserWord(wid, App.currentBook, {
        status: known ? (review.familiarity >= 5 ? 'MASTERED' : 'LEARNING') : 'LEARNING',
        familiarity: review.familiarity,
        nextReviewTime: review.nextReviewTime,
        reviewCount: uw.reviewCount + 1,
        correctCount: uw.correctCount + (known ? 1 : 0),
        isWrong: known ? false : true,
        lastStudied: Date.now()
      });
      if (known) this.correct++;
      this.idx++;
      this.showCurrent();
    } catch (e) {
      console.error('CardMode.mark error:', e);
    }
  },

  speak() {
    if (!this.currentWord) return;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    const u = new SpeechSynthesisUtterance(this.currentWord.w);
    u.lang = accent; u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  async toggleStar() {
    if (!this.currentWord) return;
    const wid = App.getWordId(this.currentWord.w);
    const uw = await WordDB.getUserWord(wid, App.currentBook);
    await WordDB.setUserWord(wid, App.currentBook, { isStarred: !uw.isStarred });
    this.updateStarBtn();
  }
};

// === 选择题模式 ===
const ChoiceMode = {
  words: [], idx: 0, correct: 0, answered: false, isReverse: false, currentWord: null,

  start(words, reverse = false) {
    this.words = words; this.idx = 0; this.correct = 0; this.isReverse = reverse;
    App.goTo('choice-learn');
    this.showCurrent();
  },

  showCurrent() {
    if (this.idx >= this.words.length) { LearnSession.complete(this.words.length, this.correct); return; }
    this.currentWord = this.words[this.idx];
    this.answered = false;
    document.getElementById('choice-result').classList.add('hidden');
    document.getElementById('choice-next-btn').classList.add('hidden');
    
    if (this.isReverse) {
      document.getElementById('choice-question').textContent = this.currentWord.m;
    } else {
      document.getElementById('choice-question').textContent = this.currentWord.w;
    }
    
    const options = this.generateOptions(this.currentWord);
    const optEl = document.getElementById('choice-options');
    optEl.innerHTML = options.map((o, i) => `<div class="choice-option" onclick="ChoiceMode.selectOption(${i})">${this.isReverse ? o.w : o.m}</div>`).join('');
    this._options = options;
    this.updateProgress();
  },

  generateOptions(correct) {
    const all = WORDS[App.currentBook] || [];
    const others = all.filter(w => w.w !== correct.w).sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    return options;
  },

  updateProgress() {
    const pct = (this.idx / this.words.length * 100).toFixed(0);
    document.getElementById('choice-progress-fill').style.width = pct + '%';
    document.getElementById('choice-progress-text').textContent = `${this.idx + 1}/${this.words.length}`;
  },

  async selectOption(idx) {
    if (this.answered) return;
    this.answered = true;
    try {
      const selected = this._options[idx];
      const correct = this.currentWord;
      const isCorrect = selected.w === correct.w;
      const opts = document.querySelectorAll('.choice-option');
      opts.forEach((o, i) => {
        if (this._options[i].w === correct.w) o.classList.add('correct');
        else if (i === idx && !isCorrect) o.classList.add('wrong');
        o.style.pointerEvents = 'none';
      });
      
      const wid = App.getWordId(correct.w);
      const uw = await WordDB.getUserWord(wid, App.currentBook);
      const review = ReviewEngine.calculateNextReview(uw.familiarity, isCorrect);
      await WordDB.setUserWord(wid, App.currentBook, {
        status: isCorrect ? (review.familiarity >= 5 ? 'MASTERED' : 'LEARNING') : 'LEARNING',
        familiarity: review.familiarity,
        nextReviewTime: review.nextReviewTime,
        reviewCount: uw.reviewCount + 1,
        correctCount: uw.correctCount + (isCorrect ? 1 : 0),
        isWrong: isCorrect ? false : true,
        lastStudied: Date.now()
      });
      if (isCorrect) this.correct++;
    } catch (e) {
      console.error('ChoiceMode.selectOption error:', e);
    }
    
    document.getElementById('choice-result-meaning').textContent = this.currentWord.m;
    document.getElementById('choice-result-example').textContent = this.currentWord.e ? this.currentWord.e + (this.currentWord.et ? '\n' + this.currentWord.et : '') : '';
    document.getElementById('choice-result').classList.remove('hidden');
    document.getElementById('choice-next-btn').classList.remove('hidden');
  },

  next() { this.idx++; this.showCurrent(); }
};

// === 拼写模式 ===
const SpellMode = {
  words: [], idx: 0, correct: 0, currentWord: null, hintCount: 0, submitted: false,

  start(words) {
    this.words = words; this.idx = 0; this.correct = 0;
    App.goTo('spell-learn');
    this.showCurrent();
  },

  showCurrent() {
    if (this.idx >= this.words.length) { LearnSession.complete(this.words.length, this.correct); return; }
    this.currentWord = this.words[this.idx];
    this.hintCount = 0; this.submitted = false;
    document.getElementById('spell-meaning').textContent = this.currentWord.m;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    document.getElementById('spell-phonetic').textContent = accent === 'uk' ? (this.currentWord.pk || this.currentWord.p) : this.currentWord.p;
    document.getElementById('spell-result').classList.add('hidden');
    
    const boxes = document.getElementById('spell-boxes');
    const len = this.currentWord.w.length;
    boxes.innerHTML = Array.from({ length: len }, (_, i) => `<div class="spell-box" data-idx="${i}"></div>`).join('');
    
    const input = document.getElementById('spell-input');
    input.value = '';
    this._focusInput();
    this.updateProgress();
  },

  updateProgress() {
    const pct = (this.idx / this.words.length * 100).toFixed(0);
    document.getElementById('spell-progress-fill').style.width = pct + '%';
    document.getElementById('spell-progress-text').textContent = `${this.idx + 1}/${this.words.length}`;
  },

  _focusInput() {
    const input = document.getElementById('spell-input');
    setTimeout(() => input.focus(), 200);
  },

  onInput(value) {
    const boxes = document.querySelectorAll('.spell-box');
    const word = this.currentWord.w.toLowerCase();
    boxes.forEach((box, i) => {
      box.textContent = value[i] || '';
      box.className = 'spell-box' + (value[i] ? ' filled' : (i === value.length ? ' active' : ''));
    });
  },

  hint() {
    if (!this.currentWord) return;
    const word = this.currentWord.w.toLowerCase();
    if (this.hintCount >= word.length) return; // 全部已提示
    const input = document.getElementById('spell-input');
    // 确保 input 内容长度至少达到 hintCount+1，并将 hintCount 位置设为正确字母
    let val = input.value;
    // 若用户输入长度未到 hintCount，先补空格填充到 hintCount 位
    while (val.length < this.hintCount) val += word[val.length] || ' ';
    // 再将第 hintCount 个字符替换/追加为正确字母
    if (val.length <= this.hintCount) {
      val = val + word[this.hintCount];
    } else {
      val = val.slice(0, this.hintCount) + word[this.hintCount] + val.slice(this.hintCount + 1);
    }
    input.value = val;
    this.onInput(val);
    const boxes = document.querySelectorAll('.spell-box');
    if (boxes[this.hintCount]) boxes[this.hintCount].classList.add('hint');
    this.hintCount++;
  },

  async submit() {
    if (this.submitted) return;
    this.submitted = true;
    const input = document.getElementById('spell-input');
    const val = input.value.toLowerCase();
    const word = this.currentWord.w.toLowerCase();
    const isCorrect = val === word;
    const boxes = document.querySelectorAll('.spell-box');
    boxes.forEach((box, i) => {
      if (val[i] === word[i]) box.classList.add('correct');
      else box.classList.add('wrong');
      if (val[i] === undefined) box.textContent = word[i];
    });
    
    const result = document.getElementById('spell-result');
    result.textContent = isCorrect ? '✓ 正确！' : `✗ 正确答案: ${this.currentWord.w}`;
    result.className = 'spell-result ' + (isCorrect ? 'correct' : 'wrong');
    result.classList.remove('hidden');
    
    try {
      const wid = App.getWordId(this.currentWord.w);
      const uw = await WordDB.getUserWord(wid, App.currentBook);
      const review = ReviewEngine.calculateNextReview(uw.familiarity, isCorrect);
      await WordDB.setUserWord(wid, App.currentBook, {
        status: isCorrect ? (review.familiarity >= 5 ? 'MASTERED' : 'LEARNING') : 'LEARNING',
        familiarity: review.familiarity,
        nextReviewTime: review.nextReviewTime,
        reviewCount: uw.reviewCount + 1,
        correctCount: uw.correctCount + (isCorrect ? 1 : 0),
        isWrong: isCorrect ? false : true,
        lastStudied: Date.now()
      });
      if (isCorrect) this.correct++;
    } catch (e) {
      console.error('SpellMode.submit error:', e);
    }
    
    setTimeout(() => { this.idx++; this.showCurrent(); }, 1500);
  },

  speak() {
    if (!this.currentWord) return;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    const u = new SpeechSynthesisUtterance(this.currentWord.w);
    u.lang = accent; u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }
};

// === 学习会话 ===
const LearnSession = {
  async start(mode) {
    const dailyGoal = await WordDB.getSetting('dailyGoal', 20);
    const words = await WordDB.getTodayNewWords(App.currentBook, dailyGoal);
    if (words.length === 0) { alert('今日新词已学完！'); return; }
    if (mode === 'card') CardMode.start(words);
    else if (mode === 'choice') ChoiceMode.start(words, false);
    else if (mode === 'reverse') ChoiceMode.start(words, true);
    else if (mode === 'spell') SpellMode.start(words);
  },

  complete(total, correct) {
    document.getElementById('complete-total').textContent = total;
    document.getElementById('complete-correct').textContent = correct;
    document.getElementById('complete-rate').textContent = total > 0 ? Math.round(correct / total * 100) + '%' : '0%';
    document.getElementById('complete-subtitle').textContent = `你完成了${total}个单词的学习`;
    App.goTo('session-complete');
    WordDB.addStudyRecord({ bookId: App.currentBook, newCount: total, correctRate: total > 0 ? correct / total : 0 });
  }
};

// === 复习会话 ===
const ReviewSession = {
  words: [], idx: 0, correct: 0, flipped: false, currentWord: null, started: false,

  async start() {
    this.words = await WordDB.getDueWords(App.currentBook);
    if (this.words.length === 0 && App.currentView === 'review') {
      document.getElementById('review-word').textContent = '🎉';
      document.getElementById('review-phonetic').textContent = '暂无待复习单词';
      document.getElementById('review-meaning').textContent = '所有单词都已复习完毕！';
      return;
    }
    if (this.words.length === 0) return;
    this.idx = 0; this.correct = 0; this.flipped = false; this.started = true;
    this.showCurrent();
    if (App.currentView !== 'review') App.goTo('review');
  },

  showCurrent() {
    if (this.idx >= this.words.length) { this.complete(); return; }
    this.currentWord = this.words[this.idx];
    this.flipped = false;
    document.getElementById('review-word-card').classList.remove('flipped');
    document.getElementById('review-word').textContent = this.currentWord.w;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    document.getElementById('review-phonetic').textContent = accent === 'uk' ? (this.currentWord.pk || this.currentWord.p) : this.currentWord.p;
    document.getElementById('review-meaning').textContent = this.currentWord.m;
    const exEl = document.getElementById('review-example');
    if (this.currentWord.e) {
      exEl.textContent = this.currentWord.e + (this.currentWord.et ? '\n' + this.currentWord.et : '');
      exEl.style.display = '';
    } else { exEl.style.display = 'none'; }
    const rootEl = document.getElementById('review-root');
    rootEl.textContent = this.currentWord.r ? '💡 ' + this.currentWord.r : '';
    rootEl.style.display = this.currentWord.r ? '' : 'none';
    const pct = (this.idx / this.words.length * 100).toFixed(0);
    document.getElementById('review-progress-fill').style.width = pct + '%';
    document.getElementById('review-progress-text').textContent = `${this.idx + 1}/${this.words.length}`;
  },

  flipCard() {
    this.flipped = !this.flipped;
    document.getElementById('review-word-card').classList.toggle('flipped', this.flipped);
  },

  async mark(known) {
    if (!this.currentWord) return;
    try {
      const wid = App.getWordId(this.currentWord.w);
      const uw = await WordDB.getUserWord(wid, App.currentBook);
      const review = ReviewEngine.calculateNextReview(uw.familiarity, known);
      await WordDB.setUserWord(wid, App.currentBook, {
        familiarity: review.familiarity,
        nextReviewTime: review.nextReviewTime,
        reviewCount: uw.reviewCount + 1,
        correctCount: uw.correctCount + (known ? 1 : 0),
        isWrong: known ? false : true,
        lastStudied: Date.now()
      });
      if (known) this.correct++;
      this.idx++;
      this.showCurrent();
    } catch (e) {
      console.error('ReviewSession.mark error:', e);
    }
  },

  speak() {
    if (!this.currentWord) return;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    const u = new SpeechSynthesisUtterance(this.currentWord.w);
    u.lang = accent; u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  complete() {
    document.getElementById('complete-total').textContent = this.words.length;
    document.getElementById('complete-correct').textContent = this.correct;
    document.getElementById('complete-rate').textContent = this.words.length > 0 ? Math.round(this.correct / this.words.length * 100) + '%' : '0%';
    document.getElementById('complete-subtitle').textContent = '复习完成！继续保持';
    App.goTo('session-complete');
    WordDB.addStudyRecord({ bookId: App.currentBook, reviewCount: this.words.length, correctRate: this.words.length > 0 ? this.correct / this.words.length : 0 });
  }
};

// === 词库浏览 ===
const WordBook = {
  allWords: [],

  load(bookId) {
    this.allWords = WORDS[bookId] || [];
    this.render(this.allWords);
  },

  search(query) {
    if (!query) { this.render(this.allWords); return; }
    const q = query.toLowerCase();
    const filtered = this.allWords.filter(w => w.w.toLowerCase().includes(q) || w.m.includes(q));
    this.render(filtered);
  },

  render(words) {
    const list = document.getElementById('wb-word-list');
    list.innerHTML = words.map(w => `<div class="word-item" onclick="WordDetail.show('${w.w}')"><div class="word-item-left"><span class="word-item-word">${w.w}</span><span class="word-item-meaning">${w.m}</span></div><span class="word-item-right">${w.p}</span></div>`).join('');
  }
};

// === 设置 ===
const Settings = {
  async load() {
    const dark = await WordDB.getSetting('darkMode', false);
    const phonetic = await WordDB.getSetting('showPhonetic', true);
    const example = await WordDB.getSetting('showExample', true);
    const accent = await WordDB.getSetting('accent', 'us');
    const autoPlay = await WordDB.getSetting('autoPlay', false);
    const dailyGoal = await WordDB.getSetting('dailyGoal', 20);
    const reminderTime = await WordDB.getSetting('reminderTime', '09:00');
    
    document.getElementById('set-dark').checked = dark;
    document.getElementById('set-phonetic').checked = phonetic;
    document.getElementById('set-example').checked = example;
    document.getElementById('set-accent').value = accent;
    document.getElementById('set-autoplay').checked = autoPlay;
    document.getElementById('set-daily-goal').textContent = dailyGoal + '词/天';
    document.getElementById('set-reminder-time').textContent = reminderTime;
    
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('accent', accent);
    localStorage.setItem('autoPlay', autoPlay);
  },

  async toggleDark() {
    const val = document.getElementById('set-dark').checked;
    document.documentElement.setAttribute('data-theme', val ? 'dark' : '');
    await WordDB.setSetting('darkMode', val);
  },

  async togglePhonetic() {
    await WordDB.setSetting('showPhonetic', document.getElementById('set-phonetic').checked);
  },

  async toggleExample() {
    await WordDB.setSetting('showExample', document.getElementById('set-example').checked);
  },

  async setAccent(val) {
    await WordDB.setSetting('accent', val);
    // 统一用 IndexedDB，localStorage 仅做同步缓存
    localStorage.setItem('accent', val);
  },

  async toggleAutoPlay() {
    const val = document.getElementById('set-autoplay').checked;
    await WordDB.setSetting('autoPlay', val);
    localStorage.setItem('autoPlay', val);
  },

  showGoalPicker() { document.getElementById('modal-goal').classList.remove('hidden'); },
  
  async setDailyGoal(n) {
    await WordDB.setSetting('dailyGoal', n);
    document.getElementById('set-daily-goal').textContent = n + '词/天';
    document.getElementById('modal-goal').classList.add('hidden');
    App.refreshHome();
  },

  showTimePicker() { document.getElementById('modal-time').classList.remove('hidden'); },
  
  async setReminderTime(t) {
    await WordDB.setSetting('reminderTime', t);
    document.getElementById('set-reminder-time').textContent = t;
    document.getElementById('modal-time').classList.add('hidden');
  },

  async exportData() {
    const data = await WordDB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vocab-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await WordDB.importAll(data);
      alert('导入成功！');
      App.refreshHome();
    } catch (e) { alert('导入失败：文件格式错误'); }
    event.target.value = '';
  },

  confirmReset() { document.getElementById('modal-reset').classList.remove('hidden'); },

  async doReset() {
    await WordDB.resetAll();
    document.getElementById('modal-reset').classList.add('hidden');
    App.refreshHome();
    alert('数据已重置');
  }
};

// === 单词详情 ===
const WordDetail = {
  currentWord: null,

  async show(wordStr) {
    const allWords = WORDS[App.currentBook] || [];
    this.currentWord = allWords.find(w => w.w === wordStr);
    if (!this.currentWord) return;
    const w = this.currentWord;
    document.getElementById('detail-word').textContent = w.w;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    document.getElementById('detail-phonetic').textContent = accent === 'uk' ? (w.pk || w.p) : w.p;
    document.getElementById('detail-meaning').textContent = w.m;
    document.getElementById('detail-example').textContent = w.e ? w.e + (w.et ? '\n' + w.et : '') : '';
    
    const synEl = document.getElementById('detail-synonym-section');
    if (w.s && w.s.length) { synEl.style.display = ''; document.getElementById('detail-synonyms').innerHTML = w.s.map(s => `<span class="detail-tag">${s}</span>`).join(''); }
    else synEl.style.display = 'none';
    
    const antEl = document.getElementById('detail-antonym-section');
    if (w.a && w.a.length) { antEl.style.display = ''; document.getElementById('detail-antonyms').innerHTML = w.a.map(s => `<span class="detail-tag">${s}</span>`).join(''); }
    else antEl.style.display = 'none';
    
    const rootEl = document.getElementById('detail-root-section');
    if (w.r) { rootEl.style.display = ''; document.getElementById('detail-root').textContent = w.r; }
    else rootEl.style.display = 'none';
    
    const wid = App.getWordId(w.w);
    const uw = await WordDB.getUserWord(wid, App.currentBook);
    const starBtn = document.getElementById('detail-star-btn');
    starBtn.textContent = uw.isStarred ? '★ 已收藏' : '☆ 收藏';
    starBtn.classList.toggle('starred', uw.isStarred);
    
    const rmBtn = document.getElementById('detail-remove-wrong-btn');
    rmBtn.classList.toggle('hidden', !uw.isWrong);
    
    document.getElementById('modal-detail').classList.remove('hidden');
  },

  close() { document.getElementById('modal-detail').classList.add('hidden'); },

  speak() {
    if (!this.currentWord) return;
    const accent = localStorage.getItem('accent') === 'uk' ? 'en-GB' : 'en-US';
    const u = new SpeechSynthesisUtterance(this.currentWord.w);
    u.lang = accent; u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  },

  async toggleStar() {
    if (!this.currentWord) return;
    const wid = App.getWordId(this.currentWord.w);
    const uw = await WordDB.getUserWord(wid, App.currentBook);
    await WordDB.setUserWord(wid, App.currentBook, { isStarred: !uw.isStarred });
    const btn = document.getElementById('detail-star-btn');
    btn.textContent = !uw.isStarred ? '★ 已收藏' : '☆ 收藏';
    btn.classList.toggle('starred', !uw.isStarred);
  },

  async removeFromWrong() {
    if (!this.currentWord) return;
    const wid = App.getWordId(this.currentWord.w);
    await WordDB.setUserWord(wid, App.currentBook, { isWrong: false });
    document.getElementById('detail-remove-wrong-btn').classList.add('hidden');
    this.close();
    if (App.currentView === 'wrong-book') App.loadWrongBook();
  }
};

// === 初始化 ===
document.addEventListener('DOMContentLoaded', async () => {
  await WordDB.init();
  const savedBook = await WordDB.getSetting('currentBook', 'ielts');
  App.currentBook = savedBook;
  await Settings.load();
  await App.refreshHome();
  
  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW register failed:', e));
  }
});

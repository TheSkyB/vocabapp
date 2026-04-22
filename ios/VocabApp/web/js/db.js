// === 背单词 - IndexedDB 数据层 ===
class WordDB {
  static DB_NAME = 'VocabAppDB';
  static DB_VERSION = 1;
  static _db = null;
  static _memoryOnly = false; // IndexedDB 不可用时降级为内存存储
  static _memoryStores = { userWords: {}, studyRecords: {}, settings: {} };

  static async init() {
    if (!window.indexedDB) {
      console.warn('IndexedDB not available, using memory storage');
      this._memoryOnly = true;
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('userWords')) {
            const s = db.createObjectStore('userWords', { keyPath: ['wordId', 'bookId'] });
            s.createIndex('bookId', 'bookId');
            s.createIndex('status', 'status');
            s.createIndex('nextReviewTime', 'nextReviewTime');
            s.createIndex('isWrong', 'isWrong');
            s.createIndex('isStarred', 'isStarred');
          }
          if (!db.objectStoreNames.contains('studyRecords')) {
            const s = db.createObjectStore('studyRecords', { keyPath: 'id', autoIncrement: true });
            s.createIndex('date', 'date');
            s.createIndex('bookId', 'bookId');
          }
          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
        req.onerror = (e) => {
          console.warn('IndexedDB open failed, using memory storage:', e.target.error);
          this._memoryOnly = true;
          resolve();
        };
      });
    } catch (e) {
      console.warn('IndexedDB init error, using memory storage:', e);
      this._memoryOnly = true;
    }
  }

  static _tx(store, mode = 'readonly') {
    if (this._memoryOnly) return { _store: store, _mode: mode };
    return this._db.transaction(store, mode).objectStore(store);
  }

  static _promisify(req) {
    if (this._memoryOnly) return Promise.resolve(req);
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // === 内存存储 fallback ===
  static _memGet(store, key) {
    const data = this._memoryStores[store];
    if (!data) return undefined;
    if (Array.isArray(key)) return data[key.join('|')];
    return data[key];
  }

  static _memPut(store, value, key) {
    const data = this._memoryStores[store];
    if (!data) return;
    const k = key || (Array.isArray(value._key) ? value._key.join('|') : value.key || JSON.stringify(key));
    data[k] = value;
  }

  static _memGetAll(store) {
    return Object.values(this._memoryStores[store] || {});
  }

  static _memClear(store) {
    if (this._memoryStores[store]) this._memoryStores[store] = {};
  }

  static async getUserWord(wordId, bookId) {
    if (this._memoryOnly) {
      return this._memGet('userWords', [wordId, bookId]) || {
        wordId, bookId, status: 'NEW', familiarity: 0,
        nextReviewTime: 0, reviewCount: 0, correctCount: 0,
        isStarred: false, isWrong: false, lastStudied: 0
      };
    }
    const tx = this._db.transaction('userWords', 'readonly');
    const s = tx.objectStore('userWords');
    const result = await this._promisify(s.get([wordId, bookId]));
    return result || {
      wordId, bookId, status: 'NEW', familiarity: 0,
      nextReviewTime: 0, reviewCount: 0, correctCount: 0,
      isStarred: false, isWrong: false, lastStudied: 0
    };
  }

  static async setUserWord(wordId, bookId, data) {
    if (this._memoryOnly) {
      const existing = this._memGet('userWords', [wordId, bookId]);
      const merged = { ...(existing || { wordId, bookId, status: 'NEW', familiarity: 0,
        nextReviewTime: 0, reviewCount: 0, correctCount: 0,
        isStarred: false, isWrong: false, lastStudied: 0 }), ...data, wordId, bookId };
      this._memoryStores.userWords[`${wordId}|${bookId}`] = merged;
      return merged;
    }
    // 必须在同一个事务中完成读+写，否则 await 期间原事务会被浏览器自动关闭
    const tx = this._db.transaction('userWords', 'readwrite');
    const s = tx.objectStore('userWords');
    const existing = await this._promisify(s.get([wordId, bookId]));
    const merged = { ...(existing || { wordId, bookId, status: 'NEW', familiarity: 0,
      nextReviewTime: 0, reviewCount: 0, correctCount: 0,
      isStarred: false, isWrong: false, lastStudied: 0 }), ...data, wordId, bookId };
    return this._promisify(s.put(merged));
  }

  static async getTodayNewWords(bookId, count) {
    return this._getNewWordsSimple(bookId, count);
  }

  static async _getNewWordsSimple(bookId, count) {
    const allWords = WORDS[bookId] || [];
    const learned = new Set();

    if (this._memoryOnly) {
      // 内存模式：直接从 _memoryStores 获取已学记录
      for (const [key, uw] of Object.entries(this._memoryStores.userWords)) {
        if (uw.bookId === bookId) learned.add(uw.wordId);
      }
    } else {
      // IndexedDB 模式：一次性加载该词库所有已学记录，避免逐词查询
      const s = this._tx('userWords');
      const idx = s.index('bookId');
      await new Promise((resolve) => {
        const req = idx.openCursor(IDBKeyRange.only(bookId));
        req.onsuccess = (e) => {
          const c = e.target.result;
          if (c) { learned.add(c.value.wordId); c.continue(); }
          else resolve();
        };
        req.onerror = () => resolve();
      });
    }

    const result = [];
    for (const w of allWords) {
      if (result.length >= count) break;
      const wid = bookId + ':' + w.w;
      if (!learned.has(wid)) {
        result.push(w);
      } else {
        // 已在 DB 中，需检查是否仍为 NEW 状态
        const uw = await this.getUserWord(wid, bookId);
        if (uw.status === 'NEW') result.push(w);
      }
    }
    return result;
  }

  static async getDueWords(bookId) {
    const now = Date.now();
    const all = this._memoryOnly
      ? this._memGetAll('userWords')
      : await this._promisify(this._db.transaction('userWords', 'readonly').objectStore('userWords').getAll());
    // 错词优先复习（无论 nextReviewTime），然后按时间排序正常到期单词
    const wrongWords = [];
    const dueWords = [];
    for (const uw of all) {
      if (uw.bookId !== bookId || uw.status === 'NEW') continue;
      const wd = this._findWord(uw.wordId, bookId);
      if (!wd) continue;
      if (uw.isWrong) {
        wrongWords.push({ ...wd, userWord: uw });
      } else if (uw.nextReviewTime > 0 && uw.nextReviewTime <= now) {
        dueWords.push({ ...wd, userWord: uw });
      }
    }
    return [...wrongWords, ...dueWords];
  }

  static async getWrongWords(bookId) {
    const all = this._memoryOnly
      ? this._memGetAll('userWords')
      : await this._promisify(this._db.transaction('userWords', 'readonly').objectStore('userWords').getAll());
    const results = [];
    for (const uw of all) {
      if (uw.isWrong === true && uw.bookId === bookId) {
        const wd = this._findWord(uw.wordId, bookId);
        if (wd) results.push({ ...wd, userWord: uw });
      }
    }
    return results;
  }

  static async getStarredWords(bookId) {
    const all = this._memoryOnly
      ? this._memGetAll('userWords')
      : await this._promisify(this._db.transaction('userWords', 'readonly').objectStore('userWords').getAll());
    const results = [];
    for (const uw of all) {
      if (uw.isStarred === true && uw.bookId === bookId) {
        const wd = this._findWord(uw.wordId, bookId);
        if (wd) results.push({ ...wd, userWord: uw });
      }
    }
    return results;
  }

  static _findWord(wordId, bookId) {
    const bookData = WORDS[bookId];
    if (!bookData) return null;
    // IELTS 等章节结构：{ ch1: [...], ch2: [...] }，扁平化为数组
    const allWords = Array.isArray(bookData) ? bookData
      : Object.values(bookData).flat();
    // 兼容旧格式 word_book（abandon_ielts）和新格式 book_word（ielts_abandon）或 book:word（ielts:abandon）
    let word = wordId;
    if (bookId) {
      const eb = bookId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      word = wordId.replace(new RegExp('^' + eb + '[:_]'), '');
      if (word === wordId) word = wordId.replace(new RegExp('[_:]' + eb + '$'), '');
    }
    return allWords.find(w => w.w === word) || null;
  }

  static async getStats() {
    const all = this._memoryOnly
      ? this._memGetAll('userWords')
      : await this._promisify(this._db.transaction('userWords', 'readonly').objectStore('userWords').getAll());
    let totalLearned = 0, todayLearned = 0;
    const today = new Date().toDateString();
    const streak = this._calcStreak(all);
    
    for (const uw of all) {
      if (uw.status !== 'NEW') totalLearned++;
      if (uw.lastStudied && new Date(uw.lastStudied).toDateString() === today) todayLearned++;
    }
    
    const dueCount = all.filter(uw => uw.status !== 'NEW' && (uw.isWrong || (uw.nextReviewTime > 0 && uw.nextReviewTime <= Date.now()))).length;
    const wrongCount = all.filter(uw => uw.isWrong).length;
    
    return { totalLearned, todayLearned, streak, dueCount, wrongCount };
  }

  static _calcStreak(allWords) {
    const dates = new Set();
    for (const uw of allWords) {
      if (uw.lastStudied) dates.add(new Date(uw.lastStudied).toDateString());
    }
    let streak = 0;
    const d = new Date();
    while (dates.has(d.toDateString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  static async addStudyRecord(record) {
    record.date = record.date || new Date().toISOString();
    if (this._memoryOnly) {
      const id = Date.now();
      this._memoryStores.studyRecords[id] = { ...record, id };
      return id;
    }
    const s = this._tx('studyRecords', 'readwrite');
    return this._promisify(s.add(record));
  }

  static async getTodayRecords() {
    const today = new Date().toDateString();
    const all = this._memoryOnly
      ? this._memGetAll('studyRecords')
      : await this._promisify(this._db.transaction('studyRecords', 'readonly').objectStore('studyRecords').getAll());
    return all.filter(r => new Date(r.date).toDateString() === today);
  }

  static async exportAll() {
    if (this._memoryOnly) {
      return {
        userWords: this._memGetAll('userWords'),
        studyRecords: this._memGetAll('studyRecords'),
        settings: this._memGetAll('settings'),
        exportTime: new Date().toISOString()
      };
    }
    const uw = await this._promisify(this._db.transaction('userWords', 'readonly').objectStore('userWords').getAll());
    const sr = await this._promisify(this._db.transaction('studyRecords', 'readonly').objectStore('studyRecords').getAll());
    const st = await this._promisify(this._db.transaction('settings', 'readonly').objectStore('settings').getAll());
    return { userWords: uw, studyRecords: sr, settings: st, exportTime: new Date().toISOString() };
  }

  static async importAll(data) {
    if (this._memoryOnly) {
      for (const item of (data.userWords || [])) this._memoryStores.userWords[`${item.wordId}|${item.bookId}`] = item;
      for (const item of (data.studyRecords || [])) this._memoryStores.studyRecords[item.id || Date.now()] = item;
      for (const item of (data.settings || [])) this._memoryStores.settings[item.key] = item;
      return;
    }
    const uws = this._tx('userWords', 'readwrite');
    for (const item of (data.userWords || [])) await this._promisify(uws.put(item));
    const srs = this._tx('studyRecords', 'readwrite');
    for (const item of (data.studyRecords || [])) { delete item.id; await this._promisify(srs.add(item)); }
    const sts = this._tx('settings', 'readwrite');
    for (const item of (data.settings || [])) await this._promisify(sts.put(item));
  }

  static async resetAll() {
    if (this._memoryOnly) {
      this._memoryStores = { userWords: {}, studyRecords: {}, settings: {} };
      return;
    }
    const names = ['userWords', 'studyRecords', 'settings'];
    for (const n of names) {
      const s = this._tx(n, 'readwrite');
      await this._promisify(s.clear());
    }
  }

  static async getSetting(key, defaultVal = null) {
    if (this._memoryOnly) {
      const result = this._memGet('settings', key);
      return result !== undefined ? result.value : defaultVal;
    }
    const s = this._tx('settings');
    const result = await this._promisify(s.get(key));
    return result ? result.value : defaultVal;
  }

  static async setSetting(key, val) {
    if (this._memoryOnly) {
      this._memoryStores.settings[key] = { key, value: val };
      return;
    }
    const s = this._tx('settings', 'readwrite');
    return this._promisify(s.put({ key, value: val }));
  }
}

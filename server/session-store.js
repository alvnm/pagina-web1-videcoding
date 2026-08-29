/* ============================================
   Supabase Session Store for express-session
   Persists sessions in Supabase so they survive
   serverless cold starts and restarts.
   ============================================ */

const Store = require('express-session').Store;
const supabase = require('./supabase');

class SupabaseSessionStore extends Store {
  constructor(options = {}) {
    super(options);
    this.table = options.table || 'sessions';
    this.ttl = options.ttl || 7 * 24 * 60 * 60; // 7 days in seconds (matches cookie maxAge)
    this._tableReady = null; // null = unknown, true = ready, false = missing
    this._fallback = new Map(); // in-memory fallback when table is missing
    this._ensureTable();
  }

  /**
   * Ensure the sessions table exists in Supabase.
   * If it doesn't exist, enable in-memory fallback and log instructions.
   */
  async _ensureTable() {
    try {
      const { error } = await supabase.from(this.table).select('sid').limit(1);
      if (error && error.code === '42P01') {
        console.error('');
        console.error('🔴 ════════════════════════════════════════════════════════');
        console.error('🔴  SESSIONS TABLE NOT FOUND in Supabase!');
        console.error('🔴  Sessions will use in-memory fallback (lost on restart).');
        console.error('🔴');
        console.error('🔴  To fix: Run the SQL in supabase-sessions.sql in your');
        console.error('🔴  Supabase Dashboard → SQL Editor → New Query → Run');
        console.error('🔴 ════════════════════════════════════════════════════════');
        console.error('');
        this._tableReady = false;
      } else if (error) {
        console.error('🔴 Sessions table check error:', error.message);
        this._tableReady = false;
      } else {
        this._tableReady = true;
        console.log('✅ Sessions table found and accessible.');
      }
    } catch (err) {
      console.error('⚠️ Sessions table check failed:', err.message);
      this._tableReady = false;
    }
  }

  /**
   * Wait for table check to complete (with timeout)
   */
  async _waitForTableCheck(timeoutMs = 3000) {
    if (this._tableReady !== null) return this._tableReady;
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (this._tableReady !== null) return resolve(this._tableReady);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(check, 50);
      };
      check();
    });
  }

  /**
   * Get a session by ID
   */
  get(sid, callback) {
    const doGet = async () => {
      // If table is known to be missing, use fallback
      if (this._tableReady === false) {
        const sess = this._fallback.get(sid) || null;
        return callback(null, sess);
      }

      try {
        const { data, error } = await supabase
          .from(this.table)
          .select('sess, expires')
          .eq('sid', sid)
          .single();

        if (error || !data) {
          if (error && error.code === '42P01') {
            // Table doesn't exist — switch to fallback mode
            this._tableReady = false;
            const sess = this._fallback.get(sid) || null;
            return callback(null, sess);
          }
          if (error && error.code !== 'PGRST116') {
            console.error('❌ Session get error:', error.message);
          }
          return callback(null, null);
        }

        const sess = data.sess;

        // Check if session has expired
        const expiredByCookie = sess && sess.cookie && sess.cookie.expires
          ? new Date(sess.cookie.expires) < new Date()
          : false;
        const expiredByDb = data.expires
          ? new Date(data.expires) < new Date()
          : false;

        if (expiredByCookie || expiredByDb) {
          this.destroy(sid, () => callback(null, null));
          return;
        }

        callback(null, sess);
      } catch (err) {
        console.error('❌ Session get error (catch):', err.message);
        callback(null, null);
      }
    };

    doGet();
  }

  /**
   * Save a session
   */
  set(sid, sess, callback) {
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).toISOString()
      : new Date(Date.now() + this.ttl * 1000).toISOString();

    const doSet = async () => {
      // If table is known to be missing, use fallback
      if (this._tableReady === false) {
        this._fallback.set(sid, sess);
        return callback && callback(null);
      }

      try {
        const { error } = await supabase
          .from(this.table)
          .upsert({ sid, sess, expires }, { onConflict: 'sid' });

        if (error) {
          if (error.code === '42P01') {
            // Table doesn't exist — switch to fallback
            this._tableReady = false;
            this._fallback.set(sid, sess);
            console.warn('⚠️ Sessions table missing — using in-memory fallback.');
            return callback && callback(null);
          }
          console.error('❌ Session set error:', error.message, '| Code:', error.code);
          // Still save to fallback so the session works within this instance
          this._fallback.set(sid, sess);
          return callback && callback(null);
        }

        callback && callback(null);
      } catch (err) {
        console.error('❌ Session set error (catch):', err.message);
        this._fallback.set(sid, sess);
        callback && callback(null);
      }
    };

    doSet();
  }

  /**
   * Destroy a session by ID
   */
  destroy(sid, callback) {
    this._fallback.delete(sid);

    const doDestroy = async () => {
      if (this._tableReady === false) {
        return callback && callback(null);
      }

      try {
        const { error } = await supabase
          .from(this.table)
          .delete()
          .eq('sid', sid);

        if (error && error.code === '42P01') {
          this._tableReady = false;
          return callback && callback(null);
        }
        if (error) {
          console.error('❌ Session destroy error:', error.message);
          return callback && callback(error);
        }
        callback && callback(null);
      } catch (err) {
        console.error('❌ Session destroy error (catch):', err.message);
        callback && callback(err);
      }
    };

    doDestroy();
  }

  /**
   * Touch a session (update expiry and data without re-reading)
   */
  touch(sid, sess, callback) {
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).toISOString()
      : new Date(Date.now() + this.ttl * 1000).toISOString();

    // Always update fallback
    this._fallback.set(sid, sess);

    const doTouch = async () => {
      if (this._tableReady === false) {
        return callback && callback(null);
      }

      try {
        const { error } = await supabase
          .from(this.table)
          .update({ expires, sess, updated_at: new Date().toISOString() })
          .eq('sid', sid);

        if (error && error.code === '42P01') {
          this._tableReady = false;
          return callback && callback(null);
        }
        if (error) {
          console.error('❌ Session touch error:', error.message);
          return callback && callback(error);
        }
        callback && callback(null);
      } catch (err) {
        console.error('❌ Session touch error (catch):', err.message);
        callback && callback(err);
      }
    };

    doTouch();
  }

  /**
   * Clean up expired sessions
   */
  async cleanup() {
    // Clean up in-memory fallback
    const now = new Date();
    for (const [sid, sess] of this._fallback.entries()) {
      if (sess && sess.cookie && sess.cookie.expires) {
        if (new Date(sess.cookie.expires) < now) {
          this._fallback.delete(sid);
        }
      }
    }

    if (this._tableReady === false) return;

    try {
      const { error } = await supabase
        .from(this.table)
        .delete()
        .lt('expires', new Date().toISOString());

      if (error && error.code === '42P01') {
        this._tableReady = false;
      } else if (error) {
        console.error('❌ Session cleanup error:', error.message);
      }
    } catch (err) {
      console.error('❌ Session cleanup error (catch):', err.message);
    }
  }
}

module.exports = SupabaseSessionStore;

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
    this._ensureTable();
  }

  /**
   * Ensure the sessions table exists in Supabase.
   * If it doesn't exist, we fall back gracefully (table should be created via SQL).
   */
  async _ensureTable() {
    try {
      const { error } = await supabase.from(this.table).select('sid').limit(1);
      if (error && error.code === '42P01') {
        console.warn('⚠️ Sessions table not found. Sessions will use MemoryStore fallback.');
        console.warn('   Run the SQL in supabase-sessions.sql to create the sessions table.');
      }
    } catch {
      // Table might not exist yet — that's ok, we'll handle it
    }
  }

  /**
   * Get a session by ID
   */
  get(sid, callback) {
    supabase
      .from(this.table)
      .select('sess')
      .eq('sid', sid)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          return callback(null, null);
        }

        const sess = data.sess;

        // Check if session has expired
        if (sess && sess.cookie && sess.cookie.expires) {
          if (new Date(sess.cookie.expires) < new Date()) {
            // Session expired, destroy it
            this.destroy(sid, () => callback(null, null));
            return;
          }
        }

        callback(null, sess);
      })
      .catch((err) => {
        console.error('❌ Session get error:', err.message);
        callback(null, null);
      });
  }

  /**
   * Save a session
   */
  set(sid, sess, callback) {
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).toISOString()
      : new Date(Date.now() + this.ttl * 1000).toISOString();

    supabase
      .from(this.table)
      .upsert(
        {
          sid,
          sess,
          expires,
        },
        { onConflict: 'sid' }
      )
      .then(({ error }) => {
        if (error) {
          console.error('❌ Session set error:', error.message);
          return callback && callback(error);
        }
        callback && callback(null);
      })
      .catch((err) => {
        console.error('❌ Session set error:', err.message);
        callback && callback(err);
      });
  }

  /**
   * Destroy a session by ID
   */
  destroy(sid, callback) {
    supabase
      .from(this.table)
      .delete()
      .eq('sid', sid)
      .then(({ error }) => {
        if (error) {
          console.error('❌ Session destroy error:', error.message);
          return callback && callback(error);
        }
        callback && callback(null);
      })
      .catch((err) => {
        console.error('❌ Session destroy error:', err.message);
        callback && callback(err);
      });
  }

  /**
   * Touch a session (update expiry without changing data)
   * This prevents idle sessions from being destroyed
   */
  touch(sid, sess, callback) {
    const expires = sess.cookie && sess.cookie.expires
      ? new Date(sess.cookie.expires).toISOString()
      : new Date(Date.now() + this.ttl * 1000).toISOString();

    supabase
      .from(this.table)
      .update({ expires, updated_at: new Date().toISOString() })
      .eq('sid', sid)
      .then(({ error }) => {
        if (error) {
          console.error('❌ Session touch error:', error.message);
          return callback && callback(error);
        }
        callback && callback(null);
      })
      .catch((err) => {
        console.error('❌ Session touch error:', err.message);
        callback && callback(err);
      });
  }

  /**
   * Clean up expired sessions (optional, can be called periodically)
   */
  async cleanup() {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .lt('expires', new Date().toISOString());

    if (error) {
      console.error('❌ Session cleanup error:', error.message);
    }
  }
}

module.exports = SupabaseSessionStore;

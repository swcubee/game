// Thin wrapper over QSPlaySDK. Every call is safe: if the SDK is missing or a call fails,
// the game keeps running (local file, preview, ad-blockers). Progress falls back to localStorage.
(function () {
  const sdk = () => window.QSPlaySDK;
  const safe = async fn => { try { return await fn(); } catch (e) { console.warn('[sdk]', e && (e.code || e.message || e)); return null; } };
  const local = {
    get(k) { try { const v = localStorage.getItem('spooky-paint:' + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('spooky-paint:' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  let playing = false, loading = false, wantPlay = false, timer = null, pending = null;

  window.SDK = {
    loadingStart() { loading = true; safe(() => sdk() && sdk().game.loadingStart()); },
    // gameplayStart asked for during boot is sent after loadingStop, so the portal sees them in order
    async loadingStop() { loading = false; await safe(() => sdk() && sdk().game.loadingStop()); if (wantPlay) { wantPlay = false; this.gameplayStart(); } },
    // gameplay = the player can act; stop on menus, overlays, lost focus
    gameplayStart() { if (loading) { wantPlay = true; return; } if (playing) return; playing = true; safe(() => sdk() && sdk().game.gameplayStart()); },
    gameplayStop() { wantPlay = false; if (!playing) return; playing = false; safe(() => sdk() && sdk().game.gameplayStop()); },
    async config() {
      const c = sdk() ? await safe(() => sdk().game.getConfig()) : null;
      return c || { locale: navigator.language || 'en', deviceType: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop' };
    },
    async load(key) {
      if (sdk()) { const v = await safe(() => sdk().data.getItem(key)); if (v != null) return v; }
      return local.get(key);
    },
    // debounced: painting fires many small changes
    save(key, value) {
      pending = [key, value];
      clearTimeout(timer);
      timer = setTimeout(this.flush, 1200);
    },
    flush() {
      if (!pending) return; const [key, value] = pending; pending = null;
      local.set(key, value);
      if (sdk()) sdk().data.setItem(key, value).catch(e => {
        if (e && e.code === 'DATA_QUOTA_EXCEEDED') console.warn('[sdk] save quota exceeded');
        else console.warn('[sdk] save failed', e);
      });
    },
    reportLevel(n) { safe(() => sdk() && sdk().game.reportPlayerLevel && sdk().game.reportPlayerLevel(n)); },
  };
  addEventListener('pagehide', () => SDK.flush());
})();

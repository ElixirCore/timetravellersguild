/* Guild tools for the ElevenLabs voice door. CSRF stays in the browser.
   The agent must also have a matching client tool named lodge_testimony. */
(function (global) {
  'use strict';

  function cfg() {
    return global.TTG_VOICE || {};
  }

  function truthy(v) {
    if (v === true || v === 1) return true;
    var s = String(v == null ? '' : v).toLowerCase().trim();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  }

  function fail(msg) {
    return JSON.stringify({ ok: false, error: msg });
  }

  function guildContext() {
    return [
      'GUILD RECORD: You may lodge testimony with the client tool lodge_testimony.',
      'Ask the visitor first. Call only when they confirm.',
      'Pass their words in testimony, not your paraphrase, unless they asked you to tidy it.',
      'Set confirmed to true. Optional title is a short heading for the slip.',
      'The server holds pending leaves. This is not canon. Do not say you filed unless the tool returned ok.',
      'Speak the clerk text the tool returns. If it fails, say the desk could not hold it.'
    ].join(' ');
  }

  function pageContext() {
    var page = '';
    if (global.ffilmAgent && global.ffilmAgent.buildContext) {
      try { page = String(global.ffilmAgent.buildContext() || ''); } catch (e) {}
    }
    return guildContext() + (page ? '\n' + page : '');
  }

  function lodgeTestimony(params) {
    params = params || {};
    var testimony = String(params.testimony || params.account || params.text || '').trim();
    var title = String(params.title || params.instruction || '').trim();
    if (!truthy(params.confirmed)) {
      return Promise.resolve(fail('Ask the visitor to confirm before lodging.'));
    }
    if (!testimony) {
      return Promise.resolve(fail('No testimony. Pass the visitor’s words.'));
    }
    var token = String(cfg().csrf || '');
    var endpoint = String(cfg().jack || '/now/jack');
    if (!token) {
      return Promise.resolve(fail('The desk has no signed slip on this page.'));
    }
    var body = new FormData();
    body.set('csrf', token);
    body.set('intent', 'lodge');
    body.set('source', 'voice');
    body.set('confirmed', 'true');
    body.set('site', 'intro');
    body.set('testimony', testimony);
    if (title) body.set('q', title);
    return fetch(endpoint, { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (res) {
        return res.text().then(function (raw) {
          var data = null;
          try { data = JSON.parse(raw); } catch (e) {}
          if (!data || typeof data !== 'object') {
            return fail(res.ok ? 'The desk returned an unreadable slip.' : 'The desk did not take the statement.');
          }
          var nodes = Array.isArray(data.nodes) ? data.nodes.length : 0;
          var text = String(data.text || data.error || '');
          return JSON.stringify({
            ok: !!(data.ok && data.ingested),
            ingested: !!data.ingested,
            text: text,
            leaves: nodes,
            error: data.ok ? '' : (text || 'The desk did not take the statement.')
          });
        });
      })
      .catch(function () {
        return fail('The desk did not answer.');
      });
  }

  /* A voice sitting for /jack/llm. Opaque: who the visitor is stays on the server.
     Resolves to '' if the desk will not sign one; the call still goes ahead, unremembered. */
  function sitting() {
    var token = String(cfg().csrf || '');
    if (!token || !global.fetch) return Promise.resolve('');
    var body = new FormData();
    body.set('csrf', token);
    body.set('site', String(cfg().site || 'intro'));
    return fetch(String(cfg().sitting || '/jack/sitting'), { method: 'POST', body: body, credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) { return data && data.ok && typeof data.sitting === 'string' ? data.sitting : ''; })
      .catch(function () { return ''; });
  }

  function clientTools() {
    var tools = {};
    if (global.ffilmAgent && global.ffilmAgent.clientTools) {
      try { Object.assign(tools, global.ffilmAgent.clientTools); } catch (e) {}
    }
    tools.lodge_testimony = lodgeTestimony;
    return tools;
  }

  global.JackGuild = {
    sitting: sitting,
    pageContext: pageContext,
    clientTools: clientTools,
    lodgeTestimony: lodgeTestimony
  };
})(window);

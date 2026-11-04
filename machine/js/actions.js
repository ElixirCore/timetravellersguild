/* TIME MACHINE №13 — named actions. Blueprint parts refer to these by name. */
(function (TTGM) {
  'use strict';

  var A = TTGM.action;

  A('openJack', function (m) { location.href = m.cfg.jack || '/jack'; });
  A('toggleReadout', function (m) { m.ui.toggleReadout(); });
  A('page', function (m, args) { m.store.set({ page: args.page || 'STATE' }); });
  A('pageField', function (m) { m.store.set({ page: m.store.get('page') === 'FIELD' ? 'STATE' : 'FIELD' }); });
  A('cyclePage', function (m) {
    var pages = m.blueprint.pages || ['STATE'];
    var i = pages.indexOf(m.store.get('page'));
    m.store.set({ page: pages[(i + 1) % pages.length] });
  });

  A('sync', function (m) { m.store.set({ present: new Date() }, { commit: true }); });
  A('setTime', function (m, args) {
    var d = new Date(args.at);
    if (!isNaN(d.getTime())) m.store.set({ present: d }, { commit: true });
  });
  A('wind', function (m, args) {
    var s = m.store.state;
    m.store.set({ present: TTGM.util.step(s.present, s.wind || 'YEAR', args.n || 1) }, { commit: true });
  });

  A('toggleHold', function (m) { m.store.set({ held: !m.store.get('held') }); });
  A('reset', function (m) {
    var d = m.defaults;
    m.store.set({
      mind: d.mind, matter: d.matter, kappa: d.kappa,
      dcAxis: 'TIME', wind: 'YEAR', held: false, excluded: [],
      focus: '', present: new Date(), destIndex: 0, fault: '',
    }, { commit: true });
  });

  A('destStep', function (m, args) {
    var n = m.destinations().length;
    var i = TTGM.util.clamp((m.store.get('destIndex') || 0) + (args.n || 1), 0, Math.max(0, n - 1));
    m.store.set({ destIndex: i });
  });
  A('destTo', function (m, args) {
    var list = m.destinations();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === args.id || (args.slug && list[i].slug === args.slug)) { m.store.set({ destIndex: i }); return true; }
    }
    return false;
  });

  A('travel', function (m) { return m.journey.start(); });
  A('mute', function (m) { m.sound.setMuted(!m.sound.muted); m.ui.syncMute(); });
})(window.TTGM);

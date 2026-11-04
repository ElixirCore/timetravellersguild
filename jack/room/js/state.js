/* JackState, provenance, localStorage. Source memory is never overwritten. */
(function (J) {
  'use strict';

  var KEY = 'ttg.jack.body.v2';
  var listeners = [];

  function nowIso() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function emptyBody() {
    return {
      position: { x: 0, y: 1.62, z: 5.4 },
      yaw: Math.PI,
      pitch: 0,
      yawV: 0,
      focus: null,
      pressure: 0.08,
      energy: 1,
      limbs: {
        head: { status: 'idle', yaw: Math.PI, focus: null },
        heart: { status: 'idle', pressure: 0.08, relevance: 0 },
        leftArm: { status: 'idle', reach: 0, holding: null },
        rightArm: { status: 'idle', mode: 'idle' },
        leftLeg: { status: 'idle', lateral: 0 },
        rightLeg: { status: 'idle', depth: 0 }
      }
    };
  }

  function emptyState() {
    return {
      body: emptyBody(),
      room: { objects: [], relations: [], selectedObject: null, bounds: null, label: '' },
      context: {
        mode: 'ROOM',
        activeCard: null,
        sourceObject: null,
        history: [],
        consoleText: '',
        phase: 'SENSE',
        voiceText: '',
        talk: []
      },
      nervousSystem: { events: [] }
    };
  }

  var state = emptyState();

  function emit(type, detail) {
    for (var i = 0; i < listeners.length; i++) listeners[i](type, detail, state);
  }

  function persist() {
    try {
      var snap = {
        body: {
          position: state.body.position,
          yaw: state.body.yaw,
          pitch: state.body.pitch,
          focus: state.body.focus,
          pressure: state.body.pressure,
          energy: state.body.energy
        },
        room: {
          objects: state.room.objects,
          relations: state.room.relations,
          selectedObject: state.room.selectedObject
        },
        context: state.context,
        nervousSystem: { events: state.nervousSystem.events.slice(-200) }
      };
      localStorage.setItem(KEY, JSON.stringify(snap));
    } catch (e) {}
  }

  function loadPersisted() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function derived(partial) {
    return {
      id: partial.id || uid('jnode'),
      type: partial.type || 'derived',
      createdAt: partial.createdAt || nowIso(),
      sourceIds: partial.sourceIds ? partial.sourceIds.slice() : [],
      operation: partial.operation || 'unknown',
      payload: partial.payload || {},
      author: 'jack'
    };
  }

  function byId(id) {
    if (!id) return null;
    var objs = state.room.objects;
    for (var i = 0; i < objs.length; i++) if (objs[i].id === id) return objs[i];
    var hist = state.context.history;
    for (var h = 0; h < hist.length; h++) if (hist[h].id === id) return hist[h];
    if (state.context.activeCard && state.context.activeCard.id === id) return state.context.activeCard;
    return null;
  }

  function provenanceChain(node) {
    var out = [];
    var seen = {};
    function walk(n) {
      if (!n || seen[n.id]) return;
      seen[n.id] = true;
      var ids = n.sourceIds || [];
      for (var i = 0; i < ids.length; i++) walk(byId(ids[i]));
      out.push(n);
    }
    walk(node);
    return out;
  }

  function nerve(subsystem, action, target, result) {
    var ev = {
      time: nowIso(),
      subsystem: subsystem,
      action: action,
      target: target || '—',
      result: result || 'ok'
    };
    state.nervousSystem.events.push(ev);
    if (state.nervousSystem.events.length > 400) {
      state.nervousSystem.events.splice(0, state.nervousSystem.events.length - 400);
    }
    emit('nerve', ev);
    persist();
    return ev;
  }

  function rememberNode(node) {
    if (!node || !node.id) return null;
    var hist = state.context.history;
    for (var i = 0; i < hist.length; i++) {
      if (hist[i].id === node.id) return hist[i];
    }
    hist.push(node);
    emit('history', node);
    persist();
    return node;
  }

  function addWorldObject(obj) {
    if (!obj || !obj.id) return null;
    var objs = state.room.objects;
    for (var i = 0; i < objs.length; i++) {
      if (objs[i].id === obj.id) return objs[i];
    }
    objs.push(obj);
    emit('world', obj);
    persist();
    return obj;
  }

  function selectObject(id) {
    state.room.selectedObject = id || null;
    state.body.focus = id || null;
    state.body.limbs.head.focus = id || null;
    emit('select', id);
    persist();
  }

  function setMode(mode) {
    state.context.mode = mode === 'BENCH' ? 'BENCH' : 'ROOM';
    emit('mode', state.context.mode);
    persist();
  }

  function setPhase(phase) {
    state.context.phase = phase;
    emit('phase', phase);
  }

  function exportState() {
    return clone(state);
  }

  function resetBody() {
    localStorage.removeItem(KEY);
    state = emptyState();
    emit('reset', null);
  }

  function wallClearance(pos, b) {
    return Math.min(
      (pos.x || 0) - b.minX,
      b.maxX - (pos.x || 0),
      (pos.z || 0) - b.minZ,
      b.maxZ - (pos.z || 0)
    );
  }

  function crampedPose(pos) {
    if (!pos) return true;
    var b = state.room.bounds || { minX: -3.6, maxX: 3.6, minZ: -3.6, maxZ: 3.6 };
    if (wallClearance(pos, b) < 0.9) return true;
    return Math.hypot((pos.x || 0) - 0.1, (pos.z || 0) + 0.55) < 1.55;
  }

  function applySeed(room, saved) {
    state = emptyState();
    state.room.objects = clone(room.objects || []);
    state.room.relations = clone(room.relations || []);
    state.room.bounds = room.bounds || null;
    state.room.label = room.label || 'JACK / ROOM';
    var spawn = room.spawn || {};
    state.body.position.x = spawn.x || 0;
    state.body.position.y = spawn.y || 1.62;
    state.body.position.z = spawn.z || 5.4;
    state.body.yaw = spawn.yaw != null ? spawn.yaw : Math.PI;

    if (saved) {
      if (saved.body) {
        var keepPose = saved.body.position && !crampedPose(saved.body.position);
        if (keepPose) {
          state.body.position = saved.body.position;
          if (typeof saved.body.yaw === 'number') state.body.yaw = saved.body.yaw;
        }
        if (typeof saved.body.pitch === 'number') {
          state.body.pitch = Math.abs(saved.body.pitch) > 0.62 ? 0 : saved.body.pitch;
        }
        if (typeof saved.body.pressure === 'number') state.body.pressure = saved.body.pressure;
        if (typeof saved.body.energy === 'number') state.body.energy = saved.body.energy;
        state.body.focus = saved.body.focus || null;
      }
      if (saved.room) {
        if (Array.isArray(saved.room.objects) && saved.room.objects.length) {
          mergeObjects(saved.room.objects);
        }
        if (Array.isArray(saved.room.relations) && saved.room.relations.length) {
          var have = {};
          for (var ri = 0; ri < state.room.objects.length; ri++) have[state.room.objects[ri].id] = true;
          state.room.relations = saved.room.relations.filter(function (rel) {
            return have[rel.from] && have[rel.to];
          });
          if (!state.room.relations.length) state.room.relations = clone(room.relations || []);
          var haveRel = {};
          for (var rk = 0; rk < state.room.relations.length; rk++) haveRel[state.room.relations[rk].id] = true;
          var seedRels = room.relations || [];
          for (var si = 0; si < seedRels.length; si++) {
            if (!haveRel[seedRels[si].id] && have[seedRels[si].from] && have[seedRels[si].to]) {
              state.room.relations.push(seedRels[si]);
            }
          }
        }
        if (saved.room.selectedObject && byId(saved.room.selectedObject)) {
          state.room.selectedObject = saved.room.selectedObject;
        } else {
          state.room.selectedObject = null;
        }
        state.body.focus = state.room.selectedObject;
      }
      if (saved.context) {
        state.context.activeCard = saved.context.activeCard || null;
        state.context.sourceObject = saved.context.sourceObject || null;
        state.context.history = saved.context.history || [];
        state.context.consoleText = saved.context.consoleText || '';
        state.context.mode = saved.context.mode || 'ROOM';
        state.context.voiceText = saved.context.voiceText || '';
        state.context.talk = Array.isArray(saved.context.talk) ? saved.context.talk : [];
      }
      if (saved.nervousSystem && Array.isArray(saved.nervousSystem.events)) {
        state.nervousSystem.events = saved.nervousSystem.events;
      }
    }
    emit('boot', null);
  }

  function mergeObjects(extra) {
    var have = {};
    for (var i = 0; i < state.room.objects.length; i++) have[state.room.objects[i].id] = i;
    for (var j = 0; j < extra.length; j++) {
      var o = extra[j];
      if (!o || !o.id) continue;
      if (have[o.id] == null) {
        if (o.type === 'person') continue;
        /* derived world objects only — never replace seeded source memory */
        if (o.author === 'jack' || (o.sourceIds && o.sourceIds.length)) {
          state.room.objects.push(o);
        }
      }
    }
  }

  J.State = {
    KEY: KEY,
    get: function () { return state; },
    on: function (fn) { listeners.push(fn); },
    persist: persist,
    loadPersisted: loadPersisted,
    applySeed: applySeed,
    derived: derived,
    byId: byId,
    provenanceChain: provenanceChain,
    nerve: nerve,
    rememberNode: rememberNode,
    addWorldObject: addWorldObject,
    selectObject: selectObject,
    setMode: setMode,
    setPhase: setPhase,
    exportState: exportState,
    resetBody: resetBody,
    uid: uid,
    nowIso: nowIso,
    clone: clone
  };
})(window.Jack = window.Jack || {});

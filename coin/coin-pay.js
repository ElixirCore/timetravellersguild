/* /coin/coin-pay.js - till wiring for the Money-box Jack reference build.
   Payments are PAUSED server-side (COINDROP_PAUSED=true in stripe-config.php):
   pay.php answers 503 and no Stripe checkout is created. Until the till opens,
   drops run the reference demo and the till line says the box is in rehearsal.
   Jack's recorded blessing (audio.mp3, the voice note) is the prize for ANY
   £1 dropped - rehearsal or paid. A paid coin (?session_id from the Stripe
   success redirect) is verified server-side and spends exactly once. */
(function () {
  const BLESSING = "/coin/audio.mp3";
  const tillEl = document.getElementById("tillLine");
  const tallyEl = document.getElementById("tally");
  const dropBtn = document.getElementById("dropBtn");
  let paid = null;

  async function post(url, body) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json().catch(() => ({}));
  }
  function setTill(t) { if (tillEl) tillEl.textContent = t; }

  const params = new URLSearchParams(location.search);
  const sid = params.get("session_id");

  window.TTG_TILL = {
    voiceLine: { text: "[bow]", audio: BLESSING }, /* the recorded blessing plays for every drop, paid or rehearsal */
    tally(pounds) {
      if (!tallyEl) return;
      tallyEl.textContent = paid
        ? "\u00a3" + pounds + " received this visit"
        : pounds + " rehearsal coin" + (pounds === 1 ? "" : "s") + " \u00b7 till closed";
    },
    async beforeDrop() {
      if (paid && paid.spent) {
        /* coin already in the box: replay the blessing, no new coin run */
        if (window.TTG_COINDROP) window.TTG_COINDROP.speakLine(0);
        return false;
      }
      if (paid) {
        /* register the one allowed drop, then let the coin run */
        setTill("Registering the drop\u2026");
        const r = await post("/coin/coin.php", { action: "drop", session_id: paid.session_id, token: paid.token });
        if (r.ok) { paid.spent = true; setTill("Coin " + paid.coin + " is in the box \u00b7 drop again for the blessing"); return true; }
        setTill(r.reason === "already_spent" ? "That coin is already in the box" : "The ledger refused the coin");
        return false;
      }
      /* unpaid: ask the till first (paused: 503, no checkout), then run the reference demo */
      setTill("Checking the till\u2026");
      const r = await post("/coin/pay.php", {});
      if (r.url) { location.href = r.url; return false; } /* live path, only once the till opens */
      setTill(r.error === "rate_limited"
        ? "The till is resting \u00b7 rehearsal continues"
        : "The till is not open yet \u00b7 the box is still in rehearsal");
      return true;
    }
  };

  if (params.get("cancelled")) setTill("Payment cancelled \u00b7 the slot is patient");

  if (sid) {
    setTill("Checking the Guild ledger\u2026");
    post("/coin/coin.php", { action: "status", session_id: sid }).then(r => {
      if (r.ok) {
        paid = { coin: r.coin, token: r.token, session_id: sid, spent: r.spent };
        if (dropBtn) dropBtn.textContent = paid.spent ? "Hear Jack again" : "Drop paid coin";
        setTill(paid.spent
          ? "Coin " + paid.coin + " is in the box \u00b7 drop again for the blessing"
          : "Coin paid \u00b7 \u00a31 \u00b7 " + paid.coin + " \u00b7 drop it in");
      } else setTill("No paid coin found for that session");
    }).catch(() => setTill("The ledger is unreachable"));
  }
})();

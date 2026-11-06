<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/db.php';
require_once __DIR__ . '/../inc/terms.php';
$user = ttg_current_user();
if (!$user) ttg_redirect(ttg_base('auth/'));
if (trim((string) ($user['briefing'] ?? '')) === '') {
    $fromCookie = ttg_briefing_json(ttg_briefing_read());
    if ($fromCookie !== '') {
        ttg_user_keep_briefing((int) $user['id'], $fromCookie);
        $user['briefing'] = $fromCookie;
    }
}
$heldBrief = ttg_briefing_clean(json_decode((string) ($user['briefing'] ?? ''), true));
$briefNote = ttg_briefing_note($heldBrief);
$pixels = ttg_pixel_parse($user['avatar'] ?? ($user['avatar_pixels'] ?? ''));
$punched = isset($_GET['punched']);
$pageTitle = 'Your slip — Time Travellers Guild';

/* ── Passport lookup ── */
$passportCitizen = null;
(function () use (&$passportCitizen, $user) {
    $reg = dirname(__DIR__, 4) . '/ttg-passport/citizens.json';
    if (!is_file($reg)) return;
    $data = json_decode(@file_get_contents($reg), true);
    if (!is_array($data)) return;
    $needle = mb_strtolower(trim((string) ($user['display_name'] ?? '')));
    if ($needle === '') return;
    foreach ($data as $c) {
        if (mb_strtolower(trim((string) ($c['name'] ?? ''))) === $needle) {
            $passportCitizen = $c;
            return;
        }
    }
})();

require __DIR__ . '/../inc/header.php';
?>
<main class="profile-wrap">
  <p class="presents">IBM 5081 · YOUR SLIP · NOT CANON</p>
  <p id="jackForm">PUNCH YOUR OWN CARD</p>

  <form class="slip form-slip" id="profileForm" method="post" action="<?= ttg_h(ttg_base('profile/save.php')) ?>">
    <input type="hidden" name="csrf" value="<?= ttg_h(ttg_csrf_token()) ?>">
    <input type="hidden" name="avatar_pixels" id="avatarPixels" value="<?= ttg_h((string) json_encode($pixels, JSON_UNESCAPED_SLASHES)) ?>">

    <p class="beat-label">WORKING PUNCHCARD</p>
    <p class="lede">This is your card. Paint the stamp. Type the columns. The holes follow the name. Shared rooms will read the 9×9 as your face.</p>

    <div class="card-face">
      <div class="stamp-block">
        <p class="label">9×9 STAMP</p>
        <div id="pxGrid" class="px-grid" role="grid" aria-label="Nine by nine pixel stamp"></div>
        <div class="px-tools">
          <label class="sr" for="pxColor">Colour</label>
          <input id="pxColor" type="color" value="#1e3a5f" title="Pick a colour">
          <button type="button" id="pxPick" class="ghost">SAMPLE</button>
          <button type="button" id="pxFill" class="ghost">FILL</button>
          <button type="button" id="pxClear" class="ghost">CLEAR</button>
        </div>
        <p class="label">PALETTE</p>
        <div class="px-swatches" id="pxSwatches" role="listbox" aria-label="Stamp colour palette"></div>
      </div>
      <div class="card-fields">
        <label for="display_name">Name</label>
        <input id="display_name" name="display_name" value="<?= ttg_h((string) $user['display_name']) ?>" required maxlength="80" autocomplete="name">
        <label for="role">Station / role</label>
        <input id="role" name="role" value="<?= ttg_h((string) $user['role']) ?>" maxlength="80" placeholder="traveller">
        <label for="location">Coordinates</label>
        <input id="location" name="location" value="<?= ttg_h((string) $user['location']) ?>" maxlength="120" placeholder="town, valley, year">
      </div>
    </div>

    <p class="label">HOLLERITH · NAME PUNCH</p>
    <div id="punchPreview" class="punch-preview" aria-hidden="true"></div>

    <label for="bio">Field note</label>
    <textarea id="bio" name="bio" rows="5" maxlength="600" placeholder="What should the register hold about you?"><?= ttg_h((string) $user['bio']) ?></textarea>

    <label class="check" for="is_public">
      <input id="is_public" type="checkbox" name="is_public" value="1" <?= ((int) ($user['is_public'] ?? 0) === 1) ? 'checked' : '' ?>>
      <span>Public record — list this slip on the register</span>
    </label>

    <?php if (!ttg_terms_agreed($user)): ?>
    <label class="check" for="agree_terms">
      <input id="agree_terms" type="checkbox" name="agree_terms" value="1" required>
      <span>I agree to lend my avatar, name and submitted work to the Guild's grand narrative (<a href="/privacy/#narrative">what this means</a>). I keep owning them and can stop at any time.</span>
    </label>
    <?php endif; ?>

    <p class="form-actions">
      <button class="primary" type="submit">PUNCH THE SLIP</button>
      <a class="door" href="<?= ttg_h(ttg_base()) ?>"><b>DOOR</b> THE REGISTER</a>
    </p>
    <p class="status" id="status" role="status"><?= $punched ? 'The slip is punched. Not canon.' : 'Hands on. The stamp is yours. He does not write this for you.' ?></p>
  </form>

  <?php if ($briefNote !== ''): ?>
  <section class="connected slip">
    <p class="beat-label">ARRIVAL · FRONT DOOR BRIEFING</p>
    <p>Filed when you entered. Relevant to the slip. Not canon. Jack does not rewrite it.</p>
    <p class="brief-note"><?= ttg_h($briefNote) ?></p>
  </section>
  <?php endif; ?>

  <!-- ── PASSPORT ── -->
  <section class="connected slip">
    <p class="beat-label">PASSPORT OFFICE · TIME TRAVELLERS GUILD</p>
    <?php if ($passportCitizen): ?>
      <?php
        $ppx = is_array($passportCitizen['avatar_pixels'] ?? null) && count($passportCitizen['avatar_pixels']) === 81
            ? array_values($passportCitizen['avatar_pixels']) : [];
        $pplaces = $passportCitizen['places'] ?? [];
      ?>
      <div class="passport-card">
        <div class="passport-card-left">
          <?php if ($ppx): ?>
          <canvas class="passport-stamp" width="63" height="63"
            data-px="<?= ttg_h(json_encode($ppx)) ?>"
            aria-label="Citizen signet"></canvas>
          <?php else: ?>
          <div class="passport-stamp-ph" aria-hidden="true">XIII</div>
          <?php endif; ?>
        </div>
        <div class="passport-card-body">
          <p class="p-name"><?= ttg_h((string) $passportCitizen['name']) ?></p>
          <p class="p-meta"><?= ttg_h((string) $passportCitizen['number']) ?> · issued <?= ttg_h((string) $passportCitizen['issued']) ?></p>
          <?php if ($pplaces): ?>
          <p class="p-places">
            <?php foreach ($pplaces as $pp): ?>
              <a href="/passport/page/<?= ttg_h((string) $pp['slug']) ?>/">&#10038;&nbsp;<?= ttg_h((string) $pp['name']) ?></a>
            <?php endforeach; ?>
          </p>
          <?php endif; ?>
        </div>
      </div>
      <p class="form-actions" style="margin-top:14px">
        <a class="door" href="/passport/"><b>DOOR</b> THE PASSPORT OFFICE</a>
      </p>
    <?php else: ?>
      <p>No citizen record under this name. The passport office keeps a separate register — pseudonymous, a name and a passphrase, nothing more.</p>
      <p class="form-actions" style="margin-top:14px">
        <a class="door" href="/passport/"><b>DOOR</b> ENROL AT THE PASSPORT OFFICE</a>
      </p>
    <?php endif; ?>
  </section>
  <style>
  .passport-card{display:flex;gap:16px;align-items:flex-start;margin:12px 0 4px}
  .passport-stamp{display:block;image-rendering:pixelated;width:63px;height:63px;border:1px solid currentColor;opacity:.85}
  .passport-stamp-ph{width:63px;height:63px;display:flex;align-items:center;justify-content:center;font-size:14px;letter-spacing:2px;border:1px solid currentColor;opacity:.45}
  .passport-card-body{min-width:0}
  .p-name{font-size:18px;margin:0 0 4px;font-style:italic}
  .p-meta{font-size:11px;letter-spacing:.08em;opacity:.7;margin:0 0 8px;font-family:ui-monospace,Consolas,monospace}
  .p-places{display:flex;flex-wrap:wrap;gap:6px 10px;margin:0;font-size:12px;letter-spacing:.06em}
  .p-places a{text-decoration:none;border-bottom:1px dotted currentColor;color:inherit}
  .p-places a:hover{opacity:.7}
  </style>
  <script>
  document.querySelectorAll('.passport-stamp').forEach(function(c){
    var cells;try{cells=JSON.parse(c.dataset.px||'[]')}catch(e){return}
    if(!Array.isArray(cells)||cells.length!==81)return;
    var ctx=c.getContext('2d'),sz=63/9;
    for(var i=0;i<81;i++){ctx.fillStyle=cells[i]||'#d9cb9e';ctx.fillRect((i%9)*sz,Math.floor(i/9)*sz,sz+.5,sz+.5)}
  });
  </script>

  <?php
  $knocks = ttg_get_knocks((int)$user['id']);
  if ($knocks):
  ?>
  <section class="connected slip">
    <p class="beat-label">INCOMING KNOCKS · THE DOOR</p>
    <p>Recent knocks from other travellers. Reading this clears the unread count.</p>
    <ul class="knock-list">
      <?php foreach ($knocks as $k): ?>
      <li class="knock-item<?= $k['read_at'] ? '' : ' knock-unread' ?>">
        <span class="knock-from"><a href="/people/<?= ttg_h((string) $k['from_slug']) ?>/"><?= ttg_h((string) $k['from_name']) ?></a></span>
        <?php if (trim((string) $k['message']) !== ''): ?><span class="knock-msg">"<?= ttg_h((string) $k['message']) ?>"</span><?php endif; ?>
        <span class="knock-ts"><?= ttg_h(gmdate('d M Y', (int)$k['created_at'])) ?></span>
      </li>
      <?php endforeach; ?>
    </ul>
  </section>
  <?php endif; ?>

  <section class="connected slip">
    <p class="beat-label">CONNECTED INSTRUMENTS</p>
    <p>Doors into connected houses. Signed handoff where a receiver is live; otherwise a plain entrance.</p>
    <div class="handoff-row">
      <?php foreach (ttg_config()['handoff_targets'] as $key => $target): ?>
        <?php $handoff = ttg_handoff_url($user, (string) $key); ?>
        <?php if ($handoff): ?><a class="door" href="<?= ttg_h($handoff) ?>"><b>DOOR</b> <?= ttg_h((string) $target['label']) ?></a><?php endif; ?>
      <?php endforeach; ?>
    </div>
  </section>
</main>
<?php require __DIR__ . '/../inc/footer.php'; ?>

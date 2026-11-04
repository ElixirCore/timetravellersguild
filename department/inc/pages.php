<?php
declare(strict_types=1);

function det_doc_body(array $pub): string {
    $id = (string) ($pub['id'] ?? '');
    $title = det_h((string) det_l($pub, 'title'));
    $sum = det_h((string) det_l($pub, 'summary'));
    $issued = det_h(det_fmt_date((string) ($pub['date'] ?? '')));
    $rev = det_h(det_fmt_date((string) ($pub['revised'] ?? '')));
    $ed = det_h((string) ($pub['edition'] ?? det_ptype((string) ($pub['type'] ?? ''))));
    $html = '<p class="caption">'.$id.' · '.$ed.'</p>';
    $html .= '<h1>'.$title.'</h1>';
    $html .= '<div class="vmeta"><div><dt>'.det_e('pub.published').'</dt><dd>'.$issued.'</dd></div>';
    $html .= '<div><dt>'.det_e('pub.last').'</dt><dd>'.$rev.'</dd></div>';
    $html .= '<div><dt>'.det_e('pub.type').'</dt><dd>'.det_h(det_ptype((string) ($pub['type'] ?? ''))).'</dd></div></div>';
    $html .= '<p class="lede">'.$sum.'</p>';

    $paras = det_la($pub, 'paras');
    if ($paras) {
        foreach ($paras as $para) $html .= '<p>'.det_h((string) $para).'</p>';
    } elseif ($id === 'DET-MANUAL-003') {
        $html .= '<h2>'.det_e('doc.status').'</h2><p>'.det_e('man.p1').'</p><h2>'.det_e('doc.arrival').'</h2><ol class="plain"><li>'.det_e('man.l1').'</li><li>'.det_e('man.l2').'</li><li>'.det_e('man.l3').'</li><li>'.det_e('man.l4').'</li></ol><p>'.det_e('man.coin').' <span class="ttg13" data-ttg13>TTG-13</span></p>';
    } elseif ($id === 'DET-TECH-011') {
        $html .= '<h2>Instrument 13</h2><p>'.det_e('tech.p1').'</p><p>'.det_e('tech.p2').'</p><p class="muted"><span class="ttg13" data-ttg13>TTG-13</span></p>';
    } elseif ($id === 'DET-WEL-007') {
        $html .= '<h2>'.det_e('wel.if').'</h2><p>'.det_e('wel.if.p').'</p><ol class="plain"><li>'.det_e('wel.if.1').'</li><li>'.det_e('wel.if.2').' <a href="'.det_h(det_url('services/report')).'">'.det_e('btn.incident').'</a>.</li><li>'.det_e('wel.if.3').'</li></ol><div class="inset"><p>'.det_e('wel.clocks').'</p></div>';
    } elseif ($id === 'DET-CONS-2026') {
        $html .= '<p>'.det_e('cons.p1').'</p><p>'.det_e('cons.p2').' <a href="'.det_h(det_url('contact')).'">'.det_e('nav.contact').'</a>.</p>';
    } elseif ($id === 'DET-AR-2026') {
        $html .= '<p>'.det_e('ar.p1').'</p><p>'.det_e('ar.p2').'</p><p>'.det_e('ar.p3').'</p>';
    } elseif ($id === 'DET-HIS-1951' || $id === 'DET-HIST-1951') {
        $html .= '<p>'.det_e('his51.p1').'</p><p>'.det_e('his51.p2').'</p><p><a href="'.det_h(det_url('publications/det-codex-001')).'">DET-CODEX-001</a></p>';
    } elseif ($id === 'DET-HIS-2008') {
        $html .= '<p>'.det_e('his08.p1').'</p><p>'.det_e('his08.p2').' <span class="ttg13" data-ttg13>TTG-13</span></p>';
    } else {
        $html .= '<p>'.det_e('pub.body.fallback').'</p>';
    }
    if (!empty($pub['revisions'])) {
        $html .= '<h2>'.det_e('pub.rev').'</h2><table class="list"><thead><tr><th>'.det_e('pub.ver').'</th><th>'.det_e('pub.date').'</th><th>'.det_e('pub.note').'</th></tr></thead><tbody>';
        foreach ($pub['revisions'] as $r) {
            $html .= '<tr><td>'.det_h((string) ($r['ver'] ?? '')).'</td><td>'.det_h(det_fmt_date((string) ($r['date'] ?? ''))).'</td><td>'.det_h(det_rev_note($pub, $r)).'</td></tr>';
        }
        $html .= '</tbody></table>';
    }
    $html .= '<p class="muted">'.det_e('pub.retain').'</p>';
    return $html;
}

function det_page_home(): array {
    $news = '';
    foreach (det_json('news') as $n) {
        $href = det_h(det_abs_href((string) ($n['href'] ?? '#')));
        $news .= '<li><a href="'.$href.'">'.det_h((string) det_l($n, 'title')).'</a><time datetime="'.det_h($n['date']).'">'.det_h(det_fmt_date($n['date'])).'</time></li>';
    }
    $html = '<div class="identity wrap">'
        .'<h1>'.det_e('dept').'</h1>'
        .'<p class="wg">'.det_e('wg').'</p>'
        .'<p class="meta">'.det_e('est').'</p>'
        .'<p class="meta">'.det_e('serving').'</p>'
        .'<div class="actions">'
        .'<a class="action" href="'.det_h(det_url('services/report')).'">'.det_e('btn.incident').'</a>'
        .'<a class="action" href="'.det_h(det_url('careers')).'">'.det_e('btn.careers').'</a>'
        .'<a class="action" href="'.det_h(det_url('publications')).'">'.det_e('btn.publications').'</a>'
        .'<a class="action" href="'.det_h(det_url('research')).'">'.det_e('btn.research').'</a>'
        .'<a class="action" href="'.det_h(det_url('services/guidance')).'">'.det_e('btn.guidance').'</a>'
        .'<a class="action" href="'.det_h(det_url('about')).'">'.det_e('btn.about').'</a>'
        .'</div></div>'
        .'<div class="hero wrap"><blockquote>'.det_e('home.hero').'</blockquote>'
        .'<p><a class="codex-link" href="'.det_h(det_url('publications/det-codex-001')).'">'.det_e('home.codex').'</a></p></div>'
        .'<div class="news"><div class="wrap"><h2>'.det_e('home.latest').'</h2><ul>'.$news.'</ul></div></div>';
    return [
        'title' => det_s('dept'),
        'desc' => det_s('wg').'. '.det_s('est').'. '.det_s('serving'),
        'crumbs' => [],
        'bodyClass' => 'home',
        'mainClass' => 'home-main',
        'html' => $html,
    ];
}

function det_page_about(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('wg').'</p><h1>'.det_e('about.h1').'</h1>
<p class="lede">'.det_e('about.lede').'</p>
<div class="inset"><p>'.det_e('axiom').'</p></div>
<div class="topics">
<a class="topic" href="'.det_h(det_url('about/history')).'"><h3>'.det_e('nav.history').'</h3><p>'.det_e('about.history.d').'</p></a>
<a class="topic" href="'.det_h(det_url('about/organisation')).'"><h3>'.det_e('nav.org').'</h3><p>'.det_e('about.org.d').'</p></a>
<a class="topic" href="'.det_h(det_url('about/minister')).'"><h3>'.det_e('nav.minister').'</h3><p>'.det_e('about.min.d').'</p></a>
<a class="topic" href="'.det_h(det_url('about/offices')).'"><h3>'.det_e('nav.offices').'</h3><p>'.det_e('about.off.d').'</p></a>
<a class="topic" href="'.det_h(det_url('about/annual-reports')).'"><h3>'.det_e('nav.reports').'</h3><p>'.det_e('about.ar.d').'</p></a>
<a class="topic" href="'.det_h(det_url('about/foi')).'"><h3>'.det_e('nav.foi').'</h3><p>'.det_e('about.foi.d').'</p></a>
</div>
<p class="muted">'.det_e('about.codex').' <a href="'.det_h(det_url('publications/det-codex-001')).'">DET-CODEX-001</a>. <span class="ttg13" data-ttg13>TTG-13</span></p></div>';
    return ['title'=>det_s('nav.about').' — '.det_s('dept'),'desc'=>det_s('about.lede'),'crumbs'=>[['label'=>det_s('nav.about')]],'html'=>$html];
}

function det_page_history(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('hist.h1').'</h1>
<p class="lede">'.det_e('hist.p1').'</p>
<p>'.det_e('hist.p2').'</p>
<h2>1951</h2><p>'.det_e('hist.1951').'</p>
<h2>1963</h2><p>'.det_e('hist.1963').'</p>
<h2>2008</h2><p>'.det_e('hist.2008').'</p>
<h2>2025–26</h2><p>'.det_e('hist.2526').'</p>
<p><a class="start" href="'.det_h(det_url('publications/det-codex-001')).'">'.det_e('home.codex').'</a></p>
<p><a href="'.det_h(det_url('publications/det-hist-1951')).'">'.det_e('about.instrument').'</a></p>
<p class="muted"><span class="ttg13" data-ttg13>TTG-13</span></p></div>';
    return ['title'=>det_s('hist.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.history')]],'html'=>$html];
}

function det_page_organisation(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('org.h1').'</h1>
<p class="lede">'.det_e('org.lede').'</p>
<h2>'.det_e('org.ps').'</h2><p>'.det_e('org.ps.d').'</p>
<h2>'.det_e('org.ops').'</h2><p>'.det_e('org.ops.d').'</p>
<h2>'.det_e('org.its').'</h2><p>'.det_e('org.its.d').'</p>
<h2>'.det_e('org.info').'</h2><p>'.det_e('org.info.d').'</p>
<h2>'.det_e('org.est').'</h2><p>'.det_e('org.est.d').'</p>
<p>'.det_e('org.staff').'</p></div>';
    return ['title'=>det_s('org.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.org')]],'html'=>$html];
}

function det_page_minister(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('min.h1').'</h1>
<p class="lede">'.det_e('min.p1').'</p>
<p>'.det_e('min.p2').'</p>
<h2>'.det_e('min.resp').'</h2>
<ul class="plain"><li>'.det_e('min.r1').'</li><li>'.det_e('min.r2').'</li><li>'.det_e('min.r3').'</li><li>'.det_e('min.r4').'</li><li>'.det_e('min.r5').'</li></ul>
<p><a href="'.det_h(det_url('publications/det-min-2026-03')).'">'.det_e('min.stmt').'</a></p></div>';
    return ['title'=>det_s('min.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.minister')]],'html'=>$html];
}

function det_page_offices(): array {
    $offices = det_json('offices');
    $marks = '';
    foreach ($offices as $o) {
        $name = (string) det_l($o, 'name');
        $st = det_h($o['status']);
        $marks .= '<g class="office '.$st.'" data-name="'.det_h($name).'" data-role="'.det_h((string) det_l($o, 'role')).'" data-note="'.det_h((string) det_l($o, 'note')).'">';
        $marks .= '<circle cx="'.$o['x'].'" cy="'.$o['y'].'" r="7"/>';
        $marks .= '<text x="'.($o['x']+12).'" y="'.($o['y']+4).'">'.det_h($name).'</text></g>';
    }
    $rows = '';
    foreach ($offices as $o) {
        $tag = $o['status']==='open'?'tag-open':($o['status']==='limited'?'tag-limited':'tag-closed');
        $rows .= '<tr><td><strong>'.det_h((string) det_l($o, 'name')).'</strong><br><span class="muted">'.det_h((string) det_l($o, 'address')).'</span></td><td><span class="tag '.$tag.'">'.det_h(det_status_label($o['status'])).'</span><br>'.det_h((string) det_l($o, 'role')).'</td></tr>';
    }
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('off.h1').'</h1>
<p class="lede">'.det_e('off.lede').'</p>
<div class="map-wrap">
<svg id="ukmap" viewBox="0 0 420 560" role="img" aria-label="'.det_e('map.label').'">
  <path class="land" d="M230 18c28 8 52 32 58 70 6 34-8 58 2 92 8 28 28 42 22 78-6 32-32 48-28 82 4 28 18 40 8 68-12 32-42 48-62 78-16 24-18 48-40 58-24 10-50 0-62-18-10-16-4-40 8-58 16-24 12-46 6-72-6-22-20-32-16-58 4-28 24-42 28-72 4-26-8-48 4-78C142 86 172 48 230 18z"/>
  <path class="land" d="M108 168c24-10 44 6 52 28 8 22-4 42-18 52-18 14-40 8-52-8-14-16-8-40 8-58 4-6 6-12 10-14z"/>
  <path class="land" d="M188 338c16 6 24 20 20 34-6 18-24 24-38 14-14-8-16-26-6-38 8-8 14-12 24-10z"/>
  '.$marks.'
</svg>
<div class="map-key"><span><i class="o"></i> '.det_e('open').'</span><span><i class="l"></i> '.det_e('limited').'</span><span><i class="c"></i> '.det_e('closed').'</span></div>
<div id="office-panel"><p class="muted">'.det_e('select.office').'</p></div>
</div>
<table class="list"><thead><tr><th>'.det_e('off.office').'</th><th>'.det_e('off.status').'</th></tr></thead><tbody>'.$rows.'</tbody></table>
</div>';
    return ['title'=>det_s('off.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('off.h1')]],'html'=>$html];
}

function det_page_annual(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('ar.h1').'</h1><p>'.det_e('ar.lede').'</p><ul class="plain">';
    foreach (det_json('publications') as $p) {
        if (($p['type'] ?? '') !== 'Annual report' && !str_starts_with((string) ($p['id'] ?? ''), 'DET-AR')) continue;
        $html .= '<li><a href="'.det_h(det_url('publications/'.strtolower($p['id']))).'">'.det_h($p['id'].' — '.(string) det_l($p, 'title')).'</a></li>';
    }
    $html .= '</ul></div>';
    return ['title'=>det_s('ar.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.reports')]],'html'=>$html];
}

function det_page_foi(): array {
    $html = '<div class="svc"><p class="caption">'.det_e('nav.about').'</p><h1>'.det_e('foi.h1').'</h1>
<p class="lede">'.det_e('foi.p0').'</p>
<p>'.det_e('foi.p2').'</p>
<div class="inset"><p>'.det_e('foi.ncnd').'</p></div>
<p>'.det_e('foi.write').'</p>
<p>'.det_e('foi.p1').'</p>
<p><a href="'.det_h(det_url('publications')).'?q=DET-FOI">'.det_e('foi.log').'</a></p></div>';
    return ['title'=>det_s('foi.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.about'),'href'=>det_url('about')],['label'=>det_s('nav.foi')]],'html'=>$html];
}

function det_page_contact(): array {
    $city = ($GLOBALS['DET_LANG'] ?? 'en') === 'cy' ? 'Caerdydd' : 'Cardiff';
    $contactForm = det_form_wizard_html('CONTACT', [
        'done' => 'form.received',
        'keep' => 'form.recognised',
        'class' => '',
    ]);
    $html = '<div class="svc"><h1>'.det_e('contact.h1').'</h1>
<p class="lede">'.det_e('dept').'<br>Parc Cathays<br>'.$city.'<br>CF10 3NQ</p>
<p>'.det_e('contact.counter').'</p>
<p>'.det_e('contact.welsh').'</p>
<p>'.det_e('contact.enquiries').' <a href="mailto:enquiries@excess-time.gov.wales">enquiries@excess-time.gov.wales</a></p>
<p>'.det_e('contact.incidents').' <a href="'.det_h(det_url('services/report')).'">DET-01</a>.</p>
'.$contactForm.'
<h2>'.det_e('contact.field').'</h2>
<p>'.det_e('contact.abercrave').'</p>
<p class="muted">'.det_e('contact.press').' <span class="ttg13" data-ttg13>TTG-13</span></p></div>';
    return ['title'=>det_s('contact.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.contact')]],'html'=>$html];
}

function det_page_careers(?array $job): array {
    if ($job) {
        $duties = ''; foreach (det_la($job, 'duties') ?: ($job['duties'] ?? []) as $d) $duties .= '<li>'.det_h((string) $d).'</li>';
        $ess = ''; foreach (det_la($job, 'essential') ?: ($job['essential'] ?? []) as $d) $ess .= '<li>'.det_h((string) $d).'</li>';
        $des = ''; foreach (det_la($job, 'desirable') ?: ($job['desirable'] ?? []) as $d) $des .= '<li>'.det_h((string) $d).'</li>';
        $title = (string) det_l($job, 'title');
        $html = '<div class="svc"><p class="caption">'.det_e('car.cs').'</p><h1>'.det_h($title).'</h1>
<div class="vmeta">
<div><dt>'.det_e('pub.ref').'</dt><dd>'.det_h($job['id']).'</dd></div>
<div><dt>'.det_e('car.grade').'</dt><dd>'.det_h($job['grade']).'</dd></div>
<div><dt>'.det_e('car.salary').'</dt><dd>'.det_h($job['salary']).'</dd></div>
<div><dt>'.det_e('car.location').'</dt><dd>'.det_h((string) det_l($job, 'location')).'</dd></div>
<div><dt>'.det_e('car.contract').'</dt><dd>'.det_h((string) det_l($job, 'type')).'</dd></div>
<div><dt>'.det_e('car.hours').'</dt><dd>'.det_h((string) det_l($job, 'hours')).'</dd></div>
<div><dt>'.det_e('car.close.date').'</dt><dd>'.det_h(det_fmt_date($job['closing'])).'</dd></div>
</div>
<p class="lede">'.det_h((string) det_l($job, 'summary')).'</p>
<h2>'.det_e('car.jd').'</h2><ul class="plain">'.$duties.'</ul>
<h2>'.det_e('car.ess').'</h2><ul class="plain">'.$ess.'</ul>
'.($des ? '<h2>'.det_e('car.des').'</h2><ul class="plain">'.$des.'</ul>' : '').'
<p><a class="start" href="'.det_h(det_url('forms/DET-80')).'">'.det_e('car.apply').'</a></p>
<p class="muted">'.det_e('car.foot').'</p></div>';
        return ['title'=>$title.' — '.det_s('nav.careers'),'crumbs'=>[['label'=>det_s('nav.careers'),'href'=>det_url('careers')],['label'=>$title]],'html'=>$html];
    }
    $cards = '';
    foreach (det_json('vacancies') as $j) {
        $cards .= '<article class="card" data-job="'.det_h($j['grade']).'"><p class="meta">'.det_h($j['id']).' · '.det_e('car.grade').' '.det_h($j['grade']).'</p>';
        $cards .= '<h3><a href="'.det_h(det_url('careers/'.$j['slug'])).'">'.det_h((string) det_l($j, 'title')).'</a></h3>';
        $cards .= '<p class="meta">'.det_h($j['salary']).' · '.det_h((string) det_l($j, 'location')).' · '.det_e('car.closing').' '.det_h(det_fmt_date($j['closing'])).'</p>';
        $cards .= '<p>'.det_h((string) det_l($j, 'summary')).'</p></article>';
    }
    $html = '<div class="svc"><h1>'.det_e('car.h1').'</h1>
<p class="lede">'.det_e('car.cs.lede').'</p>
<p>'.det_e('car.public').'</p>
<div class="filters"><div class="field"><label for="job-grade">'.det_e('car.grade').'</label><select id="job-grade"><option value="">'.det_e('car.all').'</option><option>AO</option><option>EO</option><option>HEO</option><option>SEO</option><option>Grade 7</option></select></div></div>
<div class="cards">'.$cards.'</div></div>';
    return ['title'=>det_s('car.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.careers')]],'html'=>$html];
}

function det_page_publications(?array $pub, string $q = ''): array {
    if ($pub) {
        return ['title'=>$pub['id'].' — '.(string) det_l($pub, 'title'),'crumbs'=>[['label'=>det_s('nav.publications'),'href'=>det_url('publications')],['label'=>$pub['id']]],'html'=>'<div class="svc">'.det_doc_body($pub).'</div>'];
    }
    $q = strtolower($q);
    $rows = '';
    foreach (det_json('publications') as $p) {
        $hay = strtolower($p['id'].' '.$p['title'].' '.(string) det_l($p, 'title').' '.$p['summary'].' '.$p['type']);
        if ($q !== '' && !str_contains($hay, $q)) continue;
        $href = det_abs_href((string) ($p['href'] ?? det_url('publications/'.strtolower($p['id']))));
        $rows .= '<tr><td><a href="'.det_h($href).'">'.det_h($p['id']).'</a></td><td>'.det_h((string) det_l($p, 'title')).'<br><span class="muted">'.det_h((string) det_l($p, 'summary')).'</span></td><td>'.det_h(det_fmt_date($p['revised'])).'</td></tr>';
    }
    $html = '<div class="svc"><h1>'.det_e('pub.h1').'</h1>
<p class="lede">'.det_e('pub.lede').'</p>
<form class="filters" method="get" action="'.det_h(DET_WEB.'/publications/').'">
'.det_lang_hidden().'
<div class="field"><label for="q2">'.det_e('search').'</label><input id="q2" name="q" type="search" value="'.det_h($q).'"></div>
<button class="btn btn-sec" type="submit">'.det_e('search').'</button>
</form>
<table class="list"><thead><tr><th>'.det_e('pub.ref').'</th><th>'.det_e('pub.title').'</th><th>'.det_e('pub.updated').'</th></tr></thead><tbody>'.$rows.'</tbody></table>
<p class="muted">'.det_e('pub.print').' <span class="ttg13" data-ttg13>TTG-13</span></p></div>';
    return ['title'=>det_s('pub.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('nav.publications')]],'html'=>$html];
}

function det_page_research(string $sub = ''): array {
    $topics = [
        '' => ['res.h1', 'res.lede'],
        'institute' => ['org.its', 'res.reading'],
        'archive' => ['res.arc', 'res.arc.d'],
        'working-papers' => ['res.wp', 'res.wp.d'],
        'peer-review' => ['res.pr', 'res.pr.d'],
        'geometry' => ['res.geo', 'res.geo.d'],
        'historical' => ['res.hist', 'res.hist.d'],
        'field-reports' => ['res.field', 'res.field.d'],
    ];
    $keys = $topics[$sub] ?? $topics[''];
    $html = '<div class="svc"><p class="caption">'.det_e('res.h1').'</p><h1>'.det_e($keys[0]).'</h1><p class="lede">'.det_e($keys[1]).'</p><div class="topics">';
    foreach ($topics as $k => $v) {
        if ($k === '') continue;
        $html .= '<a class="topic" href="'.det_h(det_url('research/'.$k)).'"><h3>'.det_e($v[0]).'</h3><p>'.det_e($v[1]).'</p></a>';
    }
    $pubq = det_url('publications');
    $pubq .= (str_contains($pubq, '?') ? '&' : '?') . 'q=Research';
    $html .= '</div><p><a href="'.det_h($pubq).'">'.det_e('res.pubs').'</a> · <a href="'.det_h(det_url('services/research-access')).'">DET-78</a></p>
<p class="muted"><span class="ttg13" data-ttg13>TTG-13</span></p></div>';
    $crumbs = [['label'=>det_s('res.h1'), 'href'=>$sub ? det_url('research') : '']];
    if ($sub) { $crumbs[0]['href'] = det_url('research'); $crumbs[] = ['label'=>det_s($keys[0])]; }
    return ['title'=>det_s($keys[0]).' — '.det_s('dept'),'crumbs'=>$crumbs,'html'=>$html];
}

function det_page_services(string $which): array {
    $map = [
        'report' => ['rep.h1', 'DET-01', 'rep.lede'],
        'research-access' => ['svc.research', 'DET-78', 'acc.res.p1'],
        'community' => ['svc.community', 'DET-COM-012', 'com.p1'],
        'schools' => ['svc.schools', 'DET-SCH-004', 'sch.p1'],
        'welfare' => ['svc.welfare', 'DET-WEL-007', 'wel.maxim'],
        'guidance' => ['svc.guidance', 'Guidance', 'assurance'],
    ];
    if ($which === '') {
        $html = '<div class="svc"><h1>'.det_e('svc.list').'</h1><div class="topics">';
        foreach ($map as $k => $v) {
            $html .= '<a class="topic" href="'.det_h(det_url('services/'.$k)).'"><h3>'.det_e($v[0]).'</h3><p>'.det_h($v[1]).' — '.det_e($v[2]).'</p></a>';
        }
        $html .= '</div></div>';
        return ['title'=>det_s('svc.list').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('svc.list')]],'html'=>$html];
    }
    if ($which === 'guidance') {
        $html = '<div class="svc"><h1>'.det_e('svc.guidance').'</h1><p class="lede">'.det_e('assurance').'</p>
<ul class="plain">
<li><a href="'.det_h(det_url('publications/det-codex-001')).'">DET-CODEX-001 '.det_e('about.codex').'</a></li>
<li><a href="'.det_h(det_url('publications')).'?q=DET-WEL-007">'.det_e('svc.welfare').'</a></li>
<li><a href="'.det_h(det_url('publications')).'?q=DET-SCH">'.det_e('svc.schools').'</a></li>
<li><a href="'.det_h(det_url('forms')).'">'.det_e('form.h1').'</a></li>
</ul></div>';
        return ['title'=>det_s('svc.guidance').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('svc.guid.crumb')]],'html'=>$html];
    }
    if ($which === 'community' || $which === 'schools' || $which === 'welfare') {
        $v = $map[$which];
        $html = '<div class="svc"><p class="caption">'.det_h($v[1]).'</p><h1>'.det_e($v[0]).'</h1><p class="lede">'.det_e($v[2]).'</p>
<p>'.det_e('pub.see').' <a href="'.det_h(det_url('publications')).'?q='.urlencode($v[1]).'">'.det_e('pub.library').'</a>.</p>
<p><a class="start" href="'.det_h(det_url('forms')).'">'.det_e('form.h1').'</a></p></div>';
        return ['title'=>det_s($v[0]).' — '.det_s('dept'),'crumbs'=>[['label'=>det_s($v[0])]],'html'=>$html];
    }
    $formId = $which === 'research-access' ? 'DET-78' : 'DET-01';
    $form = det_form($formId) ?: ['id'=>$formId,'title'=>det_s($map[$which][0]),'summary'=>det_s($map[$which][2])];
    return det_form_page($form, true);
}

function det_form_page(array $form, bool $service = false): array {
    $id = (string) $form['id'];
    $title = det_h((string) det_l($form, 'title'));
    $sum = det_h((string) det_l($form, 'summary'));
    $lead = '<p class="caption">'.det_h($id).'</p>'
        .'<div class="form-lead"><h1>'.$title.'</h1><p class="lede">'.$sum.'</p>'
        .'<p>'.det_e('axiom').'</p></div>';
    $html = det_form_wizard_html($id, ['lead' => $lead]);
    $crumbs = $service
        ? [['label'=>det_s('svc.list'),'href'=>det_url('services')],['label'=>(string) det_l($form, 'title')]]
        : [['label'=>det_s('form.h1'),'href'=>det_url('forms')],['label'=>$form['id']]];
    return ['title'=>$form['id'].' '.(string) det_l($form, 'title'),'crumbs'=>$crumbs,'html'=>$html];
}

function det_page_forms(?array $form): array {
    if ($form) return det_form_page($form);
    $rows = '';
    foreach (det_json('forms') as $f) {
        $href = det_abs_href((string) ($f['href'] ?? det_url('forms/'.strtolower($f['id']))));
        $rows .= '<tr><td><a href="'.det_h($href).'">'.det_h($f['id']).'</a></td><td>'.det_h((string) det_l($f, 'title')).'<br><span class="muted">'.det_h((string) det_l($f, 'summary')).'</span></td></tr>';
    }
    $html = '<div class="svc"><h1>'.det_e('form.h1').'</h1><p class="lede">'.det_e('form.lede').'</p>
<table class="list"><thead><tr><th>'.det_e('form.number').'</th><th>'.det_e('pub.title').'</th></tr></thead><tbody>'.$rows.'</tbody></table></div>';
    return ['title'=>det_s('form.h1').' — '.det_s('dept'),'crumbs'=>[['label'=>det_s('form.h1')]],'html'=>$html];
}

function det_page_static(string $which): array {
    if ($which === 'cookies') {
        return ['title'=>det_s('cook.h1'),'crumbs'=>[['label'=>det_s('nav.cookies')]],'html'=>'<div class="svc"><h1>'.det_e('cook.h1').'</h1><p>'.det_e('cook.p').'</p><h2>'.det_e('cook.ess').'</h2><p>'.det_e('cook.ess.p').'</p><h2>'.det_e('cook.lang').'</h2><p>'.det_e('cook.lang.p').'</p></div>'];
    }
    if ($which === 'privacy') {
        return ['title'=>det_s('priv.h1'),'crumbs'=>[['label'=>det_s('nav.privacy')]],'html'=>'<div class="svc"><h1>'.det_e('priv.h1').'</h1><p>'.det_e('priv.p1').'</p><p>'.det_e('priv.p2').'</p></div>'];
    }
    return ['title'=>det_s('acc.h1'),'crumbs'=>[['label'=>det_s('nav.access')]],'html'=>'<div class="svc"><h1>'.det_e('acc.h1').'</h1><p>'.det_e('acc.p1').'</p><p>'.det_e('acc.p2').'</p><p>'.det_e('acc.p3').'</p></div>'];
}

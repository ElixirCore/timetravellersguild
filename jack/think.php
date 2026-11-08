<?php
declare(strict_types=1);

/**
 * /jack/think.php — asks Jack what he is thinking. A press forms one new thought from everything publicly
 * known and keeps it. A press while he is already thinking joins that thought. A visitor's press is a passing
 * thought from a small daily allowance; only a keeper's can change what he holds. The account comes from the
 * server's people session, never from the request.
 */
require_once dirname(__DIR__) . '/app/AI/JackThought.php';
JackThought::loadMind();
require_once dirname(__DIR__) . '/app/AI/JackPolicy.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function think_out(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') think_out(405, ['ok' => false, 'error' => 'post_only']);
if (!ttg_graph_csrf_ok((string) ($_POST['csrf'] ?? ''))) think_out(403, ['ok' => false, 'error' => 'unsigned_slip']);
$keeper = JackPolicy::isKeeper(ttg_graph_viewer());
session_write_close(); // a long think must not hold up anything else this visitor does
if (!ttg_openai_configured()) think_out(200, ['ok' => true, 'fresh' => false, 'away' => true, 'latest' => JackThought::recent(1)[0] ?? null]);

@set_time_limit(400);
ignore_user_abort(true); // if they leave, the thought is still formed and kept
$r = JackThought::think('pressed', $keeper);
$r['latest'] = JackThought::recent(1)[0] ?? null;
$r['held'] = JackThought::heldPublic();
think_out(200, $r);

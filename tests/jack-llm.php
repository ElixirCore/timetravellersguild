<?php
declare(strict_types=1);

/**
 * /jack/llm: the voice agent speaks to Jack's one brain. No network. No secrets.
 */
$tmp = sys_get_temp_dir() . '/ttg-sittings-' . bin2hex(random_bytes(4));
putenv('JACK_SITTING_ROOT=' . $tmp);
putenv('JACK_SITTING_SECRET=' . str_repeat('k', 40));

require_once dirname(__DIR__) . '/app/AI/JackBrain.php';
JackBrain::boot();
require_once dirname(__DIR__) . '/app/AI/JackSitting.php';
require_once dirname(__DIR__) . '/app/AI/JackLlm.php';

$fail = 0;
$pass = 0;
function expect(bool $ok, string $name): void {
    global $fail, $pass;
    if ($ok) { $pass++; echo "PASS $name\n"; }
    else { $fail++; echo "FAIL $name\n"; }
}

final class FakeVoice implements AgentModelAdapter
{
    /** @var list<AgentRequest> */
    public array $seen = [];
    /** @var list<AgentTurnResult> */
    public array $script = [];

    public function run(AgentRequest $request): AgentTurnResult
    {
        $this->seen[] = $request;
        $next = array_shift($this->script);
        if ($next instanceof AgentTurnResult) return $next;
        $r = new AgentTurnResult();
        $r->ok = true;
        $r->text = 'What has entered the field?';
        return $r;
    }
}

// Reading the call.
$body = [
    'model' => 'x',
    'stream' => true,
    'messages' => [
        ['role' => 'system', 'content' => 'Dashboard prompt that must not steer Jack.'],
        ['role' => 'assistant', 'content' => 'Jack here.'],
        ['role' => 'user', 'content' => 'I found a ticket.'],
        ['role' => 'assistant', 'content' => 'From where?'],
        ['role' => 'user', 'content' => [['type' => 'text', 'text' => 'Show me the Cardiff section.']]],
        ['role' => 'assistant', 'content' => '', 'tool_calls' => [['id' => 'call_1', 'type' => 'function', 'function' => ['name' => 'scroll_to_section', 'arguments' => '{"query":"Cardiff"}']]]],
        ['role' => 'tool', 'tool_call_id' => 'call_1', 'content' => 'Scrolled to Cardiff.'],
    ],
    'tools' => [
        ['type' => 'function', 'function' => ['name' => 'scroll_to_section', 'description' => 'Scroll', 'parameters' => ['type' => 'object', 'properties' => ['query' => ['type' => 'string']]]]],
        ['type' => 'function', 'function' => ['name' => 'lodge_to_tree', 'description' => 'Relay', 'parameters' => ['type' => 'object']]],
        ['type' => 'function', 'function' => ['name' => 'end_call', 'description' => 'End the call']],
    ],
    'elevenlabs_extra_body' => ['sitting' => 'abc', 'page_title' => 'JACK'],
];
$chat = JackLlm::read($body);
expect($chat['message'] === 'Show me the Cardiff section.', 'the last thing the visitor said is the slip');
expect(str_contains($chat['thread'], 'VISITOR: I found a ticket.') && str_contains($chat['thread'], 'JACK: From where?'), 'earlier talk is the thread');
expect(!str_contains($chat['thread'] . $chat['suffix'] . $chat['message'], 'Dashboard prompt'), 'the dashboard prompt is ignored');
expect(str_contains($chat['suffix'], 'scroll_to_section → Scrolled to Cardiff.'), 'page tool results come back as evidence');
$names = array_map(fn ($t) => $t['name'], $chat['tools']);
expect($names === ['scroll_to_section', 'end_call'], 'page and system tools pass; the ffilm relay does not');
expect(($chat['tools'][1]['parameters']['type'] ?? '') === 'object', 'a tool with no parameters gets an empty object');
expect($chat['extra']['sitting'] === 'abc' && $chat['stream'] === true, 'extra body and streaming are read');
expect(JackLlm::read(['messages' => []])['message'] !== '', 'a silent opening still makes a slip');

// Chunks.
$c = JackLlm::chunk('id1', ['content' => 'Hello.']);
$d = json_decode(substr(trim($c), 6), true);
expect(str_starts_with($c, 'data: ') && str_ends_with($c, "\n\n") && $d['object'] === 'chat.completion.chunk' && $d['choices'][0]['delta']['content'] === 'Hello.', 'a speech chunk is Chat Completions SSE');
$tc = JackLlm::toolCalls([['id' => 'c9', 'name' => 'scroll_to_section', 'arguments' => ['query' => 'Cardiff']]]);
expect($tc[0]['type'] === 'function' && $tc[0]['function']['arguments'] === '{"query":"Cardiff"}' && $tc[0]['index'] === 0, 'tool calls go back with JSON-string arguments');

// Sittings.
$viewer = ['known' => true, 'name' => 'A Visitor', 'first' => 'A', 'slug' => 'a-visitor', 'email' => 'visitor@example.com'];
$token = JackSitting::mint($viewer, 'user:a-visitor', 'intro');
expect((bool) preg_match('/^[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/', $token), 'a sitting token is an id and a signature');
expect(!str_contains($token, 'visitor') && !str_contains(base64_decode(strtr(explode('.', $token)[1], '-_', '+/')), 'visitor'), 'the token carries nobody');
$one = JackSitting::take($token);
$two = JackSitting::take($token);
expect($one !== null && $one['subject'] === 'user:a-visitor' && $one['viewer']['slug'] === 'a-visitor' && $one['site'] === 'intro', 'the server knows who sat');
expect($one['turn'] === 1 && $two['turn'] === 2, 'turns are counted');
[$id, $sig] = explode('.', $token);
expect(JackSitting::take($id . '.' . strrev($sig)) === null, 'a forged signature is refused');
expect(JackSitting::take('nonsense') === null && JackSitting::take('') === null, 'rubbish is refused');
$file = $tmp . '/' . $id . '.json';
$row = json_decode((string) file_get_contents($file), true);
$row['exp'] = time() - 1;
file_put_contents($file, json_encode($row));
expect(JackSitting::take($token) === null, 'an expired sitting is refused');
$ht = (string) file_get_contents(dirname(__DIR__) . '/.htaccess');
expect(str_contains($ht, '^storage/ - [F,L]') && JackSitting::dir() === $tmp, 'sittings live in storage, which is not served');

// The voice channel.
$blank = JackRelationship::blank('user:a-visitor');
$fake = new FakeVoice();
JackBrain::useAdapter($fake);
$heard = '';
$t = JackBrain::turn($chat['message'], [
    'channel' => 'voice', 'site' => 'intro', 'thread' => $chat['thread'], 'suffix' => $chat['suffix'],
    'page' => 'Title: JACK', 'viewer' => $viewer, 'relationship' => $blank, 'persist' => false,
    'passthrough' => $chat['tools'],
    'onDelta' => function (string $d) use (&$heard): void { $heard .= $d; },
]);
$req = $fake->seen[0];
expect($t['ok'] && $heard === 'What has entered the field?', 'speech reaches the line as it is written');
expect(str_contains($req->instructions, 'You are on a call.') && str_starts_with($req->instructions, JackCharacter::stable()), 'voice is the same Jack with a voice addendum');
expect(str_contains($req->contextText, 'PAGE IN VIEW') && str_contains($req->contextText, 'RUNTIME POSITION'), 'voice knows the page and the runtime');
$vnames = array_map(fn ($x) => $x['name'], $req->tools);
expect(in_array('search_graph', $vnames, true) && in_array('scroll_to_section', $vnames, true) && in_array('note_sitting', $vnames, true), 'voice has lookups, record tools and page tools');
expect(!in_array('write_note', $vnames, true) && !in_array('lodge_to_tree', $vnames, true), 'no office and no relay by voice');

// Handing a page tool back.
$fake = new FakeVoice();
$call = new AgentTurnResult();
$call->ok = true;
$call->text = 'Opening it.';
$call->toolCalls = [
    ['id' => 'call_s', 'name' => 'scroll_to_section', 'arguments' => ['query' => 'Cardiff']],
    ['id' => 'call_n', 'name' => 'note_sitting', 'arguments' => ['lastConsequence' => 'Showed Cardiff.']],
];
$fake->script = [$call];
JackBrain::useAdapter($fake);
$t = JackBrain::turn('Show me Cardiff', ['channel' => 'voice', 'viewer' => $viewer, 'relationship' => $blank, 'persist' => false, 'passthrough' => $chat['tools']]);
expect(count($fake->seen) === 1 && count($t['handoff']) === 1 && $t['handoff'][0]['name'] === 'scroll_to_section', 'a page tool ends the turn and goes back to the caller');
expect(($t['relationship']['lastConsequence'] ?? '') === 'Showed Cardiff.', 'notes beside a hand-off are still kept');
$own = JackBrain::turn('x', ['channel' => 'voice', 'viewer' => $viewer, 'relationship' => $blank, 'persist' => false, 'passthrough' => [['type' => 'function', 'name' => 'search_graph', 'parameters' => ['type' => 'object']]]]);
expect(count(array_filter(array_map(fn ($x) => $x['name'], end($fake->seen)->tools), fn ($n) => $n === 'search_graph')) === 1, 'a page cannot shadow Jack’s own tools');
JackBrain::useAdapter(null);

// The endpoint refuses strangers.
$src = (string) file_get_contents(dirname(__DIR__) . '/jack/llm.php');
expect(str_contains($src, "hash_equals(\$secret") && str_contains($src, "JACK_LLM_SECRET") && str_contains($src, 'JackBrain::turn('), 'the line is signed and thinks through JackBrain');
$router = (string) file_get_contents(dirname(__DIR__) . '/router.php');
expect(str_contains($router, '/jack/llm') && str_contains($ht, 'jack/llm') && str_contains($ht, 'HTTP_AUTHORIZATION'), 'the line is routed and keeps its bearer');
$intro = (string) file_get_contents(dirname(__DIR__) . '/intro.php');
$chatPage = (string) file_get_contents(dirname(__DIR__) . '/chat/index.php');
expect(str_contains($intro, 'customLlmExtraBody') && str_contains($chatPage, 'customLlmExtraBody'), 'both voice doors hand the sitting to the agent');
expect(str_contains($intro, "'agent' => ttg_voice_agent_id()") && str_contains($chatPage, "'agent' => ttg_voice_agent_id()") && str_contains($intro, 'TTG_VOICE.agent'), 'both voice doors take their agent from the host');
putenv('JACK_VOICE_AGENT_ID');
expect(ttg_voice_agent_id() === 'agent_8101m54eqp47ez6baj4ed5kv7tkv', 'unset, the doors keep the shared agent');
putenv('JACK_VOICE_AGENT_ID=agent_ttgcopy1234');
expect(ttg_voice_agent_id() === 'agent_ttgcopy1234', 'set, the doors use the Guild’s copy');
putenv('JACK_VOICE_AGENT_ID=agent_x"><script>');
expect(ttg_voice_agent_id() === 'agent_8101m54eqp47ez6baj4ed5kv7tkv', 'a malformed agent id is ignored');
putenv('JACK_VOICE_AGENT_ID');
$tools = (string) file_get_contents(dirname(__DIR__) . '/assets/jack-guild-tools.js');
expect(str_contains($tools, "'/jack/sitting'") && str_contains($tools, "body.set('csrf'"), 'the sitting is asked for with the page slip');

foreach (glob($tmp . '/*') ?: [] as $f) @unlink($f);
foreach (glob($tmp . '/.key') ?: [] as $f) @unlink($f);
@rmdir($tmp);

echo $fail === 0 ? "OK $pass\n" : "FAILED $fail / " . ($pass + $fail) . "\n";
exit($fail === 0 ? 0 : 1);

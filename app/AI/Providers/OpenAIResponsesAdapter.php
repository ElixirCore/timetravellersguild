<?php
declare(strict_types=1);

/**
 * OpenAI Responses API adapter.
 * The API key is read only from server environment / private .env.
 * It is never written into prompts, HTML, JS, logs, or the graph.
 */
final class OpenAIResponsesAdapter implements AgentModelAdapter
{
    public function run(AgentRequest $request): AgentTurnResult
    {
        $out = new AgentTurnResult();
        $out->provider = 'openai';
        $out->model = $request->model !== '' ? $request->model : ttg_openai_model();

        $apiKey = ttg_env('OPENAI_API_KEY');
        if ($apiKey === '' || str_contains($apiKey, 'YOUR_KEY')) {
            $out->error = 'unavailable';
            return $out;
        }

        $input = [];
        $bundle = trim($request->instructions . "\n\n" . $request->contextText);
        if ($bundle !== '') {
            $input[] = [
                'role' => 'developer',
                'content' => [['type' => 'input_text', 'text' => $bundle]],
            ];
        }
        $input[] = [
            'role' => 'user',
            'content' => [['type' => 'input_text', 'text' => $request->userMessage]],
        ];

        $payload = [
            'model' => $out->model,
            'input' => $input,
        ];
        if ($request->tools !== []) {
            $payload['tools'] = $request->tools;
            $payload['tool_choice'] = 'auto';
        }

        $raw = $this->post($apiKey, $payload, $request->timeoutSeconds);
        if ($raw['ok'] !== true) {
            $out->error = $raw['error'] ?? 'unavailable';
            return $out;
        }

        $data = $raw['data'];
        $out->ok = true;
        $out->providerResponseId = isset($data['id']) && is_string($data['id']) ? $data['id'] : null;
        $out->text = $this->outputText($data);
        $out->toolCalls = $this->toolCalls($data);
        return $out;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{ok:bool,data?:array,error?:string}
     */
    private function post(string $apiKey, array $payload, int $timeout): array
    {
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($body === false) {
            return ['ok' => false, 'error' => 'unavailable'];
        }

        $ch = curl_init('https://api.openai.com/v1/responses');
        if ($ch === false) {
            return ['ok' => false, 'error' => 'unavailable'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ],
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => max(5, $timeout),
            CURLOPT_CONNECTTIMEOUT => 8,
        ]);

        $response = curl_exec($ch);
        $errno = curl_errno($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($response) || $response === '') {
            return ['ok' => false, 'error' => 'unavailable'];
        }

        $data = json_decode($response, true);
        if (!is_array($data) || $status >= 400) {
            return ['ok' => false, 'error' => 'unavailable'];
        }

        return ['ok' => true, 'data' => $data];
    }

    /** @param array<string, mixed> $data */
    private function outputText(array $data): string
    {
        if (isset($data['output_text']) && is_string($data['output_text']) && $data['output_text'] !== '') {
            return $data['output_text'];
        }
        $bits = [];
        $output = $data['output'] ?? [];
        if (!is_array($output)) return '';
        foreach ($output as $item) {
            if (!is_array($item)) continue;
            $content = $item['content'] ?? [];
            if (!is_array($content)) continue;
            foreach ($content as $part) {
                if (!is_array($part)) continue;
                if (($part['type'] ?? '') === 'output_text' && isset($part['text']) && is_string($part['text'])) {
                    $bits[] = $part['text'];
                }
            }
        }
        return trim(implode("\n", $bits));
    }

    /**
     * @param array<string, mixed> $data
     * @return list<array{id:string,name:string,arguments:array}>
     */
    private function toolCalls(array $data): array
    {
        $calls = [];
        $output = $data['output'] ?? [];
        if (!is_array($output)) return $calls;
        foreach ($output as $item) {
            if (!is_array($item)) continue;
            $type = (string) ($item['type'] ?? '');
            if ($type !== 'function_call' && $type !== 'tool_call') continue;
            $name = (string) ($item['name'] ?? '');
            if ($name === '') continue;
            $args = $item['arguments'] ?? [];
            if (is_string($args)) {
                $decoded = json_decode($args, true);
                $args = is_array($decoded) ? $decoded : [];
            }
            if (!is_array($args)) $args = [];
            $calls[] = [
                'id' => (string) ($item['call_id'] ?? $item['id'] ?? ''),
                'name' => $name,
                'arguments' => $args,
            ];
        }
        return $calls;
    }
}

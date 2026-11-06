<?php
declare(strict_types=1);

final class AgentRequest
{
    public string $agent = 'jack';
    public string $userMessage = '';
    public string $instructions = '';
    public string $contextText = '';
    /** @var list<array<string, mixed>> */
    public array $tools = [];
    public string $model = '';
    public string $requestId = '';
    public int $timeoutSeconds = 25;
    /** Continue a stored provider response (tool rounds) instead of restating the conversation. */
    public ?string $previousResponseId = null;
    /** @var list<array{call_id:string,output:string}> Results of the previous round's tool calls. */
    public array $toolOutputs = [];
    /** auto | none | required */
    public string $toolChoice = 'auto';
}

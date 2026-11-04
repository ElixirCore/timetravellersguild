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
}

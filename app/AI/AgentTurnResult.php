<?php
declare(strict_types=1);

final class AgentTurnResult
{
    public bool $ok = false;
    public string $text = '';
    /** @var list<array{id:string,name:string,arguments:array}> */
    public array $toolCalls = [];
    public string $provider = 'openai';
    public string $model = '';
    public ?string $providerResponseId = null;
    public ?string $error = null;
    /** Provider-run tools used this round, e.g. web_search. */
    public array $builtinCalls = [];
}

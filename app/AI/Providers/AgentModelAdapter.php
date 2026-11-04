<?php
declare(strict_types=1);

interface AgentModelAdapter
{
    public function run(AgentRequest $request): AgentTurnResult;
}

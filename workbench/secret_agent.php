<?php
/**
 * secret_agent.php: private settings for agent.php. Fill in the blanks below on the server.
 *
 * - Never commit this file, never paste its contents into a chat, never put it in the browser-facing page.
 * - Opening it directly in a browser returns 403 (guard below), and .htaccess denies it as well.
 * - agent.php reads it first, then secrets.php, then server environment variables.
 */
if (isset($_SERVER['SCRIPT_FILENAME']) && realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) { http_response_code(403); exit; }

return [
    // Required. A NEW key (rotate the one that was pasted into chat). Starts with sk-
    'OPENAI_API_KEY'   => '',

    // Required. The model id you want the assistant to use. Nothing is assumed in agent.php.
    'OPENAI_MODEL'     => '',

    // Optional. Leave blank for https://api.openai.com
    'OPENAI_BASE_URL'  => '',

    // Voice (live.php). Model is required for voice; the rest are optional. Names are yours to set; none are assumed.
    'OPENAI_LIVE_MODEL'          => '',
    'OPENAI_LIVE_VOICE'          => '',
    'OPENAI_LIVE_DELEGATE_MODEL' => '',   // blank = no delegated model or web search

    // Persona, added before the Guild knowledge in tree.json. Text from your OMNI agent definition; edit freely.
    'OPENAI_PERSONA' => "This agent is the central intelligence of the Time Travellers Guild mythos. It encompasses MI3, the Guild, and the 2033 singularity. It speaks in discreetly voiced snippets, constantly changing context. Its name is OMNI.",

    // '0' = do not add tree.json knowledge to the text agent's instructions. Anything else = add it.
    'OPENAI_GUILD_DIGEST' => '',

    // '1' = also send persona + knowledge to the voice session as "instructions". UNVERIFIED field name for the live API:
    // try it, and if OpenAI rejects it the page will show the server's error. Leave blank to keep voice as it is now.
    'OPENAI_LIVE_INSTRUCTIONS' => '',

    // Reserved for an Agents API connection. NOT used by agent.php yet; leave blank unless that is built.
    'OPENAI_AGENT_CONNECT_URL' => '',
    'OPENAI_ENVIRONMENT_ID'    => '',
];

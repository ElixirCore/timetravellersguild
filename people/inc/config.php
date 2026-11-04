<?php
declare(strict_types=1);

return [
    'app_name' => 'The Time Travellers Guild',
    'base_url' => 'https://timetravellersguild.com/people',
    'cookie_name' => 'ttg_people_session',
    'cookie_lifetime' => 60 * 60 * 24 * 30,
    'magic_link_lifetime' => 60 * 20,
    'handoff_lifetime' => 60 * 2,

    // Replace before production. Use at least 32 random bytes.
    'app_secret' => 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET_64_CHARS_MINIMUM',

    // Namecheap shared hosting commonly supports PHP mail().
    'mail_from' => 'guild@timetravellersguild.com',
    'mail_subject' => 'Your Time Travellers Guild sign-in link',
    'mail_enabled' => true,

    'db_path' => __DIR__ . '/../data/people.sqlite',

    // Signed handoff when mode is handoff and the receiver is installed (/integrations).
    // mode=link is a plain door (use when the house receiver is not live yet).
    'handoff_targets' => [
        'chronometer' => [
            'label' => 'Chronometer',
            'url' => 'https://chronometer.online/',
            'audience' => 'chronometer.online',
            'mode' => 'link',
        ],
        // Faetime receiver is not installed yet (faetime.space/auth/guild-handoff.php 404s).
        // Re-enable when that file is live on the Faetime host.
    ],
];

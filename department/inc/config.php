<?php
declare(strict_types=1);

/**
 * Department form mail. Uses PHP mail() the same way people/inc/mail.php does
 * on this Namecheap host. From stays on the guild mailbox; submissions land in Gmail.
 */
return [
    'mail_enabled' => true,
    'mail_from' => 'guild@timetravellersguild.com',
    'mail_to' => 'goddeninteractive@gmail.com',
    'mail_subject_prefix' => '[DET]',
];

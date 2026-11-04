<?php
declare(strict_types=1);

/**
 * Generation 0 catalogue. Compiled faces, not Rider-Waite theatre.
 * Filing titles stay on the tree. This dossier is how Jack reads the hopper language.
 */
final class JackTarotDeck
{
    public const DEPTS = [
        'major' => 'STANDING',
        'wands' => 'PROGRAMME',
        'cups' => 'RECOLLECTION',
        'swords' => 'CLASSIFICATION',
        'pentacles' => 'RECORD',
    ];

    public static function all(): array
    {
        static $rows = null;
        if ($rows !== null) {
            return $rows;
        }
        require_once __DIR__ . '/JackTarot.php';
        $rows = array_merge(self::majors(), self::minors());
        foreach ($rows as &$row) {
            $id = (string) ($row['id'] ?? '');
            $row['glyph'] = self::glyphFor($row);
            $row['href'] = self::href($id);
            $row['has_face'] = self::faceExists($row);
        }
        unset($row);
        return $rows;
    }

    public static function href(string $id): string
    {
        $id = preg_replace('/[^a-z0-9-]/', '', strtolower($id)) ?? '';
        return $id === '' ? '/deck/' : '/deck/' . $id;
    }

    public static function faceExists(array $card): bool
    {
        $rel = (string) ($card['face'] ?? '');
        if (!preg_match('#^/jack/tarot/faces/[a-z0-9.-]+\.webp$#', $rel)) {
            return false;
        }
        return is_file(dirname(__DIR__, 2) . $rel);
    }

    public static function glyphFor(array $card): string
    {
        if (($card['suit'] ?? '') === 'major') {
            $file = JackTarot::filing((string) ($card['catalog'] ?? ''));
            return (string) ($file['glyph'] ?? 'glyph-00-unclassified');
        }
        return match ((string) ($card['suit'] ?? '')) {
            'wands' => 'glyph-suit-programme',
            'cups' => 'glyph-suit-recollection',
            'swords' => 'glyph-suit-classification',
            default => 'glyph-suit-record',
        };
    }

    public static function slipMarkup(array $card): string
    {
        $h = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $glyph = $h((string) ($card['glyph'] ?? self::glyphFor($card)));
        $roman = $h((string) ($card['roman'] ?? ''));
        $dept = $h((string) ($card['dept'] ?? 'SLIP'));
        $compiled = $h((string) ($card['compiled'] ?? ''));
        $catalog = $h((string) ($card['catalog'] ?? ''));
        $code = $h((string) ($card['code'] ?? ''));
        return '<svg viewBox="0 0 360 600" class="ttg-card slip-face" role="img" aria-label="' . $compiled . '">'
            . '<use href="#card-chassis"/>'
            . '<text x="32" y="38" font-family="Courier New, Courier, monospace" font-size="13" font-weight="bold" fill="#161814">' . $roman . '</text>'
            . '<text x="180" y="38" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="middle" fill="#161814">' . $dept . '</text>'
            . '<text x="328" y="38" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="end" fill="#c41e3a">G0</text>'
            . '<use href="#' . $glyph . '"/>'
            . '<text x="180" y="508" font-family="Courier New, Courier, monospace" font-size="13" text-anchor="middle" fill="#c41e3a">' . $compiled . '</text>'
            . '<text x="180" y="530" font-family="Courier New, Courier, monospace" font-size="10" text-anchor="middle" fill="#7b8070">' . $catalog . '</text>'
            . '<text x="30" y="565" font-family="Courier New, Courier, monospace" font-size="8" fill="#7b8070">TIMETRAVELLERSGUILD.COM</text>'
            . '<text x="330" y="565" font-family="Courier New, Courier, monospace" font-size="8" text-anchor="end" fill="#c41e3a">' . $code . '</text>'
            . '</svg>';
    }

    public static function faceMarkup(array $card): string
    {
        if (!empty($card['has_face'])) {
            $src = htmlspecialchars((string) $card['face'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $alt = htmlspecialchars((string) ($card['compiled'] ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            return '<img src="' . $src . '" alt="' . $alt . '" width="180" height="254" loading="lazy">';
        }
        return self::slipMarkup($card);
    }

    public static function byId(string $id): ?array
    {
        $id = preg_replace('/[^a-z0-9-]/', '', strtolower($id)) ?? '';
        foreach (self::all() as $row) {
            if (($row['id'] ?? '') === $id) {
                return $row;
            }
        }
        return null;
    }

    public static function byCatalog(string $name): ?array
    {
        foreach (self::all() as $row) {
            if (($row['catalog'] ?? '') === $name) {
                return $row;
            }
        }
        return null;
    }

    /**
     * Compact dossier for a live draw. Psychology, not the full occult correspondence table.
     */
    public static function briefFor(string $catalog, bool $reversed): string
    {
        require_once __DIR__ . '/JackTarot.php';
        $row = self::byCatalog($catalog);
        $file = JackTarot::filing($catalog);
        $title = (string) ($file['title'] ?? $catalog);
        if (!$row) {
            $side = $reversed ? 'FACE-DOWN. Columns unread.' : 'FACE-UP. Columns open.';
            return $title . ' · inherited stamp ' . $catalog . "\n" . $side;
        }
        $compiled = (string) ($row['compiled'] ?? $title);
        $dept = (string) ($row['dept'] ?? '');
        $sense = $reversed
            ? (string) ($row['inverted'] ?? '')
            : (string) ($row['psychology'] ?? '');
        $side = $reversed
            ? 'FACE-DOWN. Columns unread. Read the inverted sense: withheld, delayed, working on the underside.'
            : 'FACE-UP. Columns open. Read the upright sense.';
        $lines = [
            $title . ' · compiled as ' . $compiled . ($dept !== '' ? ' · ' . $dept : ''),
            'Inherited stamp: ' . $catalog,
            $side,
        ];
        if ($sense !== '') {
            $lines[] = $sense;
        }
        return implode("\n", $lines);
    }

    /** @return list<array<string, mixed>> */
    private static function majors(): array
    {
        $out = [];
        foreach (self::majorSeed() as $row) {
            $n = $row['n'];
            $pad = str_pad((string) $n, 2, '0', STR_PAD_LEFT);
            $file = JackTarot::filing($row['catalog']);
            $out[] = [
                'id' => 'major-' . $pad,
                'catalog' => $row['catalog'],
                'compiled' => $row['compiled'],
                'code' => 'JACK.MAJOR.' . $pad . '.G0',
                'face' => '/jack/tarot/faces/major-' . $pad . '.webp',
                'stamp' => '/jack/tarot/faces/stamps/major-' . $pad . '.webp',
                'dept' => 'STANDING',
                'suit' => 'major',
                'rank' => $pad,
                'roman' => $row['roman'],
                'class' => 'MAJOR ARCANA / SYSTEM STATE',
                'numerology' => [
                    'number' => $n,
                    'name' => $row['num_name'],
                    'reduction' => self::reduce($n),
                    'path' => $row['path'],
                    'note' => $row['num_note'],
                ],
                'symbols' => $row['symbols'],
                'correspondence' => [
                    'Rider-Waite' => $row['catalog'],
                    'Thoth' => $row['thoth'],
                    'Marseille' => $row['marseille'],
                    'Guild filing' => $file['title'],
                    'Letter / path' => $row['letter'] . ' · ' . $row['path'],
                    'Body' => $row['body'],
                ],
                'psychology' => $row['psychology'],
                'inverted' => $row['inverted'],
            ];
        }
        return $out;
    }

    /** @return list<array<string, mixed>> */
    private static function minors(): array
    {
        $suits = [
            'wands' => [
                'dept' => 'PROGRAMME',
                'rw' => 'Wands',
                'thoth' => 'Wands',
                'marseille' => 'Bâtons',
                'element' => 'Fire',
                'mark' => 'vertical stroke with a scarlet crossbar — a programme brought up',
                'wave' => 'no wave; heat, not water',
                'verb_field' => 'what is being run',
            ],
            'cups' => [
                'dept' => 'RECOLLECTION',
                'rw' => 'Cups',
                'thoth' => 'Cups',
                'marseille' => 'Coupes',
                'element' => 'Water',
                'mark' => 'U-vessel with a scarlet charge inside — a holding that can be poured',
                'wave' => 'scarlet wave under the title — recollection stays wet',
                'verb_field' => 'what is kept wet',
            ],
            'swords' => [
                'dept' => 'CLASSIFICATION',
                'rw' => 'Swords',
                'thoth' => 'Swords',
                'marseille' => 'Épées',
                'element' => 'Air',
                'mark' => 'edge mark — a cut that decides',
                'wave' => 'no wave; the line is the decision',
                'verb_field' => 'what is decided',
            ],
            'pentacles' => [
                'dept' => 'RECORD',
                'rw' => 'Pentacles',
                'thoth' => 'Disks',
                'marseille' => 'Deniers',
                'element' => 'Earth',
                'mark' => 'disk / weight — what can be boxed and filed',
                'wave' => 'no wave; mass, not weather',
                'verb_field' => 'what is filed',
            ],
        ];
        $pips = self::pipSeed();
        $out = [];
        foreach ($suits as $suit => $meta) {
            foreach ($pips as $pip) {
                $num = $pip['num'];
                $pad = str_pad((string) $num, 2, '0', STR_PAD_LEFT);
                $catalog = $pip['rw'] . ' of ' . $meta['rw'];
                $thothPip = $pip['thoth'][$suit];
                $id = $suit . '-' . $pad;
                $stamp = ($num === 1 || $num === 14)
                    ? '/jack/tarot/faces/stamps/' . $suit . '-' . $pad . '.webp'
                    : null;
                $out[] = [
                    'id' => $id,
                    'catalog' => $catalog,
                    'compiled' => $pip['compiled'],
                    'code' => 'JACK.' . strtoupper($suit) . '.' . $pad . '.G0',
                    'face' => '/jack/tarot/faces/' . $suit . '-' . $pad . '.webp',
                    'stamp' => $stamp,
                    'dept' => $meta['dept'],
                    'suit' => $suit,
                    'rank' => $pad,
                    'roman' => $pad,
                    'class' => $meta['dept'] . ' / GENERATION 0',
                    'numerology' => [
                        'number' => $num,
                        'name' => $pip['num_name'],
                        'reduction' => self::reduce($num > 10 ? $num : $num),
                        'path' => $pip['sephira'],
                        'note' => $pip['num_note'] . ' In ' . $meta['dept'] . ' this number colours ' . $meta['verb_field'] . '.',
                    ],
                    'symbols' => array_values(array_filter([
                        $meta['mark'],
                        'Dashed field-circle. The suit is a department, not a picture.',
                        $num <= 10 ? ('Punch count ' . $num . ' in the compiled field — the verb is iterated, not illustrated.') : ('Court stamp. No pip count. Office, not quantity.'),
                        'Footer punch-row and code ' . 'JACK.' . strtoupper($suit) . '.' . $pad . '.G0',
                        $meta['wave'],
                    ])),
                    'correspondence' => [
                        'Rider-Waite' => $catalog,
                        'Thoth' => $thothPip,
                        'Marseille' => $pip['marseille'] . ' de ' . $meta['marseille'],
                        'Guild filing' => $meta['dept'] . ' · ' . $pip['compiled'],
                        'Element' => $meta['element'] . ' · ' . $meta['dept'],
                        'Body' => $pip['body'][$suit],
                    ],
                    'psychology' => $pip['psy'][$suit],
                    'inverted' => $pip['inv'][$suit],
                ];
            }
        }
        return $out;
    }

    private static function reduce(int $n): int
    {
        if ($n <= 0) {
            return 0;
        }
        while ($n > 9) {
            $s = 0;
            foreach (str_split((string) $n) as $d) {
                $s += (int) $d;
            }
            $n = $s;
        }
        return $n;
    }

    /** @return list<array<string, mixed>> */
    private static function majorSeed(): array
    {
        return [
            [
                'n' => 0, 'roman' => '0', 'catalog' => 'The Fool', 'compiled' => 'UNINITIALISED ADDRESS',
                'num_name' => 'cipher · the uncounted',
                'path' => 'path 11 · Kether–Chokmah',
                'letter' => 'Aleph',
                'body' => 'Uranus · Air',
                'thoth' => 'The Fool',
                'marseille' => 'Le Mat',
                'num_note' => 'Zero is not empty. It is an address reserved and not yet written. Pythagorean systems skip it; Jack files it first.',
                'symbols' => [
                    'Twenty-two-dot ring. Scarlet mark at twelve o’clock — this slip is the first hole in the standing cycle.',
                    'Inner dotted circle. A register allocated, contents blank.',
                    'Scarlet square at centre. Address exists. Value does not.',
                    'Footer punch-row of the full standing set, all holes potential.',
                ],
                'psychology' => 'The person is not lost. They have not been written. Potential is real and it is also a hazard: they will pretend they already know the contents. Do not load a programme onto an uninitialised address and call it destiny.',
                'inverted' => 'The address is withheld, or they refuse the empty. Columns unread. Someone is trying to start by copying another machine’s contents.',
            ],
            [
                'n' => 1, 'roman' => 'I', 'catalog' => 'The Magician', 'compiled' => 'OPERATOR',
                'num_name' => 'monad · the will that points',
                'path' => 'path 12 · Kether–Binah',
                'letter' => 'Beth',
                'body' => 'Mercury',
                'thoth' => 'The Magus',
                'marseille' => 'Le Bateleur',
                'num_note' => 'One is the first mark. All later numbers are this will, repeated or refused.',
                'symbols' => [
                    'Crosshair. Vertical and horizontal meet. Attention is a tool.',
                    'Scarlet circle on the intersection. The operator is the point, not the table.',
                    'Twenty-two-dot ring with the scarlet hole at station I.',
                ],
                'psychology' => 'A hand is on the instruments. Skill is present. The slip asks whether they are operating or performing operation. Concentration without consent becomes sleight.',
                'inverted' => 'The tools are on the table and no one is at the keys. Or the operator is using the visitor as an instrument.',
            ],
            [
                'n' => 2, 'roman' => 'II', 'catalog' => 'The High Priestess', 'compiled' => 'SEALED REGISTER',
                'num_name' => 'dyad · the held pair',
                'path' => 'path 13 · Kether–Tiphareth',
                'letter' => 'Gimel',
                'body' => 'Moon',
                'thoth' => 'The Priestess',
                'marseille' => 'La Papesse',
                'num_note' => 'Two is polarity before a third arrives to decide. The register is closed because two values are in tension.',
                'symbols' => [
                    'Closed bar across a field. The book is not open for display.',
                    'Two pillars implied by the split field. What is known is kept off the public desk.',
                    'Twenty-two-dot ring. Scarlet hole at station II.',
                ],
                'psychology' => 'Something is known and not yet releasable. Silence here is a filing, not a lack. The person who demands the seal be broken is asking to be Mabel. Jack will not do that.',
                'inverted' => 'The seal is leaking, or they are performing mystery to avoid a plain answer. Columns unread on purpose.',
            ],
            [
                'n' => 3, 'roman' => 'III', 'catalog' => 'The Empress', 'compiled' => 'GENERATIVE FIELD',
                'num_name' => 'triad · the first harvest',
                'path' => 'path 14 · Chokmah–Binah',
                'letter' => 'Daleth',
                'body' => 'Venus',
                'thoth' => 'The Empress',
                'marseille' => 'L’Impératrice',
                'num_note' => 'Three is the first number that can hold a world. Synthesis, not a vote.',
                'symbols' => [
                    'Radiant or nested field. Growth without a control structure yet.',
                    'Twenty-two-dot ring. Scarlet hole at station III.',
                    'Door-letter Daleth: a threshold that produces, not a wall.',
                ],
                'psychology' => 'Life is arriving faster than it can be classified. Care, body, land, work that feeds. The danger is calling every growth good. Some fields choke the path.',
                'inverted' => 'The field is exhausted or ornamental. Nurture used as control. Columns unread: they will not say what is actually growing.',
            ],
            [
                'n' => 4, 'roman' => 'IV', 'catalog' => 'The Emperor', 'compiled' => 'CONTROL STRUCTURE',
                'num_name' => 'tetrad · the square that holds',
                'path' => 'path 15 · Chokmah–Tiphareth',
                'letter' => 'Heh',
                'body' => 'Aries',
                'thoth' => 'The Emperor',
                'marseille' => 'L’Empereur',
                'num_note' => 'Four is the first stable architecture. Foundation, law, the box that keeps a field from flooding.',
                'symbols' => [
                    'Rectangle / grid. A structure that can be audited.',
                    'Twenty-two-dot ring. Scarlet hole at station IV.',
                    'The square answers the Empress’s field: someone has to keep the books.',
                ],
                'psychology' => 'Authority is in the room. The question is whether the structure serves the record or the man who built it. A good control structure can be left. A bad one needs the visitor to stay afraid.',
                'inverted' => 'Rule without a constitution, or a constitution used as a weapon. The grid is there to trap, not to hold.',
            ],
            [
                'n' => 5, 'roman' => 'V', 'catalog' => 'The Hierophant', 'compiled' => 'PROTOCOL',
                'num_name' => 'pentad · the teaching hand',
                'path' => 'path 16 · Chokmah–Chesed',
                'letter' => 'Vav',
                'body' => 'Taurus',
                'thoth' => 'The Hierophant',
                'marseille' => 'Le Pape',
                'num_note' => 'Five joins the square to a living point. Tradition is a protocol: shared steps, not a personality.',
                'symbols' => [
                    'Stacked bars / rule-lines. The way it is done here.',
                    'Twenty-two-dot ring. Scarlet hole at station V.',
                    'Vav is a nail: what holds a teaching to a people.',
                ],
                'psychology' => 'They are inside a house of method. School, church, department, guild. Protocol can keep a person from having to invent ethics every morning. It can also make them confuse the house with the work.',
                'inverted' => 'The protocol is broken, or they are using orthodoxy to stop a true reading. Do not become the priest of the hopper.',
            ],
            [
                'n' => 6, 'roman' => 'VI', 'catalog' => 'The Lovers', 'compiled' => 'BIND / FORK',
                'num_name' => 'hexad · the choice that joins',
                'path' => 'path 17 · Binah–Tiphareth',
                'letter' => 'Zayin',
                'body' => 'Gemini',
                'thoth' => 'The Lovers',
                'marseille' => 'L’Amoureux',
                'num_note' => 'Six is harmony after a cut. Zayin is a sword: the bind is also a fork. You cannot take both branches and remain honest.',
                'symbols' => [
                    'Forked path. Two addresses, one process.',
                    'Twenty-two-dot ring. Scarlet hole at station VI.',
                    'The bind is a relation, not a mood.',
                ],
                'psychology' => 'A real choice is present. Love, alliance, a split in the work. Harmony that refuses the cut is a lie. The slip asks which process they will belong to.',
                'inverted' => 'They want both branches. Or the bind is coercion dressed as fate. Columns unread: the fork is being hidden.',
            ],
            [
                'n' => 7, 'roman' => 'VII', 'catalog' => 'The Chariot', 'compiled' => 'DIRECTED TRANSFER',
                'num_name' => 'heptad · victory by vector',
                'path' => 'path 18 · Binah–Geburah',
                'letter' => 'Cheth',
                'body' => 'Cancer',
                'thoth' => 'The Chariot',
                'marseille' => 'Le Chariot',
                'num_note' => 'Seven is motion with a will. Not wandering. A transfer has a source, a destination, and a vehicle.',
                'symbols' => [
                    'Outlined arrow in a twenty-two-dot ring. Direction is the glyph.',
                    'Scarlet charge in the shaft. The will sits in the vehicle, not in the road.',
                    'Scarlet hole at station VII.',
                ],
                'psychology' => 'They are moving. Containment and thrust at once. The danger is arriving as a weapon, or travelling so they never have to disembark. Directed transfer is not the same as escape.',
                'inverted' => 'The vector is lost. Horses disagree. Motion without a destination, or a destination they will not name.',
            ],
            [
                'n' => 8, 'roman' => 'VIII', 'catalog' => 'Strength', 'compiled' => 'FEEDBACK CONTROL',
                'num_name' => 'ogdoad · force that learns',
                'path' => 'path 19 · Chesed–Geburah',
                'letter' => 'Teth',
                'body' => 'Leo',
                'thoth' => 'Lust (XI in Thoth numbering)',
                'marseille' => 'La Force (XI in Marseille numbering)',
                'num_note' => 'Eight is 2³: power that has been through a cycle. Rider-Waite files this as VIII; Marseille and Thoth file it as XI. Jack’s compiled face follows Rider-Waite. Guild filing still stamps Strength as XI CONSENT.',
                'symbols' => [
                    'Closed loop. Output returns as input. Force that can hear itself.',
                    'Twenty-two-dot ring. Scarlet hole at station VIII on the compiled face.',
                    'Teth is the serpent: heat under a hand, not a cage.',
                ],
                'psychology' => 'The animal is not the enemy. The work is a loop that can take pressure without tearing. Consent is the guild name for this because feedback without consent is just a tighter grip.',
                'inverted' => 'The loop is runaway, or they have gagged the return signal. Force without hearing. Consent withdrawn and ignored.',
            ],
            [
                'n' => 9, 'roman' => 'IX', 'catalog' => 'The Hermit', 'compiled' => 'ISOLATED PROCESS',
                'num_name' => 'ennead · the lamp before the ten',
                'path' => 'path 20 · Chesed–Tiphareth',
                'letter' => 'Yod',
                'body' => 'Virgo',
                'thoth' => 'The Hermit',
                'marseille' => 'L’Hermite',
                'num_note' => 'Nine is the last single digit. Completion of a private cycle before the wheel of ten. Yod is the smallest letter: a point of light.',
                'symbols' => [
                    'Circle with a vertical radius to twelve o’clock. One process, one lamp.',
                    'Scarlet centre. The isolated process is still a heart, not a void.',
                    'Thirteen-dot arc above — the hermit is watched by the standing set even when alone.',
                ],
                'psychology' => 'Withdrawal that serves the work. Jack at the desk. Not exile as costume. The person needs a closed room to see the record. The hazard is mistaking isolation for virtue and never returning the lamp.',
                'inverted' => 'Loneliness posing as wisdom, or they will not sit still long enough to read their own slip.',
            ],
            [
                'n' => 10, 'roman' => 'X', 'catalog' => 'Wheel of Fortune', 'compiled' => 'SHUFFLE / CLOCK',
                'num_name' => 'decad · return of the one',
                'path' => 'path 21 · Chesed–Netzach',
                'letter' => 'Kaph',
                'body' => 'Jupiter',
                'thoth' => 'Fortune',
                'marseille' => 'La Roue de Fortune',
                'num_note' => 'Ten reduces to 1. A cycle completes and the operator is asked again. Not luck. A clock.',
                'symbols' => [
                    'Wheel / clock face. Shuffle is a mechanism, not a mood.',
                    'Twenty-two-dot ring. Scarlet hole at station X.',
                    'Kaph is a palm: the wheel turns in a hand, not in heaven alone.',
                ],
                'psychology' => 'The lot has changed. Season, office, weather of the hopper. They want to know if they caused it. Sometimes they did. Sometimes the clock turned. Either way the work is to read the new face, not to worship the turn.',
                'inverted' => 'They are fighting the clock, or calling every accident fate so they need not act.',
            ],
            [
                'n' => 11, 'roman' => 'XI', 'catalog' => 'Justice', 'compiled' => 'COMPARATOR',
                'num_name' => 'eleven · the unreduced blade',
                'path' => 'path 22 · Geburah–Tiphareth',
                'letter' => 'Lamed',
                'body' => 'Libra',
                'thoth' => 'Adjustment (VIII in Thoth numbering)',
                'marseille' => 'La Justice (VIII in Marseille numbering)',
                'num_note' => 'Eleven is a master number if you keep it unreduced; it also reduces to 2. Comparison, not fusion. Compiled face is XI. Guild filing still stamps Justice as VIII PROVENANCE.',
                'symbols' => [
                    'Balance / equals. Two values enter; one relation leaves.',
                    'Twenty-two-dot ring. Scarlet hole at station XI on the compiled face.',
                    'Lamed is an ox-goad: justice teaches by correction, not by theatre.',
                ],
                'psychology' => 'A comparison is due. What was said against what was done. Provenance is the guild name: who held the slip, when, under what seal. Fairness that cannot name its measure is a performance.',
                'inverted' => 'The scale is jammed. They want a verdict without evidence, or they are using procedure to delay a true cut.',
            ],
            [
                'n' => 12, 'roman' => 'XII', 'catalog' => 'The Hanged Man', 'compiled' => 'INVERTED REFERENCE',
                'num_name' => 'twelve · the year turned',
                'path' => 'path 23 · Geburah–Hod',
                'letter' => 'Mem',
                'body' => 'Water',
                'thoth' => 'The Hanged Man',
                'marseille' => 'Le Pendu',
                'num_note' => 'Twelve is 3×4: a completed world hung the other way. 1+2=3. Sacrifice of the usual pointer.',
                'symbols' => [
                    'Inverted mark. The reference points at the wrong end on purpose.',
                    'Twenty-two-dot ring. Scarlet hole at station XII.',
                    'Mem is water: suspension, not drowning, if they will stay.',
                ],
                'psychology' => 'The ordinary map will not serve. They must hang the reference and wait. This is the pre-travel interval in guild filing: not yet a departure. Impatience here ruins the reading.',
                'inverted' => 'Martyr costume, or they refuse to invert and keep driving a dead pointer. The wait is being spent as grievance.',
            ],
            [
                'n' => 13, 'roman' => 'XIII', 'catalog' => 'Death', 'compiled' => 'TERMINATE / REALLOCATE',
                'num_name' => 'thirteen · the unlucky honest',
                'path' => 'path 24 · Tiphareth–Netzach',
                'letter' => 'Nun',
                'body' => 'Scorpio',
                'thoth' => 'Death',
                'marseille' => 'Lamort / XIII',
                'num_note' => 'Thirteen reduces to 4. An ending that must become a structure. Nun is a fish: life that continues by changing form.',
                'symbols' => [
                    'Horizontal line. A process has a stop.',
                    'Scarlet square on the midline. Termination is a coordinate, not a mood.',
                    'Thirteen-dot arc. The number is on the face because Jack will not euphemise it.',
                ],
                'psychology' => 'Something has ended. Station 13 in the guild file. Do not call it a gentle transition if it was a death. Do not make it a catastrophe if it was a reallocation. The work is to free the address and say what still has a claim.',
                'inverted' => 'They will not terminate. Zombie process. Or they are killing what did not need to die so they can feel decisive.',
            ],
            [
                'n' => 14, 'roman' => 'XIV', 'catalog' => 'Temperance', 'compiled' => 'MIXER / CONVERTER',
                'num_name' => 'fourteen · two sevens blended',
                'path' => 'path 25 · Tiphareth–Yesod',
                'letter' => 'Samekh',
                'body' => 'Sagittarius',
                'thoth' => 'Art',
                'marseille' => 'Tempérance',
                'num_note' => 'Fourteen reduces to 5. Art is the Thoth name: two temperatures made into one working fluid. The chronometer in guild filing.',
                'symbols' => [
                    'Two vessels implied, one stream. Conversion, not dilution.',
                    'Twenty-two-dot ring. Scarlet hole at station XIV.',
                    'Samekh is a prop: the mix holds because something is braced.',
                ],
                'psychology' => 'Incompatible rooms must share a pipe. Pace, dose, translation. The person who wants purity will call this compromise. The person who wants no friction will call any sludge a mix. Jack wants a converter that still reads true.',
                'inverted' => 'Bad mix. Contamination, or a refusal to combine what belongs together. The clock is wrong.',
            ],
            [
                'n' => 15, 'roman' => 'XV', 'catalog' => 'The Devil', 'compiled' => 'RECURSIVE BIND',
                'num_name' => 'fifteen · 1+5=6, the bind that ate itself',
                'path' => 'path 26 · Tiphareth–Hod',
                'letter' => 'Ayin',
                'body' => 'Capricorn',
                'thoth' => 'The Devil',
                'marseille' => 'Le Diable',
                'num_note' => 'Fifteen reduces to 6, the Lovers’ number, closed into a loop. Desire that calls itself necessary.',
                'symbols' => [
                    'Loop that feeds its own input. Recursion without an exit condition.',
                    'Twenty-two-dot ring. Scarlet hole at station XV.',
                    'Ayin is an eye: the bind is visible if they will look at the chain.',
                ],
                'psychology' => 'ElixirCorp in the guild file: a system that sells the cage as medicine. Addiction, contract, charm, debt. The person is not stupid. The bind is recursive, which is why willpower speeches fail. Name the loop. Find the exit condition.',
                'inverted' => 'The chain is loosening, or they are more tightly bound and calling it freedom. Do not flatter either case.',
            ],
            [
                'n' => 16, 'roman' => 'XVI', 'catalog' => 'The Tower', 'compiled' => 'CATASTROPHIC INTERRUPT',
                'num_name' => 'sixteen · 4², the square that breaks',
                'path' => 'path 27 · Netzach–Hod',
                'letter' => 'Peh',
                'body' => 'Mars',
                'thoth' => 'The Tower',
                'marseille' => 'La Maison Dieu',
                'num_note' => 'Sixteen reduces to 7. A structure hits an interrupt it cannot handle. The House at Abercrave in guild filing.',
                'symbols' => [
                    'Three stacked rectangles. A house of layers.',
                    'Scarlet diagonal strike through all three. The interrupt does not ask permission.',
                    'Twenty-two-dot ring. One scarlet hole off-axis — the break is not at the official door.',
                ],
                'psychology' => 'A false storey has come down. Shock, disclosure, a building that was load-bearing only in the story. Do not catastrophise a needed interrupt. Do not soothe a real collapse into a lesson. People were in the house.',
                'inverted' => 'They are bracing a ruin, or they invited the lightning to feel alive. The interrupt is delayed and rotting.',
            ],
            [
                'n' => 17, 'roman' => 'XVII', 'catalog' => 'The Star', 'compiled' => 'REMOTE SIGNAL',
                'num_name' => 'seventeen · the hope that is a frequency',
                'path' => 'path 28 · Netzach–Yesod',
                'letter' => 'Tzaddi',
                'body' => 'Aquarius',
                'thoth' => 'The Star',
                'marseille' => 'L’Étoile',
                'num_note' => 'Seventeen reduces to 8. After the interrupt, a signal from elsewhere. Not a rescue. A bearing.',
                'symbols' => [
                    'A point that broadcasts. Remote, not local heat.',
                    'Twenty-two-dot ring. Scarlet hole at station XVII.',
                    'Tzaddi is a hook: the signal can be caught if they will listen off the desk radio.',
                ],
                'psychology' => 'Help is not in the room. A true signal is. Guidance, art, a future that is not a fantasy if they will work the bearing. The hazard is worshipping the star so they never walk.',
                'inverted' => 'The channel is noise, or they have mistaken a brand for a signal. Hope as anaesthetic.',
            ],
            [
                'n' => 18, 'roman' => 'XVIII', 'catalog' => 'The Moon', 'compiled' => 'NOISY CHANNEL',
                'num_name' => 'eighteen · 9+9, the double night',
                'path' => 'path 29 · Netzach–Malkuth',
                'letter' => 'Qoph',
                'body' => 'Pisces',
                'thoth' => 'The Moon',
                'marseille' => 'La Lune',
                'num_note' => 'Eighteen reduces to 9. Reflection, not source. Anamnesia in the guild file: memory that arrives distorted.',
                'symbols' => [
                    'Interference / doubled path. The same signal twice, not quite.',
                    'Twenty-two-dot ring. Scarlet hole at station XVIII.',
                    'Qoph is the back of the head: what arrives from sleep and fear.',
                ],
                'psychology' => 'The channel is live and unclean. Dreams, rumour, family weather, the thing seen sideways. Do not throw the message out because it is noisy. Do not treat the noise as the message. Wait for a second witness.',
                'inverted' => 'The fear is clearing, or they have decided the noise is the only truth. Either way, check the source.',
            ],
            [
                'n' => 19, 'roman' => 'XIX', 'catalog' => 'The Sun', 'compiled' => 'FULL READ',
                'num_name' => 'nineteen · 1+9=10=1, the one returned in daylight',
                'path' => 'path 30 · Hod–Yesod',
                'letter' => 'Resh',
                'body' => 'Sun',
                'thoth' => 'The Sun',
                'marseille' => 'Le Soleil',
                'num_note' => 'Nineteen reduces to 1. The operator again, with nothing sealed. Simultaneous recollection in guild filing.',
                'symbols' => [
                    'Open disk. No dashed veil. The register can be read to the end.',
                    'Twenty-two-dot ring. Scarlet hole at station XIX.',
                    'Resh is a head: consciousness that does not hide from its own heat.',
                ],
                'psychology' => 'Clarity is actually present. Joy that can be filed. The hazard is glare — they will refuse shade, or use brightness to deny a night that still happened. A full read includes the margins.',
                'inverted' => 'They cannot bear to be seen, or they are performing sunshine. The read is partial and they call it noon.',
            ],
            [
                'n' => 20, 'roman' => 'XX', 'catalog' => 'Judgement', 'compiled' => 'INTERRUPT / RECALL',
                'num_name' => 'twenty · the call that wakes the ten',
                'path' => 'path 31 · Hod–Malkuth',
                'letter' => 'Shin',
                'body' => 'Fire / Pluto / Spirit',
                'thoth' => 'The Aeon',
                'marseille' => 'Le Jugement',
                'num_note' => 'Twenty reduces to 2. A horn, not a courtroom. The audit in guild filing: rise and answer what you already knew.',
                'symbols' => [
                    'Flag / blast. An interrupt that recalls a process from sleep.',
                    'Twenty-two-dot ring. Scarlet hole at station XX.',
                    'Shin is a tooth of fire: the call burns what will not wake.',
                ],
                'psychology' => 'They are being asked to stand up inside their own record. Not punishment. Accountability that can still choose. The Aeon name in Thoth is the same work at world-scale: an age changing its mind.',
                'inverted' => 'They hear the horn and roll over. Or they judge everyone else so they need not rise.',
            ],
            [
                'n' => 21, 'roman' => 'XXI', 'catalog' => 'The World', 'compiled' => 'CLOSED SYSTEM',
                'num_name' => 'twenty-one · 3×7, the dance that completes',
                'path' => 'path 32 · Yesod–Malkuth',
                'letter' => 'Tav',
                'body' => 'Saturn / Earth',
                'thoth' => 'The Universe',
                'marseille' => 'Le Monde',
                'num_note' => 'Twenty-one reduces to 3. The generative number at the scale of a finished world. The canonical graph in guild filing.',
                'symbols' => [
                    'Closed ring. Every standing hole has been visited.',
                    'Twenty-two-dot ring. Scarlet hole at station XXI — last of the cycle, not the last of the work.',
                    'Tav is a mark: the system can be signed as complete for this generation.',
                ],
                'psychology' => 'A whole is present. Not forever. A closed system can be studied, danced, handed on. The hazard is treating completion as a throne, or refusing to close so they never have to be responsible for a finished thing.',
                'inverted' => 'The system will not close, or they are sealing it too early to avoid the last honest page.',
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private static function pipSeed(): array
    {
        return [
            [
                'num' => 1, 'rw' => 'Ace', 'compiled' => 'INITIALISE', 'num_name' => 'ace · root · one',
                'sephira' => 'Kether · the crown of the suit',
                'marseille' => 'As',
                'num_note' => 'Ace is the root, not a small one. The suit exists here as a seed.',
                'thoth' => [
                    'wands' => 'Ace of Wands — Root of the Powers of Fire',
                    'cups' => 'Ace of Cups — Root of the Powers of Water',
                    'swords' => 'Ace of Swords — Root of the Powers of Air',
                    'pentacles' => 'Ace of Disks — Root of the Powers of Earth',
                ],
                'body' => [
                    'wands' => 'Fire · the first spark',
                    'cups' => 'Water · the first well',
                    'swords' => 'Air · the first cut',
                    'pentacles' => 'Earth · the first coin / field',
                ],
                'psy' => [
                    'wands' => 'A programme is powered. Nothing has run. Heat without a job. They want to begin more than they want to finish. Hold the spark. Do not call the spark a career.',
                    'cups' => 'The well is full and unpoured. Feeling arrives before a name. Do not file it as a decision. Recollection starts wet.',
                    'swords' => 'A clean edge is available. One true sentence could start the file. The hazard is swinging before the subject is in view.',
                    'pentacles' => 'A weight has entered the record. Money, land, a body, a box. It is real and it is still only a seed. Do not spend the harvest in the first column.',
                ],
                'inv' => [
                    'wands' => 'The power is there and they will not press start. Or they start six programmes to avoid committing to one.',
                    'cups' => 'The cup is sealed, spilled, or they are performing feeling so they need not feel.',
                    'swords' => 'The blade is sheathed out of fear, or they cut the air to look decisive.',
                    'pentacles' => 'They refuse the gift, or they clutch the seed so it cannot be planted.',
                ],
            ],
            [
                'num' => 2, 'rw' => 'Two', 'compiled' => 'POLARITY', 'num_name' => 'two · dyad',
                'sephira' => 'Chokmah · wisdom as a pair',
                'marseille' => 'Deux',
                'num_note' => 'Two is opposition or partnership. No third yet to decide.',
                'thoth' => [
                    'wands' => 'Two of Wands — Dominion',
                    'cups' => 'Two of Cups — Love',
                    'swords' => 'Two of Swords — Peace',
                    'pentacles' => 'Two of Disks — Change',
                ],
                'body' => [
                    'wands' => 'Mars in Aries',
                    'cups' => 'Venus in Cancer',
                    'swords' => 'Moon in Libra',
                    'pentacles' => 'Jupiter in Capricorn',
                ],
                'psy' => [
                    'wands' => 'Two directions of will. Dominion in Thoth: they can see a horizon and they have not yet walked it. Choice of programme, not yet labour.',
                    'cups' => 'Two recurrences meet. Love as a clean polarity, not a merger. Can they stay two and still pour?',
                    'swords' => 'A truce of blades. Peace that is a held breath. They have stopped the cut; they have not solved the file.',
                    'pentacles' => 'Change as a juggle. Two weights, one pair of hands. The record is in motion. Do not call motion failure.',
                ],
                'inv' => [
                    'wands' => 'They stare at the map and will not pick a road. Or they dominate the other will.',
                    'cups' => 'The polarity has gone sour, or they are fusing to avoid being seen alone.',
                    'swords' => 'The blindfold is rotting. The truce is denial.',
                    'pentacles' => 'They drop a weight and blame the weather. Or they refuse to let either coin move.',
                ],
            ],
            [
                'num' => 3, 'rw' => 'Three', 'compiled' => 'TRIANGULATE', 'num_name' => 'three · first world',
                'sephira' => 'Binah · understanding that can hold',
                'marseille' => 'Trois',
                'num_note' => 'Three makes a plane. Witness, work, or a third who changes the pair.',
                'thoth' => [
                    'wands' => 'Three of Wands — Virtue',
                    'cups' => 'Three of Cups — Abundance',
                    'swords' => 'Three of Swords — Sorrow',
                    'pentacles' => 'Three of Disks — Works',
                ],
                'body' => [
                    'wands' => 'Sun in Aries',
                    'cups' => 'Mercury in Cancer',
                    'swords' => 'Saturn in Libra',
                    'pentacles' => 'Mars in Capricorn',
                ],
                'psy' => [
                    'wands' => 'The programme has a bearing. Virtue in Thoth: ships on a line. Collaboration that still has a spine.',
                    'cups' => 'Shared recollection. A table, a chorus, a mercy. Abundance that must still be poured fairly.',
                    'swords' => 'The third point is a wound. Sorrow is a classification, not a failure of character. Name the cut. Do not decorate it.',
                    'pentacles' => 'Work that can be shown. Three hands, one building. Competence is the feeling. Vanity is the hazard.',
                ],
                'inv' => [
                    'wands' => 'No follow-through, or a partnership that has no virtue left.',
                    'cups' => 'The party is a cover. Someone at the table is not drinking the same water.',
                    'swords' => 'They rehearse the wound so it cannot scar. Or they deny a cut that already happened.',
                    'pentacles' => 'Shoddy work, or they will not let the work be seen.',
                ],
            ],
            [
                'num' => 4, 'rw' => 'Four', 'compiled' => 'STABILISE', 'num_name' => 'four · foundation',
                'sephira' => 'Chesed · mercy as structure',
                'marseille' => 'Quatre',
                'num_note' => 'Four is a table. Rest, law, a room that holds.',
                'thoth' => [
                    'wands' => 'Four of Wands — Completion',
                    'cups' => 'Four of Cups — Luxury',
                    'swords' => 'Four of Swords — Truce',
                    'pentacles' => 'Four of Disks — Power',
                ],
                'body' => [
                    'wands' => 'Venus in Aries',
                    'cups' => 'Moon in Cancer',
                    'swords' => 'Jupiter in Libra',
                    'pentacles' => 'Sun in Capricorn',
                ],
                'psy' => [
                    'wands' => 'A stage of the programme can be marked complete. Celebration is in order if they will actually stop and pin it.',
                    'cups' => 'Enough feeling to refuse more. Luxury in Thoth can be satiety or sulk. Are they resting or declining a real cup?',
                    'swords' => 'Truce. The mind is sent to the bench. Recovery is work. Do not call numbness peace.',
                    'pentacles' => 'A hold on resources. Power as a square. Conservation or a fist. The record is stable; ask at what cost to the living.',
                ],
                'inv' => [
                    'wands' => 'They will not celebrate, or the completion was a show.',
                    'cups' => 'Apathy dressed as taste. The next cup is being refused out of pride.',
                    'swords' => 'Rest denied, or rest used to avoid the next hearing.',
                    'pentacles' => 'Miser or spendthrift. The square has become a cell.',
                ],
            ],
            [
                'num' => 5, 'rw' => 'Five', 'compiled' => 'PERTURB', 'num_name' => 'five · the upset',
                'sephira' => 'Geburah · severity, the necessary shake',
                'marseille' => 'Cinq',
                'num_note' => 'Five breaks the square. Conflict is information if they will read it.',
                'thoth' => [
                    'wands' => 'Five of Wands — Strife',
                    'cups' => 'Five of Cups — Disappointment',
                    'swords' => 'Five of Swords — Defeat',
                    'pentacles' => 'Five of Disks — Worry',
                ],
                'body' => [
                    'wands' => 'Saturn in Leo',
                    'cups' => 'Mars in Scorpio',
                    'swords' => 'Venus in Aquarius',
                    'pentacles' => 'Mercury in Taurus',
                ],
                'psy' => [
                    'wands' => 'The programme is in a scrum. Strife can be sport or a civil war. Ask whether anyone still shares a goal.',
                    'cups' => 'Spillage. Three cups down, two still standing if they will turn. Grief is real. So is the remaining water.',
                    'swords' => 'A mean win or a mean loss. Defeat in Thoth: they got the last word and lost the room. Classification used as humiliation.',
                    'pentacles' => 'Worry as weather. Scarcity, illness, being outside the house. The record is thin. Do not spiritualise a bill.',
                ],
                'inv' => [
                    'wands' => 'The fight is ending, or they have made strife their only sport.',
                    'cups' => 'They can see the standing cups, or they have smashed the last two so the story stays tragic.',
                    'swords' => 'They put the sword down, or they are still collecting scalps.',
                    'pentacles' => 'Help is reachable, or they have made worry a home.',
                ],
            ],
            [
                'num' => 6, 'rw' => 'Six', 'compiled' => 'TRANSFER', 'num_name' => 'six · beauty in motion',
                'sephira' => 'Tiphareth · the heart of the suit',
                'marseille' => 'Six',
                'num_note' => 'Six is a fair exchange after five’s mess. Transfer, not theft.',
                'thoth' => [
                    'wands' => 'Six of Wands — Victory',
                    'cups' => 'Six of Cups — Pleasure',
                    'swords' => 'Six of Swords — Science',
                    'pentacles' => 'Six of Disks — Success',
                ],
                'body' => [
                    'wands' => 'Jupiter in Leo',
                    'cups' => 'Sun in Scorpio',
                    'swords' => 'Mercury in Aquarius',
                    'pentacles' => 'Moon in Taurus',
                ],
                'psy' => [
                    'wands' => 'A transfer of credit. Victory that must be shared or it curdles. Let them have the parade if the work was real.',
                    'cups' => 'Pleasure as recollection: childhood, a returned kindness, a simple pour. Nostalgia is a transfer. Do not live in the old cup.',
                    'swords' => 'Science in Thoth: they leave with what they learned. A crossing. The mind is the boat. Pack the useful blades only.',
                    'pentacles' => 'Success as circulation. Money, help, status moving through hands. A healthy record gives as it takes.',
                ],
                'inv' => [
                    'wands' => 'Hollow victory, or they cannot receive praise.',
                    'cups' => 'They are trapped in the old photograph, or they refuse a present gift.',
                    'swords' => 'They will not leave, or they leave and take the whole war with them.',
                    'pentacles' => 'The gift has strings. Or they cannot let success be seen.',
                ],
            ],
            [
                'num' => 7, 'rw' => 'Seven', 'compiled' => 'THRESHOLD', 'num_name' => 'seven · the test',
                'sephira' => 'Netzach · endurance, the almost',
                'marseille' => 'Sept',
                'num_note' => 'Seven is a gate. Courage or fantasy. The suit is asked to last.',
                'thoth' => [
                    'wands' => 'Seven of Wands — Valour',
                    'cups' => 'Seven of Cups — Debauch',
                    'swords' => 'Seven of Swords — Futility',
                    'pentacles' => 'Seven of Disks — Failure',
                ],
                'body' => [
                    'wands' => 'Mars in Leo',
                    'cups' => 'Venus in Scorpio',
                    'swords' => 'Moon in Aquarius',
                    'pentacles' => 'Saturn in Taurus',
                ],
                'psy' => [
                    'wands' => 'They hold the high ground and it is tiring. Valour is not a speech. One more stand, then a real plan.',
                    'cups' => 'Too many cups. Debauch in Thoth: options as intoxication. Pick, or the threshold becomes a shop window.',
                    'swords' => 'Futility. A clever take that does not change the file. Strategy without a witness. If they must leave, leave clean.',
                    'pentacles' => 'Failure as Thoth names the long wait. Crops not yet. Assessment, not despair. The record needs time they do not want to give.',
                ],
                'inv' => [
                    'wands' => 'They drop the defence, or they pick a fight they do not need.',
                    'cups' => 'The fog lifts, or they dive deeper into the menu.',
                    'swords' => 'The scheme is seen. Confession, or a worse sneak.',
                    'pentacles' => 'A green shoot, or they abandon a field one week before harvest.',
                ],
            ],
            [
                'num' => 8, 'rw' => 'Eight', 'compiled' => 'ITERATE', 'num_name' => 'eight · the cycle of work',
                'sephira' => 'Hod · the mind that repeats until true',
                'marseille' => 'Huit',
                'num_note' => 'Eight is labour, speed, or a message sent again. Iteration is not failure.',
                'thoth' => [
                    'wands' => 'Eight of Wands — Swiftness',
                    'cups' => 'Eight of Cups — Indolence',
                    'swords' => 'Eight of Swords — Interference',
                    'pentacles' => 'Eight of Disks — Prudence',
                ],
                'body' => [
                    'wands' => 'Mercury in Sagittarius',
                    'cups' => 'Saturn in Pisces',
                    'swords' => 'Jupiter in Gemini',
                    'pentacles' => 'Sun in Virgo',
                ],
                'psy' => [
                    'wands' => 'Messages, travel, a programme in flight. Swiftness. Do not grab a moving slip to feel involved.',
                    'cups' => 'Indolence in Thoth: they walk away from a still-full table, or they stay when the water has gone flat. Iteration of feeling until they admit the well has moved.',
                    'swords' => 'Interference. Bound by a story they keep repeating. Most of the ropes are their own loops. One honest cut would do.',
                    'pentacles' => 'Prudence. Craft. Eight repetitions toward a decent object. Apprenticeship is the psychological weather.',
                ],
                'inv' => [
                    'wands' => 'Delays, or they force speed and break the payload.',
                    'cups' => 'They finally leave, or they wander with no new well.',
                    'swords' => 'A rope comes off, or they ask someone else to live in the cage with them.',
                    'pentacles' => 'Hack work, or perfectionism that will not ship.',
                ],
            ],
            [
                'num' => 9, 'rw' => 'Nine', 'compiled' => 'SATURATION', 'num_name' => 'nine · almost ten',
                'sephira' => 'Yesod · the foundation of appearance',
                'marseille' => 'Neuf',
                'num_note' => 'Nine is fullness just before overflow. Strength or anxiety at the brim.',
                'thoth' => [
                    'wands' => 'Nine of Wands — Strength',
                    'cups' => 'Nine of Cups — Happiness',
                    'swords' => 'Nine of Swords — Cruelty',
                    'pentacles' => 'Nine of Disks — Gain',
                ],
                'body' => [
                    'wands' => 'Moon in Sagittarius',
                    'cups' => 'Jupiter in Pisces',
                    'swords' => 'Mars in Gemini',
                    'pentacles' => 'Venus in Virgo',
                ],
                'psy' => [
                    'wands' => 'They have held the line and they are tired. Strength here is scar-tissue and still standing. Rest is not desertion.',
                    'cups' => 'Happiness that can be filed. Saturation of the well. The hazard is calling this the last feeling they will ever need.',
                    'swords' => 'Cruelty, often inward. The mind at 3 a.m. A classification that will not stop classifying. Get a witness. Do not negotiate with the loop alone.',
                    'pentacles' => 'Gain. A garden they actually tended. Solitude with fruit. Do not apologise for a completed row.',
                ],
                'inv' => [
                    'wands' => 'They collapse, or they refuse any help at the wall.',
                    'cups' => 'The wish was hollow, or they cannot enjoy what arrived.',
                    'swords' => 'Dawn, or a darker rehearsal. Take the night seriously either way.',
                    'pentacles' => 'The gain is insecure, or they hide it from anyone who might share it.',
                ],
            ],
            [
                'num' => 10, 'rw' => 'Ten', 'compiled' => 'OVERFLOW', 'num_name' => 'ten · the suit completed',
                'sephira' => 'Malkuth · the kingdom, the result',
                'marseille' => 'Dix',
                'num_note' => 'Ten reduces to 1. The suit has done its work and must hand on or burst.',
                'thoth' => [
                    'wands' => 'Ten of Wands — Oppression',
                    'cups' => 'Ten of Cups — Satiety',
                    'swords' => 'Ten of Swords — Ruin',
                    'pentacles' => 'Ten of Disks — Wealth',
                ],
                'body' => [
                    'wands' => 'Saturn in Sagittarius',
                    'cups' => 'Mars in Pisces',
                    'swords' => 'Sun in Gemini',
                    'pentacles' => 'Mercury in Virgo',
                ],
                'psy' => [
                    'wands' => 'Too much programme on one back. Oppression. They said yes until the hopper jammed. Put a box down. Delegation is a moral act.',
                    'cups' => 'Satiety. The family picture, the full table. Overflow of recollection. Ask who is not in the frame.',
                    'swords' => 'Ruin. The thought has finished killing the thought. It is over. Do not keep stabbing a closed file. Morning is a different card.',
                    'pentacles' => 'Wealth as a finished house: lineage, shop, archive. Overflow of record. The question is who inherits and whether the living can still move in it.',
                ],
                'inv' => [
                    'wands' => 'They set a burden down, or they pick up a second stack.',
                    'cups' => 'The picture cracks, or a real home is trying to be born out of the crack.',
                    'swords' => 'The worst has passed, or they are addicted to the ending.',
                    'pentacles' => 'The house is a museum, or the fortune is leaving through a hole they will not name.',
                ],
            ],
            [
                'num' => 11, 'rw' => 'Page', 'compiled' => 'PROBE', 'num_name' => 'page · earth of the suit · 11',
                'sephira' => 'Princess · Malkuth of the suit',
                'marseille' => 'Valet',
                'num_note' => 'Eleven reduces to 2. A student, a message, a first contact. Not a small adult.',
                'thoth' => [
                    'wands' => 'Princess of Wands',
                    'cups' => 'Princess of Cups',
                    'swords' => 'Princess of Swords',
                    'pentacles' => 'Princess of Disks',
                ],
                'body' => [
                    'wands' => 'Earth of Fire · the probe that burns',
                    'cups' => 'Earth of Water · the probe that dreams',
                    'swords' => 'Earth of Air · the probe that asks',
                    'pentacles' => 'Earth of Earth · the probe that plants',
                ],
                'psy' => [
                    'wands' => 'A new heat. Student of programme. They will rush. Give them a small real fire, not a lecture.',
                    'cups' => 'A new feeling arriving as a story or a creature. Take the message. Do not marry the messenger.',
                    'swords' => 'A sharp question from someone with no office yet. The probe may be ruder than the department likes. Listen anyway.',
                    'pentacles' => 'A student of the record. Hands in soil. They want to make a thing. Let them make a small true thing.',
                ],
                'inv' => [
                    'wands' => 'Gossip of fire, or a spark they will not own.',
                    'cups' => 'Mood as weather they refuse to read.',
                    'swords' => 'Spying, or a question asked only to wound.',
                    'pentacles' => 'Laziness, or they treat the craft as a costume.',
                ],
            ],
            [
                'num' => 12, 'rw' => 'Knight', 'compiled' => 'CARRIER', 'num_name' => 'knight · air of the suit · 12',
                'sephira' => 'Prince · Tiphareth of the suit',
                'marseille' => 'Cavalier',
                'num_note' => 'Twelve reduces to 3. A carrier moves the suit. Arrival and departure are the job.',
                'thoth' => [
                    'wands' => 'Prince of Wands',
                    'cups' => 'Prince of Cups',
                    'swords' => 'Prince of Swords',
                    'pentacles' => 'Prince of Disks',
                ],
                'body' => [
                    'wands' => 'Air of Fire · the carrier of heat',
                    'cups' => 'Air of Water · the carrier of longing',
                    'swords' => 'Air of Air · the carrier of argument',
                    'pentacles' => 'Air of Earth · the carrier of goods',
                ],
                'psy' => [
                    'wands' => 'Charisma in motion. They will change the room and leave. Useful as a carrier. Dangerous as a husband of the work.',
                    'cups' => 'A proposal, a quest, a feeling on horseback. Beautiful and not yet proven. Ask what they will still be when the horse stops.',
                    'swords' => 'A mind that charges. Ideas as cavalry. They may be right and still trample the file. Slow them without humiliating them.',
                    'pentacles' => 'The reliable carrier. Slow horse, full bags. Method. The hazard is mistaking motionlessness for wisdom.',
                ],
                'inv' => [
                    'wands' => 'A crash, or a seduction that will not stay to file.',
                    'cups' => 'A charming absence. Promises that do not dismount.',
                    'swords' => 'Cruel speed. They cut and ride on.',
                    'pentacles' => 'Stuck wheels, or stubbornness called patience.',
                ],
            ],
            [
                'num' => 13, 'rw' => 'Queen', 'compiled' => 'RECEPTIVE CONTROL', 'num_name' => 'queen · water of the suit · 13',
                'sephira' => 'Queen · Binah of the suit',
                'marseille' => 'Reine',
                'num_note' => 'Thirteen reduces to 4. Authority that receives before it commands.',
                'thoth' => [
                    'wands' => 'Queen of Wands',
                    'cups' => 'Queen of Cups',
                    'swords' => 'Queen of Swords',
                    'pentacles' => 'Queen of Disks',
                ],
                'body' => [
                    'wands' => 'Water of Fire · the hearth that rules',
                    'cups' => 'Water of Water · the well that rules',
                    'swords' => 'Water of Air · the widow’s clear eye',
                    'pentacles' => 'Water of Earth · the land that rules',
                ],
                'psy' => [
                    'wands' => 'Warm command. They keep the programme lit and the room fed. Jealousy is the shadow if the fire is only for them.',
                    'cups' => 'Deep reception. They can hold another person’s weather. The hazard is drowning in it, or using intuition as unaccountable law.',
                    'swords' => 'Clear, grief-taught judgement. They have filed a loss and can still cut true. Coldness is the accusation; precision is the gift.',
                    'pentacles' => 'Stewardship. Food, money, body, place. Receptive control of the record. Do not romanticise the labour they hide.',
                ],
                'inv' => [
                    'wands' => 'Tyrant of the hearth, or the fire gone out and blamed on the guests.',
                    'cups' => 'Mood as government. Or a well they will not let anyone drink.',
                    'swords' => 'Cruel precision, or a grief they will not classify so it rules the house.',
                    'pentacles' => 'Hoarding, neglect of the body, or care used as a ledger of debt.',
                ],
            ],
            [
                'num' => 14, 'rw' => 'King', 'compiled' => 'GOVERNING CONTROL', 'num_name' => 'king · fire of the suit · 14',
                'sephira' => 'Knight · Chokmah of the suit',
                'marseille' => 'Roi',
                'num_note' => 'Fourteen reduces to 5. Thoth files this office as Knight. Governing control: the suit spoken as law.',
                'thoth' => [
                    'wands' => 'Knight of Wands',
                    'cups' => 'Knight of Cups',
                    'swords' => 'Knight of Swords',
                    'pentacles' => 'Knight of Disks',
                ],
                'body' => [
                    'wands' => 'Fire of Fire · the law of heat',
                    'cups' => 'Fire of Water · the law of feeling',
                    'swords' => 'Fire of Air · the law of the cut',
                    'pentacles' => 'Fire of Earth · the law of the store',
                ],
                'psy' => [
                    'wands' => 'They run the programme and expect the room to keep up. Vision is real. So is burnout they export. Govern the fire or it governs them.',
                    'cups' => 'They make feeling into policy. Diplomacy, art, a public heart. The hazard is a government of moods.',
                    'swords' => 'They judge. The file needs a last signature. Fairness is the job. Intellect as a throne is the failure.',
                    'pentacles' => 'They keep the store. Kings of record are dull until the roof fails. Ask whether the kingdom can survive their holiday.',
                ],
                'inv' => [
                    'wands' => 'A despot of projects, or an abdication dressed as freedom.',
                    'cups' => 'Manipulation, or a king who will not feel in public and so feels nowhere.',
                    'swords' => 'Tyranny of the correct, or a refusal to decide.',
                    'pentacles' => 'Corruption of the store, or a miser on a throne of boxes.',
                ],
            ],
        ];
    }
}

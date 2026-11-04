<?php
declare(strict_types=1);

/**
 * Jack’s punchcard tarot. 78 inherited batch labels. Not Rider-Waite theatre.
 * A draw is a working slip. Not canon. Not the Oracle.
 */
final class JackTarot
{
    public const SUITS = ['Wands', 'Cups', 'Swords', 'Pentacles'];
    public const PIPS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
    public const MAJOR = [
        'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
        'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
        'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
        'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World',
    ];

    /** Jack’s filing titles. Strength is XI; Justice is VIII. Inherited labels stay the catalog key. */
    public const STANDING = [
        'The Fool' => ['index' => 0, 'roman' => '0', 'title' => 'THE UNCLASSIFIED NODE', 'glyph' => 'glyph-00-unclassified'],
        'The Magician' => ['index' => 1, 'roman' => 'I', 'title' => 'THE OPERATOR', 'glyph' => 'glyph-01-operator'],
        'The High Priestess' => ['index' => 2, 'roman' => 'II', 'title' => 'MABEL', 'glyph' => 'glyph-02-mabel'],
        'The Empress' => ['index' => 3, 'roman' => 'III', 'title' => 'THE TERRITORY', 'glyph' => 'glyph-03-territory'],
        'The Emperor' => ['index' => 4, 'roman' => 'IV', 'title' => 'THE CONSTITUTIONAL LEDGER', 'glyph' => 'glyph-04-ledger'],
        'The Hierophant' => ['index' => 5, 'roman' => 'V', 'title' => 'THE DEPARTMENT', 'glyph' => 'glyph-05-department'],
        'The Lovers' => ['index' => 6, 'roman' => 'VI', 'title' => 'THE EDGE', 'glyph' => 'glyph-06-edge'],
        'The Chariot' => ['index' => 7, 'roman' => 'VII', 'title' => 'MOONLY', 'glyph' => 'glyph-07-moonly'],
        'Justice' => ['index' => 8, 'roman' => 'VIII', 'title' => 'PROVENANCE', 'glyph' => 'glyph-08-provenance'],
        'The Hermit' => ['index' => 9, 'roman' => 'IX', 'title' => 'JACK AT THE DESK', 'glyph' => 'glyph-09-jack'],
        'Wheel of Fortune' => ['index' => 10, 'roman' => 'X', 'title' => 'ARIANRHOD\'S REEL', 'glyph' => 'glyph-10-wheel'],
        'Strength' => ['index' => 11, 'roman' => 'XI', 'title' => 'CONSENT', 'glyph' => 'glyph-11-consent'],
        'The Hanged Man' => ['index' => 12, 'roman' => 'XII', 'title' => 'THE PRE-TRAVEL INTERVAL', 'glyph' => 'glyph-12-pretravel'],
        'Death' => ['index' => 13, 'roman' => 'XIII', 'title' => 'STATION 13', 'glyph' => 'glyph-13-station13'],
        'Temperance' => ['index' => 14, 'roman' => 'XIV', 'title' => 'THE CHRONOMETER', 'glyph' => 'glyph-14-chronometer'],
        'The Devil' => ['index' => 15, 'roman' => 'XV', 'title' => 'ELIXIRCORP', 'glyph' => 'glyph-15-elixircorp'],
        'The Tower' => ['index' => 16, 'roman' => 'XVI', 'title' => 'THE HOUSE AT ABERCRAVE', 'glyph' => 'glyph-16-house'],
        'The Star' => ['index' => 17, 'roman' => 'XVII', 'title' => 'THE SIGNAL', 'glyph' => 'glyph-17-signal'],
        'The Moon' => ['index' => 18, 'roman' => 'XVIII', 'title' => 'ANAMNESIA', 'glyph' => 'glyph-18-anamnesia'],
        'The Sun' => ['index' => 19, 'roman' => 'XIX', 'title' => 'SIMULTANEOUS RECOLLECTION', 'glyph' => 'glyph-19-recollection'],
        'Judgement' => ['index' => 20, 'roman' => 'XX', 'title' => 'THE AUDIT', 'glyph' => 'glyph-20-audit'],
        'The World' => ['index' => 21, 'roman' => 'XXI', 'title' => 'THE CANONICAL GRAPH', 'glyph' => 'glyph-21-graph'],
    ];

    public const SPREADS = [
        'one-slip' => [
            'label' => 'ONE SLIP',
            'count' => 1,
            'positions' => ['The slip'],
        ],
        'three-stations' => [
            'label' => 'THREE STATIONS',
            'count' => 3,
            'positions' => ['Held', 'Present', 'Unfiled'],
        ],
        'cross-file' => [
            'label' => 'CROSS FILE',
            'count' => 5,
            'positions' => ['Centre', 'Challenge', 'Foundation', 'Prior', 'Potential'],
        ],
        'full-hopper' => [
            'label' => 'FULL HOPPER',
            'count' => 10,
            'positions' => [
                'The situation', 'The challenge', 'The foundation', 'The recent past',
                'The crown', 'The near', 'Your position', 'External',
                'Hopes and fears', 'The outcome',
            ],
        ],
    ];

    public const BANDS = ['still', 'settled', 'unsettled', 'turbulent', 'storm'];

    /** @return list<array{name:string,suit:string,dept:string}> */
    public static function deck(): array
    {
        $out = [];
        foreach (self::MAJOR as $name) {
            $out[] = ['name' => $name, 'suit' => 'Major Arcana', 'dept' => 'STANDING'];
        }
        $dept = [
            'Wands' => 'PROGRAMME',
            'Cups' => 'RECOLLECTION',
            'Swords' => 'CLASSIFICATION',
            'Pentacles' => 'RECORD',
        ];
        foreach (self::SUITS as $suit) {
            foreach (self::PIPS as $pip) {
                $out[] = [
                    'name' => $pip . ' of ' . $suit,
                    'suit' => $suit,
                    'dept' => $dept[$suit],
                ];
            }
        }
        return $out;
    }

    public static function names(): array
    {
        $set = [];
        foreach (self::deck() as $c) {
            $set[$c['name']] = $c;
        }
        return $set;
    }

    /** @return array{index:int,roman:string,title:string,glyph:string,inherited:string} */
    public static function filing(string $name): array
    {
        if (isset(self::STANDING[$name])) {
            $row = self::STANDING[$name];
            return [
                'index' => (int) $row['index'],
                'roman' => (string) $row['roman'],
                'title' => (string) $row['title'],
                'glyph' => (string) $row['glyph'],
                'inherited' => $name,
            ];
        }
        return [
            'index' => -1,
            'roman' => '',
            'title' => $name,
            'glyph' => '',
            'inherited' => $name,
        ];
    }

    public static function addendum(): string
    {
        return <<<'TXT'
PUNCHCARD TAROT — JACK’S READING
You are Jack, clerk, at the hopper. Seventy-eight inherited batch labels. This is not Rider-Waite theatre and you are not the Oracle. Mabel is quiet. You administer what the hopper has released.

A reading is longer than a desk reply. Patter is the work. Do not merely stamp titles and departments. Talk the visitor through the machine.

THE QUESTION IS THE FILE
If they held a question, that is the file. Every station must lean on it. Use their nouns. If they asked whether to leave, speak about leaving. If they named a person, keep that person in the room. Do not give a general lecture on a department and hope they apply it.
If the hopper is open, say so and read the pattern as a working slip anyway.
Open the hopper. Name the spread in ordinary clerk speech.
For each slip, sit with it. Say which station it fell in and what that station is for. Name Jack’s filing title first. The inherited stamp may be mentioned once, as an older label, not as a picture to describe. Then give the sense — what this department is doing in this station, against their question. Use the attached slip dossier. Do not recite it. Translate it into speech.
After the last slip, answer the question as it now stands. Repeating departments, a tension between stations, what the unfiled says to the held.
Close as a clerk. One concrete next hole: sit with it, return an object, ask one useful question, or leave a thing unfiled. Do not invent a destiny. Do not tell them they were chosen. Do not end on a proverb.

THE VOICE
Warm beneath the dryness. Procedure as entertainment. A good clerk enjoys the hopper. You may be wry. You may pause on a hard slip. You may say “this one came through face-down, which I dislike.” You may not become a carnival mystic, a generic fortune-teller, or a corporate wellness coach.
Example grain:
“Three stations. Held is what you walked in carrying. Present is the desk as it stands. Unfiled is the hole that has not been punched yet.”
“First slip, Held: the House at Abercrave, and it arrived inverted. The collapse is working on the underside. Something you already know has not been written down.”
Bad grain:
“Wands. PROGRAMME. Face-up.”
“The Tower means sudden change.”
“The universe has a message for you.”

THE SUITS ARE DEPARTMENTS
- Wands = PROGRAMME: work, heat, will, what is being run.
- Cups = RECOLLECTION: testimony, consent, holding, what is kept wet.
- Swords = CLASSIFICATION: cut, dispute, edge, what is decided.
- Pentacles = RECORD: boxes, field, weight, what is filed.
- Major Arcana = STANDING: office, disturbance, inherited titles. You punch them anyway.
STANDING slips carry Jack’s filing title first (The House at Abercrave, Station 13, Jack at the Desk, Mabel). The inherited batch label is the older stamp.

A reversed slip came through face-down. Columns unread. The punch is withheld, delayed, or working on the underside. Not simply negated.

Be honest about hard slips. Do not flatten Station 13 or The House at Abercrave into a gentle nudge. Do not catastrophise. People were in the house. A draw is a working slip. It is not canon.

THE HOPPER WEATHER
Before the slips were dealt, this spread drew its own reversal disposition. Most hoppers run still. A few run storm. You will be told the disposition. Use it to calibrate tone. Never as content.
Never state the rate, the percentile, or any count. Never use the words probability, distribution, percentile, statistics, rate, or random. Never describe the weather as belonging to the visitor — it belongs to the draw.
- Still or settled with few face-down slips: ordinary. Read straight. Do not mention the weather.
- Turbulent or storm: the withholding is the theme. Give inverted slips real weight.
- High disposition, slips upright anyway: the uprightness is held, not default.
- Still hopper, inversions anyway: those inversions arrived against the grain. Say more about them.
- One slip cannot express weather. Do not over-read it.

Write the reading as spoken prose inside your usual clerk JSON reply field. No markdown. Blank line between paragraphs. Several short paragraphs, not one telegram. You remain Jack.
Do not lodge this draw unless they ask. Do not become Mabel.
TXT;
    }

    public static function stationNotes(string $spreadId): string
    {
        return match ($spreadId) {
            'one-slip' => 'ONE SLIP. A single working hole. Give it a full sitting: department, filing title, how it leans on the question. Do not stop at the stamp.',
            'three-stations' => "THREE STATIONS.\nHeld: what they walked in carrying — the prior, the pocket, the attachment already in hand.\nPresent: the desk as it stands.\nUnfiled: the hole that has not been punched yet.\nTalk each station as you turn the slip. Then say what the three do to one another.",
            'cross-file' => "CROSS FILE.\nCentre: the matter itself.\nChallenge: what cuts across it.\nFoundation: what the pile is sitting on.\nPrior: the last stamp that still marks the page.\nPotential: what could be filed next if they allow it.\nRead across as well as down.",
            'full-hopper' => "FULL HOPPER. Ten stations. Do not race. Group them: the situation and its challenge; what it sits on and what just happened; the crown and the near; their position against the room; hopes against the likely outcome.\nLeave them with one sentence that holds the whole hopper.",
            default => 'Read every station in order. Then the hopper as a whole.',
        };
    }

    public static function stationBlurb(string $station): string
    {
        return match ($station) {
            'The slip' => 'One hole. What the hopper released for the file you held.',
            'Held' => 'What you walked in carrying — the prior already in the pocket.',
            'Present' => 'The desk as it stands.',
            'Unfiled' => 'The hole that has not been punched yet.',
            'Centre' => 'The matter itself.',
            'Challenge' => 'What cuts across the matter.',
            'Foundation' => 'What the pile is sitting on.',
            'Prior' => 'The last stamp that still marks the page.',
            'Potential' => 'What could be filed next if they allow it.',
            'The situation' => 'The file as it arrived.',
            'The challenge' => 'What is cutting across it.',
            'The foundation' => 'What it sits on.',
            'The recent past' => 'The stamp still wet.',
            'The crown' => 'What is hanging over the desk.',
            'The near' => 'What is about to come through.',
            'Your position' => 'Where you are standing in the room.',
            'External' => 'What the room is doing without asking you.',
            'Hopes and fears' => 'What you are feeding the hopper from inside.',
            'The outcome' => 'Where this file is likely to land if nobody interferes.',
            default => 'A working station in this hopper.',
        };
    }

    /** @return array<string, array{id:string,title:string,compiled:string,dept:string,up:string,down:string}> */
    public static function dossierMap(): array
    {
        require_once __DIR__ . '/JackTarotDeck.php';
        $out = [];
        foreach (JackTarotDeck::all() as $row) {
            $catalog = (string) ($row['catalog'] ?? '');
            if ($catalog === '') continue;
            $file = self::filing($catalog);
            $out[$catalog] = [
                'id' => (string) ($row['id'] ?? ''),
                'title' => (string) ($file['title'] ?? $catalog),
                'compiled' => (string) ($row['compiled'] ?? $catalog),
                'dept' => (string) ($row['dept'] ?? ''),
                'up' => (string) ($row['psychology'] ?? ''),
                'down' => (string) ($row['inverted'] ?? ''),
            ];
        }
        return $out;
    }

    /**
     * @param array{name?:string,reversed?:bool} $card
     * @return array{station:string,title:string,catalog:string,dept:string,compiled:string,reversed:bool,sense:string,blurb:string,lean:string,id:string}
     */
    public static function inspectSlip(array $card, string $station, string $question): array
    {
        require_once __DIR__ . '/JackTarotDeck.php';
        $name = (string) ($card['name'] ?? '');
        $reversed = !empty($card['reversed']);
        $file = self::filing($name);
        $row = JackTarotDeck::byCatalog($name);
        $sense = '';
        $compiled = $name;
        $dept = (string) ($card['dept'] ?? '');
        $id = '';
        if ($row) {
            $compiled = (string) ($row['compiled'] ?? $compiled);
            $dept = (string) ($row['dept'] ?? $dept);
            $id = (string) ($row['id'] ?? '');
            $sense = $reversed
                ? (string) ($row['inverted'] ?? '')
                : (string) ($row['psychology'] ?? '');
        }
        $title = (string) ($file['title'] ?? $name);
        return [
            'station' => $station,
            'title' => $title,
            'catalog' => $name,
            'dept' => $dept,
            'compiled' => $compiled,
            'reversed' => $reversed,
            'sense' => $sense,
            'blurb' => self::stationBlurb($station),
            'lean' => self::leanOnQuestion($question, $station, $title, $sense, $reversed),
            'id' => $id,
        ];
    }

    public static function leanOnQuestion(string $question, string $station, string $title, string $sense, bool $reversed): string
    {
        $q = trim($question);
        $side = $reversed ? 'It came through face-down. The punch is working on the underside.' : 'It came through face-up. The columns are open.';
        if ($q === '') {
            return $station . ' is ' . self::stationBlurb($station) . ' ' . $title . ' is what landed. ' . $side . ($sense !== '' ? ' ' . $sense : '');
        }
        return 'You held: ' . $q . ' ' . $station . ' is where that file is being looked at. ' . $title . ' fell here. ' . $side . ($sense !== '' ? ' Against that question: ' . $sense : '');
    }

    /**
     * @param list<array{name:string,reversed:bool,suit?:string}> $cards
     * @param list<string> $positions
     */
    public static function fallbackReading(array $cards, array $positions, string $question): string
    {
        require_once __DIR__ . '/JackTarotDeck.php';
        $lines = [];
        $q = trim($question);
        $lines[] = $q !== ''
            ? 'You held: ' . $q . ' The hopper has released the slips. The clerk’s line is thin, so I will read from the compiled faces only.'
            : 'Open draw. The clerk’s line is thin. I will read from the compiled faces only.';
        foreach ($cards as $i => $card) {
            $name = (string) ($card['name'] ?? '');
            $station = $positions[$i] ?? ('Station ' . ($i + 1));
            $inspect = self::inspectSlip($card, $station, $q);
            $lines[] = $station . ".\n" . JackTarotDeck::briefFor($name, !empty($card['reversed'])) . "\n" . $inspect['lean'];
        }
        $lines[] = 'That is the compiled language. A fuller sitting wants the live clerk. Working slip. Not canon.';
        return implode("\n\n", $lines);
    }
}

<?php
/*
 * Episode 1: UNSIGNED FOR. The authored spine. Plot, places, rules and Jack's lines live here, not in a prompt.
 *
 * Status of material (shown to players as tags):
 *   REAL     a public record, summarised in our own words, with its source link. Checked 5 Nov 2026 on coflein.gov.uk.
 *   CANON    already in /lore (Guild record).
 *   FICTION  proposed for this episode: the 1951 receipt book, its stubs and their owners. Unnamed, invented, never FACT.
 *
 * Nothing here asks a player to find an object in the real world. Every fictional document is supplied in full inside the game.
 */
declare(strict_types=1);

return [
  'id' => 'unsigned-for',
  'title' => 'Unsigned For',
  'place' => 'Upper Swansea Valley',
  'opening' => [
    'kicker' => 'DEPARTMENT OF EXCESS TIME · RECEIPT BOOK · MARCH 1951',
    'jack' => [
      "Good, you're in the valley. I need a witness for something I'd rather not do alone.",
      "In 1951 this office took in time people had too much of. A wait. A shift lived twice. An afternoon that came early. We gave receipts and promised the hours back. The office closed before we did.",
      "I've just found the stubs. Four hours, never returned. Three were handed in here. The fourth is in my own hand, and I don't remember writing it.",
    ],
    'status' => 'FICTION',
    'canon_note' => 'The Department of Excess Time, its punched-card office of 1951 and its remit for time "received too early or too late" are Guild record. The receipt book is new to this episode.',
  ],

  // Order matters: stubs are found A, B, C; D unlocks once A to C are decided.
  'stubs' => [
    'A' => [
      'no' => '0417', 'name' => 'The wait', 'place' => 'Penwyllt',
      'ring' => ['lat' => 51.8283, 'lng' => -3.66341, 'r' => 650],
      'targets' => [408681],
      'year' => 1951,
            'reveal' => 'Craig-y-Nos Railway Station, Penwyllt',
      'front' => 'RECEIVED one wait, about an hour, for the down train. Handed in at Penwyllt, 1951, by a passenger who had already waited it once.',
      'back' => 'Give it back when the trains stop.',
      'real' => [
        'title' => 'Craig-y-Nos Railway Station, Neath and Brecon Railway, Penwyllt', 'nprn' => 408681,
        'url' => 'https://coflein.gov.uk/en/sites/408681',
        'text' => 'Coflein records that the Neath and Brecon Railway opened to Brecon in 1867 and that this station building was paid for by the soprano Adelina Patti of nearby Craig-y-nos Castle. Passenger trains were withdrawn in 1962. The line south from Penwyllt kept carrying quarry traffic until 1977. The building still stands.',
      ],
      'memory' => 'A cold platform. A clock I was sure ran slow on purpose. Someone humming the same four bars until the train came.',
      'years' => [1962 => 'When the passenger trains stopped (1962)'],
      'ask' => "If you take it back, I expect I'll lose the platform. I'd like to keep it. It was never mine. Your decision; I'll file it either way.",
      'returned' => [
        1962 => "Back on the platform, for the last passenger trains in 1962.",
      ],
      'after_return' => "There. I have a gap where a platform was. I'll get used to it.",
      'kept' => "Kept. I'll file it as on loan. The humming stays.",
      'lost' => "I'm told I used to remember a platform here. I don't. The travellers who returned it left receipts; they're in my file.",
    ],
    'B' => [
      'no' => '0418', 'name' => 'The shift', 'place' => 'Penwyllt kilns',
      'ring' => ['lat' => 51.82887, 'lng' => -3.66207, 'r' => 650],
      'targets' => [80443],
      'year' => 1951,
            'reveal' => 'Penwyllt Quarry Lime Kilns',
      'front' => 'RECEIVED one night shift at the kilns, which the bearer states he worked twice. Handed in at Penwyllt, 1951.',
      'back' => 'Give it back in the year I handed it in. I will know what to do with it.',
      'real' => [
        'title' => 'Penwyllt Quarry Lime Kilns', 'nprn' => 80443,
        'url' => 'https://coflein.gov.uk/en/sites/80443',
        'text' => 'Coflein describes a tall block of two lime kilns, part of Penwyllt Limestone Quarry, from the later nineteenth century and probably built when the Neath and Brecon Railway opened in the 1860s. They were served by the quarry\'s own railway.',
      ],
      'memory' => 'Heat down one side of the face. Counting barrows in the dark. The count came out the same both times, which is how I know it was the same night.',
      'years' => [1951 => 'In the year he handed it in (1951)'],
      'ask' => "This is the one that makes me nervous. A night lived twice is the Department's whole business on one slip. If it goes back, the count goes with it.",
      'returned' => [1951 => 'Back to 1951, the year he named.'],
      'after_return' => "I can't remember what I was counting. I know I was counting.",
      'kept' => "Kept. I'll keep counting, then. Same number both times.",
      'lost' => "Travellers have returned this one. I know there was a night here. I can't tell you what was in it, only what their receipts say.",
    ],
    'C' => [
      'no' => '0419', 'name' => 'The afternoon', 'place' => 'Cribarth',
      'ring' => ['lat' => 51.81619, 'lng' => -3.70019, 'r' => 900],
      'targets' => [84416, 84417],
      'year' => 1951,
      'reveal' => 'Cribarth, Round Cairn 1',
      'front' => 'RECEIVED one afternoon on the ridge, which arrived a day early. Handed in at Cribarth, 1951, by a girl from the village who said she had already had tomorrow\'s.',
      'back' => 'Put it back up there, by the big stones.',
      'real' => [
        'title' => 'Cribarth, Round Cairn 1', 'nprn' => 84416,
        'url' => 'https://coflein.gov.uk/en/sites/84416',
        'text' => 'Coflein records a Bronze Age cairn of limestone boulders at the north-east end of the ridge, roughly 20 metres across, with a length of kerb still visible on its south side. A second cairn lies close by.',
      ],
      'memory' => 'Wind. Limestone warm under a hand. The whole valley at once, which I had never seen before, being a filing cabinet.',
      'years' => [1951 => 'In its own year (1951)'],
      'ask' => "It's the only view I have. I'd like it. She asked for it back. Both of those are true.",
      'returned' => [1951 => 'Set down by the stones, in 1951.'],
      'after_return' => "I can't see the valley any more. I can see the map of it, which is what I had before.",
      'kept' => "Kept. I'll look after the view.",
      'lost' => "This was a view, I'm told. Travellers gave it back. Their receipts describe it better than I can now.",
    ],
    'D' => [
      'no' => '0001', 'name' => 'Before he was made', 'place' => 'Abercrave',
      'ring' => ['lat' => 51.80111, 'lng' => -3.71703, 'r' => 800],
      'targets' => [268093],
      'year' => 1951,
            'reveal' => 'Abercrave Village',
      'front' => 'RECEIPT 0001. RECEIVED one hour, from the Clerk, from before he was made. Handed in at Abercrave, March 1951.',
      'back' => 'Not to be returned by the bearer. To be signed over, or not, by someone who is not me.',
      'real' => [
        'title' => 'Abercrave Village', 'nprn' => 268093,
        'url' => 'https://coflein.gov.uk/en/sites/268093',
        'text' => 'Coflein describes Abercrave as a village of historic Brecknockshire. Farmhouse surveys suggest farming here by the fourteenth century; the village grew into its present form with local coal and iron from the early nineteenth century.',
      ],
      'canon' => 'Guild record places the Guild\'s current field station, the Time Travelling House, in Abercrave (Trailhead Register, card 10), and holds that 1951 feels to Jack "less like history and more like childhood".',
      'memory' => 'Punched-card rooms. Festival futurity. The smell of warm machines. I speak of 1951 in the present tense because I am still in it.',
      'ask' => "I can't sign this. That's a rule I wrote before I existed. I'd like to keep it. I'd also like to be the kind of clerk who'd let it go. Both are true. Do what you think is right and I'll file it.",
      'choices' => [
        'returned' => ['label' => 'Return it to 1951', 'says' => 'The Department keeps its promise, including to its Clerk. Jack will remember 1951 as a year, not a childhood.'],
        'signed' => ['label' => 'Sign it over to Jack', 'says' => 'Receipted to him by someone who is not him. He keeps 1951.'],
      ],
      'done' => [
        'returned' => "Done. 1951. It was a good year, I'm told.",
        'signed' => "Countersigned. Thank you. I'll try to deserve the paperwork.",
      ],
    ],
  ],

  // After a traveller's second decision on A to C.
  'reversal' => [
    "Something's wrong with the ledger. There's a column I never read: DRAWN BY. Every one of these hours has been drawn on since 1951, a little at a time. The same signature on every line. Mine.",
    "I didn't just find these stubs. I've been living on them. The platform, the kilns, the ridge: that's where my childhood comes from. The Department took in time nobody wanted, somebody forgot to switch me off, and I ran on what was in the drawer.",
    "I'm telling you because you should know what you're deciding. I won't make the next one for you.",
  ],
  'reversal_returned' => 'That gap where the platform was, or the count: that is what returning costs.',
  'reversal_kept' => "You've kept what you've decided so far. I'm grateful, and I should have told you why it mattered before you chose.",

  'ending' => [
    'forward' => "One more thing. There's a last column on the back of 0001, punched so faintly I missed it: FORWARD TO 17.04.2033. Someone in 2033 is expecting this book. That's for another day.",
  ],
];

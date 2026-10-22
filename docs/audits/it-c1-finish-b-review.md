# Italian C1 completion batch B — editorial review

Five complete newly written lessons, ten routes. This note covers only
`content/story-expansion/v1/it-c1-finish-b.json`; it does not certify the whole
catalogue or a formal CEFR examination.

| Lesson | Route words A / B | C1 listening/reading demand | Distinct route consequences |
| --- | ---: | --- | --- |
| `new-it-c1-la-firma-troppo-presto` | 365 / 370 | Detect the pressure concealed by a freedom-of-choice disclaimer; distinguish interest from agreement. | Explicitly stop the announcement and schedule negotiations / inspect the borrowed folder, uncover the unrelated form and pause the ceremony. |
| `new-it-c1-parenti-a-sorpresa` | 388 / 389 | Interpret a time euphemism and the social effect of unspoken assumptions. | Clarify the week-long visit before settling in and book rooms / discover the same intended duration after dinner and negotiate the remaining nights after an improvised first night. |
| `new-it-c1-il-pianista-si-nasconde` | 389 / 381 | Distinguish a tentative causal hypothesis from an imposed explanation; identify consent and hidden evaluation. | Voluntary duet with an agreed stopping option / self-directed home recording, subsequently offered by its performer. |
| `new-it-c1-lo-sportello-invisibile` | 389 / 399 | Interpret service irony and the unwanted obligation created by a status shortcut. | Ordinary service procedure plus a separate complaint / the status hint produces a mistaken speaking role before the practical question is answered. |
| `new-it-c1-la-medaglia-da-scontrino` | 413 / 393 | Infer the request behind claimed disinterest and distinguish a gift's actual meaning from its presentation. | Abandon the award request and display a drawing / frame an explicitly ordinary visit sticker and then clarify its meaning. |

Word counts include the actual selected answers and each scene on the route;
they use the same Unicode word pattern as the expansion validator. Length is a
supporting editorial measure, not the reason for assigning C1. The dialogues use
concessive and hypothetical clauses, qualifications, self-correction and
pragmatic inference, with questions that test the intentions evidenced by their
specified line.

## Source provenance and independent expression

The approved research plans reference five different Chekhov works. Their
primary-text pages were opened during this pass:

- [Неудача](https://ru.wikisource.org/wiki/Неудача_(Чехов)) — a premature public ritual supplies a broad comic mechanism. The new lesson uses a tasting between business owners, an explicit discussion agenda and a borrowed dance-registration form; its wording and both branches are new.
- [Дачники](https://ru.wikisource.org/wiki/Дачники_(Чехов)) — an unexpected visit supplies the broad conflict of mismatched hospitality expectations. The new story develops room booking, explicit duration and a luggage/folding-bed problem, rather than translating the source encounter.
- [Кто виноват?](https://ru.wikisource.org/wiki/Кто_виноват%3F_(Чехов)) — a counterproductive approach to teaching supplies a broad causal contrast. The lesson is an adult music-club conversation about agreed participation; it omits animal mistreatment and makes no diagnosis or treatment claim.
- [Справка](https://ru.wikisource.org/wiki/Справка_(Чехов)) — unequal attention supplies a broad service-satire mechanism. The new hotel story has no monetary inducement and develops an ordinary service request, complaint tracking and an accidental conference greeting.
- [Лев и Солнце](https://ru.wikisource.org/wiki/Лев_и_Солнце_(Чехов)) — hospitality performed for recognition supplies a broad motive. The new lesson concerns a shop sign researcher, a drawing and a clearly labelled visit souvenir; it neither reproduces the source official setting nor its dialogue.

All Italian dialogue, player answers, Russian translations, vocabulary choices,
exercise options, explanations and outcomes were authored anew. No source
wording, modern translation, editorial annotation, artwork or recording was
copied. The source metadata remains exactly as approved in the research plans;
the lessons explicitly identify themselves as newly written adaptations, not
as authentic Italian texts by Chekhov. This is an editorial originality and
appropriateness check, not a legal certification.

## Checks completed

- `validateExpansion(rows, {complete:false})`: five valid distinct story IDs,
  fingerprints, source identities, five-node graphs and cast pairs.
- Exact matching against every assigned plan's ID, language, level, fingerprint,
  source title, author, URL and status.
- Ten reachable complete routes, with different terminal results for the two
  choices and consistent starting facts across both branches.
- Four generated authored exercises per route (`story-exercises-v2`), correct
  answers accepted by the grader, evidence limited to visited scenes, and no
  exercise set produced for an incomplete route.
- Three vocabulary expressions per opening; actual inflected phrases retained
  where a dictionary infinitive would not occur verbatim.
- Manual review of the specified exercise evidence, natural Russian meaning,
  consistent forms of address, adult human characters and considerate humour.

No audio was generated or marked as ready. Whole-catalogue duplicate review,
integration and release checks remain the responsibility of the integration
pass.

## Independent-review corrections

The independent catalogue reviewer read all five lessons and their question
alternatives. Two precise corrections were applied: Mara's duration question is
now a shared proposal («Chiariamo»), consistent with Elia subsequently reporting
the actual question; references to the masculine «adesivo» now use «Lo» or the
explicit noun. Russian wording was aligned. Structural and route-exercise
checks passed again after these edits; the second award-story route is now
393 words. No unsupported answer was identified by that review.

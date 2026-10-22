# Story expansion v1: authoring contract

Research plans are not published stories. Root approves each plan against the
whole catalogue before authoring. Each approved source plot appears once across
both languages. Do not reproduce an old plot by changing its names or setting.

Write a JSON array in `content/story-expansion/v1/<partition>.json`.
Partition names: `en-lower`, `en-middle`, `it-lower`, `it-middle`, `advanced`
(English C1), `advanced-it-a` and `advanced-it-b` (Italian C1, explicit subsets
assigned by root from the shared advanced research plans).
Do not modify another author's partition. Preserve the approved plan ID.

## Story object

```json
{
  "id": "new-en-a1-example",
  "language": "en",
  "level": "A1",
  "title": "Target-language title",
  "topic": "Target-language topic",
  "summary": "Short target-language description without the ending.",
  "context": "Target-language situation and your role, without spoilers.",
  "hook": "Target-language invitation, without revealing the solution.",
  "genre": "comedy",
  "source": {
    "title": "Exact source work",
    "author": "Author",
    "url": "https://verified-primary-source.example/work",
    "status": "Accurate edition/public-domain provenance from the research plan",
    "adaptation": "По мотивам; новые персонажи, диалоги и развилки."
  },
  "plotFingerprint": "specific-conflict-action-payoff",
  "pedagogy": {
    "rationaleRU": "Why this language AND inference demand fit the level.",
    "grammar": ["present simple"],
    "listeningFocusRU": "What the learner must distinguish by listening."
  },
  "cast": [
    {"actorId": "traveler", "name": "Mia", "roleRU": "Конкретная роль игрока"},
    {"actorId": "host", "name": "Sam", "roleRU": "Конкретная роль собеседника"}
  ],
  "vocabulary": [
    {"term": "exact phrase in opening dialogue", "ru": "перевод"},
    {"term": "another opening phrase", "ru": "перевод"},
    {"term": "third opening phrase", "ru": "перевод"}
  ],
  "start": "start",
  "nodes": {
    "start": {
      "lines": [{"speaker": 1, "text": "Dialogue in the target language.", "ru": "Точный естественный перевод."}],
      "choices": [{"text": "Spoken player answer.", "ru": "Перевод ответа.", "next": "a"}],
      "frame": {"location": "cafe", "prop": "cup", "mood": "thinking", "caption": "Короткая подпись без раскрытия ответа", "clue": {"title": "Деталь", "body": "Наблюдение об обстановке без подсказки к упражнению"}}
    }
  },
  "exercises": {
    "opening": {"nodeId": "start", "line": 0, "prompt": "Вопрос по услышанному", "options": ["Правдоподобный вариант", "Правильный вариант", "Другой вариант"], "answer": 1, "explanation": "Почему именно этот ответ следует из реплики."},
    "phrase": {"nodeId": "start", "line": 0, "anchor": "exact phrase", "prompt": "Что означает выражение в контексте?", "options": ["...", "...", "..."], "answer": 0, "explanation": "Смысл выражения в этой ситуации."},
    "branches": {
      "a": {"nodeId": "a", "line": 0, "prompt": "Вопрос по данной ветке", "options": ["...", "...", "..."], "answer": 2, "explanation": "Основание в прослушанной ветке."},
      "b": {"nodeId": "b", "line": 0, "prompt": "Другой вопрос по другой ветке", "options": ["...", "...", "..."], "answer": 0, "explanation": "Основание в прослушанной ветке."}
    }
  }
}
```

The example shows field shapes, not a valid complete story. Complete graph:
`start` has two genuinely different choices leading to `a` / `b`; these nodes
lead to different endings `end-a` / `end-b`. At least three scenes per route.
Use 5–9 reachable nodes, no loops. Each non-ending node has 1–2 spoken choices.
Each ending has `choices: []` and `outcome: {title, body}` in Russian explaining
only that reached ending. Middle nodes have a branch exercise. The first middle
node on every route needs a branch question with evidence from that node.

Every scene has 1–3 dialogue lines. Prefer two short turns where conversationally
natural. Both cast members speak somewhere; speaker index 0 is the player, all
choices use their voice. Two distinct human actor IDs per story:
`traveler` (woman29), `curator` (woman48), `cartographer` (man35), `host` (man36),
`maker` (man42), `conductor` (man52). Their artwork is reused; assign fitting
roles/names explicitly, do not promise story-specific illustrations. Choose a
female/male pair for Italian where possible to distinguish the available voices.

Locations: `cafe station square home office park gallery market`.
Props: `phone clock map cup book ticket camera parcel tools umbrella laptop conversation`.
Moods: `neutral speaking thinking pleased`.

## Editorial standards

- All dialogue, answers, titles, context, hook, topic, summary are in the lesson
  language. All translations, exercise questions, options and explanations are
  Russian. Cast names follow the target-language setting.
- Three vocabulary items, all exact case-insensitive substrings of opening
  dialogue; choose useful expressions, not character names. No ending spoilers.
- A1: concrete familiar events, short present-tense clauses, no essential idioms
  or implied social motives. A2: simple connected everyday events and basic past.
  B1: clear reasons, consequences and familiar narrative. B2: contrasting claims,
  qualified positions, contextual idiom and justified inference. C1: natural
  implicit stance/register/subtext; the listening task must actually test it.
- Length alone is not CEFR. For orientation, a complete route can be about
  65–110 words A1, 110–180 A2, 170–260 B1, 240–360 B2, 330–480 C1. These are
  editorial ranges, not official thresholds. Never pad with generic morals.
- Humour emerges from events or a small reversal, never mocking learners or
  relying on obscure cultural knowledge. No forced joke required in every story.
- Every choice changes what happens. No identical ending with a renamed object.
  Keep time, facts, ownership and character knowledge consistent on both routes.
- All exercise answers must be supported by their referenced line, with one
  unambiguous correct answer. Plausible distractors; no answer-length giveaway.
  B2/C1 questions should test intention/inference, not only literal translation.
- Do not quote modern translations, copy protected contemporary story wording,
  or call an entire website public domain. Preserve accurate source provenance.
- Do not generate generic template prose in a loop. Scripts may assemble or
  validate explicitly authored content; each story and branch is written anew.
- Deliver batches of 5–10 complete stories for early validation/audio preparation.
  Include all assigned stories before saying your partition is complete.
## Consistency between branches

Both branches share the same initial facts, object properties, relationships and timetable. The learner's choice changes what people do and the result; it must not arbitrarily change which initial claim was true. Evidence questions must be supported by the exact referenced line in the chosen route.

## Originality and the user's copyright clarification

The user clarified: do not infringe copyright; make independent analogous stories.
Research supplies broad ideas, comic mechanisms and examples of difficulty. It
does not supply text to copy or closely paraphrase. Each lesson needs its own
human characters, concrete situation, dialogue, actions and branching outcomes.
Changing only names and objects in another writer's story is not sufficient.

Write all target-language dialogue and Russian translations anew. Do not copy
modern translations, editorial annotations, illustrations or recordings. Preserve
the actual research provenance internally; removing attribution does not make a
derivative text original. Explain that the lesson is a newly written adaptation,
not an authentic text written by the named classic author. An old general motif
may remain recognisable; assess the actual new expression and developments.

Free web access or public-domain status in the USA alone is not proof of Russian
reuse rights. If an edition's rights are uncertain, do not reuse its wording.
Report a close retelling or uncertain copied material before release. Review
originality alongside plot diversity, language level and branch consistency.
Do not replace this editorial task with a broad legal audit of every archived
variant, or invent a legal certification. Keep the everyday humour considerate
and the adapted events appropriate for language learning.

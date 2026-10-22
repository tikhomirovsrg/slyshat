# Независимая редакторская проверка перехода каталога

Дата: 2026-10-22. Проверяется восстановленный выпуск и завершённые партии,
а не содержимое действующего сервера. Генерация и качество новой озвучки в эту
проверку не входят.

## Итог и объём

246 новых историй структурно завершены; 492 маршрута дают по четыре задания v2.
Вместе с 54 отобранными прежними историями это составляет 300 активных карточек,
по 150 на язык и по 30 на уровень в каждом языке. Распределение обеспечивается
планом отбора; сам факт ровных чисел не является доказательством уровня.

Независимо перечитаны целевые реплики, оба маршрута и опорные строки правильных
ответов **122 историй**: 94 из восстановленных партий и все 28 дописанных.
У всех 28 дописанных историй дополнительно просмотрены все отвлекающие варианты.
Для остальных проведён общий просмотр названий, описаний и причинных сюжетных
признаков; у 54 сохранённых материалов — описаний и схем конфликтов/исходов.
Четыре пары из автоматической очереди проверены по самим диалогам.
Прежний `story-editorial-review-2026-10-22.json` содержит 130 старых контрольных
точек чтения; они не выдаются здесь за заново выполненную независимую проверку.
Ниже перечислены ID и контрольные суммы действительно перечитанных объектов.

После исправлений не обнаружено оставшегося материального противоречия веток,
неподдержанного правильного ответа или повторения целого сюжета в просмотренной
выборке. Это не обещание отсутствия любой редакторской ошибки во всех строках.

## Исправленные находки

1. `new-it-c1-la-visita-generosa`: согласованы формы с **il vaso** — `venderlo`,
   `l’ha comprato`; исправлены две женские формы, оставшиеся после смены предмета.
2. `new-it-c1-scuse-in-copia`: односоставный ответ `«ricevuto»` отмечен кавычками,
   чтобы чтение `la risposta ricevuto` не выглядело ошибочным согласованием.
3. `new-it-a1-paper-cushion`: случайные переходы tu/Lei заменены последовательным
   tu; русские переводы приведены к тому же обращению. Неловкий финал о ногах
   подарка заменён конкретным `nelle tue mani` с точным русским переводом.
4. У пяти вопросов убрана самая заметная подсказка длиной правильного ответа:
   `the-overattentive-host/a`, `hidden-in-the-heading/opening`,
   `the-installation-moves-in/opening`, `the-paid-copyist/b`,
   `storm-behind-curtains/a`. Неверные варианты теперь имеют сопоставимую длину
   и относятся к ситуации. Индекс правильного ответа и его опорная строка сохранены.
   В opening `the-paid-copyist` двусмысленное «ограничивают отсутствие» заменено
   смыслом «удерживают владелицу вне мастерской».
5. В новой `new-it-b2-due-regali-identici` найдено слишком близкое повторение
   `new-it-c1-la-visita-generosa`: огромные подаренные вазы мешают получателю,
   а затем используются для зонтов. Автор по согласованию с root заменил историю
   на **двое бьющих часов**. Теперь одна ветка связывает часовые пояса для звонков
   дочери, другая показывает провал речи о точности из-за несогласованного боя.
   Исправлен исследовательский план; сохранены ID и происхождение общего мотива.
   Перечитан уже новый вариант, совпадающий финал с зонтичницей устранён.
6. В B2 finish-a исправлена принадлежность выбираемых реплик: все choices говорят
   от лица cast[0]. В `invisibile-in-prova`, `patente-di-guastafeste`,
   `meta-della-ricompensa`, `pesce-che-non-si-rifara` и `trofeo-con-tecnico`
   прежние «я/мой» иногда относились к собеседнику. Исправлены обращения и переводы.
   В начале `invisibile-in-prova` убрано преждевременное знание героя о притворстве
   коллег: теперь он действительно ошибочно принимает их реакцию за доказательство.
7. В `new-it-c1-cinque-esperti-un-bottone` согласованы masculine bottone/ricambio
   (`mettiamolo`, `tirato`, `sollevarlo`, `scivolato`, `visto`).
8. В `new-it-c1-parenti-a-sorpresa` выбор «уточним» согласован с тем, что вопрос
   затем задаёт супруг. В `new-it-c1-la-medaglia-da-scontrino` явно назван masculine
   `adesivo`, устранена неясная женская ссылка. Авторы применили правки и повторили
   проверку своих маршрутов; итоговые строки перечитаны.

Пункты 1–4 применил независимый редактор. Пункты 5–8 внесли владельцы соответствующих
новых партий после конкретных замечаний. Аудио по исправленной редакции не создавалось;
старый PCM-кеш нельзя считать записью этой версии.

## Четыре сюжетные пары из очереди планов

| Пара | Решение по событию, действию и исходу |
|---|---|
| `new-en-a1-ball-in-vase` / `new-it-a1-empty-clean-glass` | Не дубли. В первом нужно физически достать плавающий мяч из узкого сосуда: вода поднимает его либо сосуд переворачивают. Во втором пустой стакан служит косвенной просьбой о напитке; выход — прямая просьба или самостоятельное наливание. Общее слово «вода» не делает причины и решения одинаковыми. |
| `new-it-a1-three-season-coat` / `new-it-a1-two-shirts-one` | Не дубли. Съёмная подкладка специально имеет полезную функцию для другой температуры. Случайный шов двух отдельных вещей мешает снять одну из них и требует устранения ошибки либо запасного костюма. |
| `new-it-a2-coat-at-table` / `new-it-b1-giacca-attaccata` | Не дубли. Пиджак в первом разоблачает статусное отношение к одному человеку. Во втором ткань физически зажата в стуле; речь о пропущенном предупреждении и освобождении вещи. |
| `new-en-b1-welcome-again` / `new-it-c1-la-firma-troppo-presto` | Не дубли. Английский партнёр забыл **уже подписанное** соглашение; решения воплощают существующее равноправие. Итальянская церемония давит на **ещё не принятое** решение; выбор останавливает ложное объявление либо вскрывает отсутствие основания для подписи. Время и причинность противоположны. |

Ещё одна близкая тема: `new-it-b2-pesce-che-non-si-rifara` и
`new-it-b2-farfalla-fuori-copione` обе затрагивают воспроизводимость случайного
сценического успеха. Первая отделяет скопированный предмет от социального события
и создаёт новый номер о поиске; вторая отделяет сыгранную реакцию от настоящей
неожиданности и выбирает новую постановочную шутку либо возвращение к серьёзной сцене.
Это разные причины, действия и финалы; они не стоят подряд в текущем порядке B2.
Английская `second-first-performance` родственна темой, но посвящена мелодии,
возникшей из ошибки, и выбору между пояснённой реконструкцией и новой аранжировкой.

## Что всё ещё переиспользуется

54 сохранённых истории включают 40 исходных сюжетов и 14 представителей прежних
сценарных семейств (по семь на язык). У этих 14 различаются конфликты времени,
бюджета, даты, шума, участия, охвата и распределения задач. При этом часть
заключительных реплик о сообщении группе/совместном объяснении остаётся общей.
Их нельзя называть 14 полностью заново озвученными и нарисованными произведениями.
Повтор общей нейтральной концовки здесь не приравнивается к повтору целого сюжета.
Повторяющиеся варианты тех же семейств исключены из активного каталога.

Автоматический `audit-dialogue` сравнивает новые истории с новыми и сохранёнными;
он намеренно не выдаёт общие старые концовки за новую находку, поскольку не сравнивает
сохранённые с сохранёнными. В итоговом отчёте нет длинных точных повторов и нет
новых пар выше установленного порога лексической очереди. Это дополняет чтение,
а не доказывает уникальность одним числом сходства.

## Уровни и задания

В просмотренной выборке переход A1→C1 поддерживается не скоростью, а языком и задачей.
A1 использует видимые предметы, место, количество и короткие действия; например,
мяч в вазе и бумажная упаковка. A2 связывает бытовые события и причины, простое
прошлое и условия покупки; `first-concert-debt` — верхняя граница A2 из-за нескольких
денежных величин, поэтому пригодность стоит дополнительно проверить на учащихся.
B1 требует связать причину с последствием и понять явно объяснённую реакцию.
B2 сопоставляет условия и основания: например, частный опыт с эскизами не доказывает
общую полезность беспорядка, а одинаковый отказ пульта у разных людей не устанавливает
саму сломанную деталь. C1 действительно использует неявный статус, регистр, риторические
оговорки и границы согласия: проверяются функция церемонности, подмена чужого выбора
публикой и самооправдывающие формулировки, а не только перевод отдельных слов.

Длины новых маршрутов после редакции — диагностическое описание, не порог CEFR:

| Язык | Уровень | Новых историй | Слов в маршруте |
|---|---|---:|---:|
| en | A1 | 30 | 73–93 |
| en | A2 | 19 | 114–160 |
| en | B1 | 21 | 184–223 |
| en | B2 | 25 | 236–296 |
| en | C1 | 28 | 331–406 |
| it | A1 | 29 | 68–100 |
| it | A2 | 19 | 105–136 |
| it | B1 | 22 | 182–242 |
| it | B2 | 25 | 248–358 |
| it | C1 | 28 | 332–438 |

Правильные ответы просмотренных вопросов следуют из указанной строки выбранной ветки.
Автоматически у всех 492 маршрутов проверены достижимость опорных сцен и четыре задания.
Общая тема или повтор одного учебного вывода («спросить прямо», «не путать впечатление
с доказательством») не считается отдельной гарантией разнообразия: оцениваются сами события.
Некоторые английские вопросы всё ещё дают более развёрнутый правильный ответ, чем
отвлекающие; пять крайних случаев исправлены, но остальные варианты стоит калибровать
по реальным ответам учеников, а не обещать равную трудность всех вопросов.

## Происхождение и границы

Источники и авторы исследовательских мотивов сохранены. Новые материалы не выдаются
за подлинный текст классического автора; человеческие диалоги, русские переводы,
развилки и упражнения написаны для курса. При просмотре не найдено перенесённого
взрослого эпизода или унижения учащегося; юмор опирается на события и самоиронию.
Проверка собственной редакции не является внешней проверкой всех источников на
заимствования или юридическим заключением о законодательстве РФ. Правовые границы
и происхождение исследований зафиксированы в прежнем отчёте о самостоятельности.
Носительская вычитка всей записи и исследование с учащимися ещё не выполнены.

## Воспроизводимая проверка

Выполнены `node scripts/story-expansion/validate.mjs`,
`node scripts/story-expansion/audit-dialogue.mjs` и
`node scripts/story-expansion/audit-plans.mjs`.
Итог: 246 новых историй, 492 маршрута, 0 повторных ID/источников/сюжетных ключей,
0 длинных повторённых фрагментов, четыре разобранные пары планов.
Контрольная сумма выпуска на момент чтения: `fe0c4f8569137d3de5e24d469a0c34e7bea66a70e491b0f60c8650601a8560a7`.
Проверки приложения/сборки выполняются root отдельно; их результат не приписывается
редакторской проверке.

## ID независимо перечитанных историй

SHA-256 вычислен по JSON отдельного объекта с сортировкой ключей, UTF-8 и компактными
разделителями. Это контрольная точка конкретной редакции, а не знак сертификации.

| ID | SHA-256 |
|---|---|
| `new-en-a1-button-under-cushion` | `b6fced012b75503f1b7b6cffaf8d37a503ced83ab212aca10cc5c1259cbacbd6` |
| `new-en-b2-reward-for-not-taking` | `91d0578d82c02c6412ea5264adf0a874fa2bcd7eccf40285d62a9fae35dfb1be` |
| `new-en-b2-second-first-performance` | `9d347b6471445b545b04496076a4b627a6425836399c5502d6e3de9104c7333c` |
| `new-en-b2-shared-secret-prize` | `7b94ea037595c1da34b400547befc2ffba54171d9fb50c02dc0658645d772bd2` |
| `new-en-b2-singlehanded-helper` | `d4bbaf229f6a9d683e8664e55828476863123161484c9e32bf4b7f22aa3c0a22` |
| `new-en-b2-storm-behind-curtains` | `e73d29fc4ce9a937dc74bf811a2c550130cc8a7a047783e4f4a0c85628e5e54e` |
| `new-en-b2-too-perfect-errand` | `8740d2e4cf12763dad4356f5f0d676a67b6ab8086cc939893576cedfbfbd64c0` |
| `new-en-b2-two-borrowed-roles` | `cb40ff14c8800a938e039aa9362143e2ea312548856ca72133d07bd096ba967a` |
| `new-en-b2-two-secret-shifts` | `2c28ba8db4c0682234ad360bf92e08ec4932ae5ecf42efab097ebe40b05daa0f` |
| `new-en-b2-unspendable-voucher` | `1af5aee108f087a9993297b33eaae402c19bb3f092a37ca0c3d69b298795666d` |
| `new-en-b2-wrong-turn-winner` | `d316228dea545514a97a53f4f63b8f20b31a0bd48535eb1728eee1c300dedd5b` |
| `new-en-c1-hidden-in-the-heading` | `5f0fa773f4566b646bf160baf25f61f878f05e6d5f6bec0cd2d37a7200d8dae5` |
| `new-en-c1-the-installation-moves-in` | `d51dad3d5622b41324964ac99dd4dfd0c3fd972df817d5fd8893e0a960edb509` |
| `new-en-c1-the-overattentive-host` | `ce5f902a27ac0216803445d90e1fbe82c370f41efd5b8db291bdadeab69d341b` |
| `new-en-c1-the-paid-copyist` | `018b51f710d0527b03518410150facf33a289855b37dcec4549dbf5e7d9a653d` |
| `new-it-a1-beautiful-useful-stones` | `36825831ad87772d228d6a15637e0cf63c3c4bf6a2eeabaa70b87872edff90b0` |
| `new-it-a1-bread-smell-candles` | `8064f8ce3226d8701d3f6c78f31566704d3165f3b6e70e9a0d2f3df385fb2b3e` |
| `new-it-a1-costume-nap` | `4429175be8afcaff530c823106879aa5e4cc09ed7cf22cc6406c7fbb5a57c31a` |
| `new-it-a1-egg-endless-bread` | `a994f527b89fe02245d5f77c6426be0e4e648b97d41e807b6dba35e17946d7de` |
| `new-it-a1-gift-of-hands` | `f8ca9a4cf7b8d1b4c610a3fd1b57f80e39374b45c14c9122e54d0864f11e232d` |
| `new-it-a1-hat-over-eyes` | `9cbc1e7d7e087134e605c210cce9d972e8e01be37d990dceb7fd64fe6535bb42` |
| `new-it-a1-missing-sock-feet` | `8c295cc8887c466607be06971eb8af0ac5d0778cb246c957c61eae9fb0ea414d` |
| `new-it-a1-old-fashioned-cart` | `f5a6a2aeff7d1bc18f50223e7eab24dba22803e5f4cf6808b986396d550f35ff` |
| `new-it-a1-one-minute-visitor` | `35bef080c546b8f404627b151ca040deac7cccaf09ef8bd6b4002b9fdea3a18e` |
| `new-it-a1-paper-cushion` | `c8aaed081a528901419332fd8bc5cf1863ae8b73db3d9ea4261f12266cb8147e` |
| `new-it-a1-pear-peels` | `c6420d64b5c83ecc03d30e0b468cf746d570f32749dd168932d06b2ca2411afc` |
| `new-it-a1-rattle-in-box` | `6bebeba03e89c04660fb2580f7212b05432f9806cc0bba960a1d51d25e305dd3` |
| `new-it-a1-roman-five` | `16b571bd8c81f014ed287aa458aea1cf99e1c20fdd7b274ab33d4cb0116396ed` |
| `new-it-a1-shared-empty-wallets` | `ae23866d0eda9dab033e88a2afd8b62f1c10e1590a07f05f95d8a737a2a07121` |
| `new-it-a1-silent-puppet` | `75140d40aaa46f3121ba9e9d8cdaafd2ab883b43ea81e4fdc2e9eb9678148ce3` |
| `new-it-a1-three-season-coat` | `5c6f6292d6306ecd6ab0ac5a614898d0788169012a9c72815e5391527f58f044` |
| `new-it-a1-too-many-first-figs` | `06ca9f8a54679b878c7b460f47fcc30cd85c7084642a85faa72daa88833fc46a` |
| `new-it-a1-unasked-bicycle` | `4c5294caed546ff407b37c2f55f551ae645b57ddb2c900d118565bfc16f1e0ca` |
| `new-it-a2-above-the-top` | `13f65bcb199ea9eb68ef3a0f1a340e2ef2ad3a7642f905f91d4e6d7ed4c2a75b` |
| `new-it-a2-appetite-not-job` | `b8f942c512eff45208fd76ad8191f33868e54f0bc1cfda62ab1fd72e959373e5` |
| `new-it-a2-before-the-trip` | `f4d8472995f46bbe7c06df36493f1fa37bf71e2ce7b62e63a743ea8c77c68e45` |
| `new-it-a2-box-under-sample` | `7c04168ed8991234a103ad5dde261e6444c92b701a4938b5949f1e1ef450d886` |
| `new-it-a2-change-backwards` | `d399989eb8e900297bc1a5f7191c626333d0bce642e5cbd013a0423dfd589170` |
| `new-it-a2-coat-at-table` | `4d844cfb6aa831aca4fdb95bc617ddc0d34dabd10517abc50b4fb388173d2024` |
| `new-it-a2-customer-who-paid` | `e3999b19056c6f51810dc4e3b98f6a40042cb419b7fd2e1086aa6c042f834ec2` |
| `new-it-a2-endless-crossing` | `7e68fe8df613b0feadd5b09aa7790760eb2bb2ee6492e268c69ce110eea996e5` |
| `new-it-a2-first-concert-debt` | `8d9e17fdfa4d319ac60931ee4c8f3804b3e052316339c5451a9d4e6df8a40819` |
| `new-it-a2-five-haircuts` | `785217fd75416647365a5058cbf8bfd8c5ff61d8d2b5933119c9db9a8cd01a2f` |
| `new-it-a2-gift-inside-cake` | `d52ad5cc1cbef8d3f9ff06a6fa09c437d6640d3e2105e459d172755c72151a6f` |
| `new-it-a2-one-actor-two-names` | `50437db1e1bcd66ce6d557108d374f5ab2fe7eb25e002022223bd0131f084c27` |
| `new-it-a2-pay-for-smell` | `ad06b018acd5825bab2e8d5b3b5a2c7ac2af9f82069aa842bb4ca54436b3c8d6` |
| `new-it-a2-perfect-bad-report` | `ff7aba07a2c5d965805f1c1250219b0553072d94c80a03a5a865a810971ac724` |
| `new-it-a2-predicted-blackout` | `7a82b8a20e5a43a2588eaae1e1df00f68dd8ab0e114347e7fe8be0d6089b5a62` |
| `new-it-a2-two-advisers-two-gifts` | `a44310513da04db1c04f0080e76dc528d1f2fc5bec379d5ef00b2d50f611576c` |
| `new-it-a2-what-you-want` | `9f9da59a7b283695cca058ef37b6ff94a6935a6ec9a6a8e12b1b1ef071290827` |
| `new-it-a2-words-not-kept` | `f10c6dc8b5a106747f595737fed4b895332f3325d58fc4e2a26ce53a7d586488` |
| `new-it-a2-wrong-audience` | `9ecc510ad0ad1f62bdb939f74ec655912004cf739d93ae544ec0518b414dd8c2` |
| `new-it-b1-calze-sul-muro` | `2b1bd7e0b822edb6258d5cd329f0579f0e8c93a157ced74158856be432d22370` |
| `new-it-b1-carte-nel-canale` | `2cf873b3991a64129aef456d4b87debe1f038d7512eb607d4abfbf8443e9a5fc` |
| `new-it-b1-foto-tristi` | `84a6b99d6707e3cdcc33ce829dd3b1856c9908e4accc36836d8e8e528b2b0c54` |
| `new-it-b1-giacca-attaccata` | `e70b86a353a9b320449f33f5a51faaf624602b95b0abc2b20b85103fba5d5f88` |
| `new-it-b1-inchiostro-per-tutti` | `b09891aafb1dada0a63524d651547efc6ced0c5bd389eb9f54e7768fd147434c` |
| `new-it-b1-lite-con-un-libro` | `8f6ae23b4d3da6f586ca78557e54690a451abd8ddd8bfe369e3d92c296b95436` |
| `new-it-b1-messaggio-dimenticato` | `9e2c83068a89022665c62890fd0d7bd8c396c0e97c72d662412022bfe8c15f99` |
| `new-it-b1-metro-che-si-accorcia` | `71a15b5b2d019822687b13c1458cc55e8bf189b7c9c0d083e50f760eb8ae8fed` |
| `new-it-b1-moda-di-prendere-vigne` | `5b61b04834ded5a94f569ccfa7058c8add4defaefd8e6326213efd6cfe717d41` |
| `new-it-b1-orso-sul-cappello` | `2d8cd2b845f2a98a3a3a21eb2aaf46686e6ab3089d399938f710cf88fb54f30b` |
| `new-it-b1-pasta-in-fuga` | `88dfad94d5225e5bfec4aa267161008dbdb37a4b27c98e3b55838f4747f310c3` |
| `new-it-b1-promessa-alla-porta` | `187d428f0113ab2928a4007064f4ab5b90ff410ab1485a43a8cf531a9758cfb5` |
| `new-it-b1-stemma-di-attrezzi` | `b4bb9790a700d26b69dc96003623613df13d72eee5be831f5a1c3e56a3f01577` |
| `new-it-b1-terra-in-carriola` | `8c1c7c178b8f9c3948532c5cebc9d723eb1b4d7ed0eedd4ae916dcb5ae55ff5d` |
| `new-it-b1-toppa-scarlatta` | `96a68d01e4a1b95c193f940e452769c1356703c0c26c1a040f940b3871115d34` |
| `new-it-b1-torta-per-grammatica` | `8686ae4941d8a14faa9f72dd0523f82eed367498a859dbbb89c77d7ae397b1b7` |
| `new-it-b1-uccello-rarissimo` | `649e498277b9d484cdf567644a4718f9a0f82362a0616e2c65afa116848bc6cd` |
| `new-it-b1-uova-nelle-tasche` | `45d67ecb1f5739a81509f5ea42f866f6f09aaa02b6bad88b3260e896a238de75` |
| `new-it-b1-versi-e-martelli` | `5fbef6a1f39e808742997b3cd7615e76cf36b898caec4c464b1a62da356d0bbf` |
| `new-it-b2-amico-che-non-ricordo` | `2a419af383a2dfc06a8e5401f02a953820e6fb2f91db7012052086805fdd0877` |
| `new-it-b2-due-regali-identici` | `7dc830e12c58af81ef0f59ebb404adec5d622abf2bff1bbf1ff99f51ed3b5d63` |
| `new-it-b2-farfalla-fuori-copione` | `e81de900d78b9b3fac9cfbb64a766797035fd9e440401218464c448af9853e9f` |
| `new-it-b2-fischio-dal-cortile` | `0fac671641470260ee2d2e84c9ad529be17ec249fab8bbb7c05ae0d9126f5eb1` |
| `new-it-b2-invisibile-in-prova` | `3d984537e7b6b8480efed60b31fc4182fd3214f4cdb51a3c2f087ef98d604531` |
| `new-it-b2-manica-ribelle` | `2aed57b07311f63ed27e869446796decf27cf25173b3771c0cb00f048b6a3721` |
| `new-it-b2-meta-della-ricompensa` | `a4ec83c27b32392af7a8bf5f587d0109c3c4bba7e51e1742e141091b3a828eb4` |
| `new-it-b2-minestra-cosmica` | `518ca4faeb8dcd379e7c9913971a1c265851aa43094a244776686c5cb4970521` |
| `new-it-b2-parete-che-sospira` | `85e1850ef8c867d8983ecf2e9bc452322c578c763c4f0e23c0776c525fa6a2e9` |
| `new-it-b2-patente-di-guastafeste` | `629479ffe2f2e40c38c87f39c299b344838269311f8b8b63d8c5b9b02ce4be66` |
| `new-it-b2-pesce-che-non-si-rifara` | `e0a9f75aad6a5b3dd3474830b8743bc49a2abd074e2db4cbea58e619c19bc178` |
| `new-it-b2-pranzo-della-rivincita` | `e42256a9984872ea5eb76aaaa0d3f881b2c096087b98b362c578dce9c6eaa0f8` |
| `new-it-b2-prima-divisa` | `5c70fd5b4142eeb9a201ab2b33c2561bfe9941edc165ce28689da3e841fbdce8` |
| `new-it-b2-promessa-sensazionale` | `9ceb5f7ead7736f08825a23fc943dcd2dd7449d4c1206d3c725195da58f30461` |
| `new-it-b2-pubblico-impermeabile` | `f4c70c63573b0973a866bf65ec1f310d36cb70ebc928a5a88313d8ae6dfc4fb4` |
| `new-it-b2-ricevuta-dimenticata` | `01b270fee489f3887fe4757f1c076992bdf64a57ad8d0d7b4601532034cc91fc` |
| `new-it-b2-scatola-del-grande-numero` | `29019d990e19c3ed2bfbd649a75f975c8df8f4313c4cfb7e561508647d5ada92` |
| `new-it-b2-seconda-scatola` | `332db5094d235ea4dcf6dc8f7e6a5c83b4afd9df723dca941d55879de3326c0d` |
| `new-it-b2-secondo-pittore` | `5cc4c864dc2811772ef00f8539e2f45be081ba0bc474b1db7f65205469be33ce` |
| `new-it-b2-teiera-sulle-ruote` | `28cd7c143fd2ae5c6793fc5fad855382d1cbd61929d68e0a8bf3fd73d85921bd` |
| `new-it-b2-trofeo-con-tecnico` | `a599769e3f7eda183d6e3664790e1b5128915df18e2ab08bdfdebd7d2abbacae` |
| `new-it-b2-verita-incredibili` | `71d21aa0eec8cb322c8641d40fef04883705cecc82b85d6334ce457ce1651b2a` |
| `new-it-b2-voce-del-duca` | `32d828d33c33205b0ff0dd0a43d994d5f658805ae8d0213f7080268e4dd35373` |
| `new-it-c1-cinque-esperti-un-bottone` | `a66b3ee56636e0c1790cddb1ff0552c005be0e8a2ea523628535094ed931973c` |
| `new-it-c1-il-discorso-per-un-altro` | `f8c360dbcd95541e43e24cc66916099796262af5b6a84ed95cb6d1c1d27df984` |
| `new-it-c1-il-genio-ha-sete` | `67f5d88a4dbdec9ecfeb69c9aeb085638bfbca3e7c1c7d56696ee1bc9f19eaf7` |
| `new-it-c1-il-passeggero-formidabile` | `b0459e59389d6ef4730730812715d23e780c0dba009cb57cb4f96c0f8461d14a` |
| `new-it-c1-il-pianista-si-nasconde` | `1dd36206760de22914279f157c8252c5304fdfc44255f29df0f753cc7bf755e1` |
| `new-it-c1-il-prezzo-della-liberta` | `656c3119a899ecc1a35bc0e6d7feec56f587ef52a6d5dac5211d9adafa4fe58b` |
| `new-it-c1-il-professore-del-balcone` | `6b58e0208f067033585ddacc361b61b4d2e0ca153a46ccfc94e951af24147a60` |
| `new-it-c1-il-quaderno-risponde` | `be28d34e87a727ca94657ce2db6bc2b0908338d4fe2edec59ef10c6f22a1fcaf` |
| `new-it-c1-il-reclamo-senza-fine` | `234f84f0d7e21b67cdca8adcfc1951bbe9e07d4af80d3e82d68829f54d541df7` |
| `new-it-c1-il-ritratto-riciclato` | `e5d4a58f418d00e635c900cc1b71ccf937e85d21963508e6ba928e2620acb8ee` |
| `new-it-c1-il-vincitore-sbagliato` | `e98399261585090cb174bcb1f707e45192c581d8a6089706ab82b18cf66ca04f` |
| `new-it-c1-la-bicicletta-importante` | `071163d215f6f7c280e295ee105e4b4c58e6ed59bffcf7957ee1cc3c5990ee47` |
| `new-it-c1-la-borsa-aperta` | `37659fd07eca013edbf2195f875eabb1e0b6b50d89e3356b1b7dbfe0b205463f` |
| `new-it-c1-la-fila-per-niente` | `849739bd69ba93d7ea8b679fb464789e6af25b719cc9897124611ee752427a08` |
| `new-it-c1-la-firma-troppo-presto` | `e10a9e206ae8d010ccdf3f1c4b31922d26259ecccdc0648801b729745afe38de` |
| `new-it-c1-la-lampada-di-ritorno` | `413bd305eba0432c96d748aac958a504d7ede01b294b6ebafcc5afb5404d14cc` |
| `new-it-c1-la-medaglia-da-scontrino` | `ce2cbaca9213c1f5e1a12333a0726c11c151a3fd343ad4345aa939f11dec6c58` |
| `new-it-c1-la-smentita-perfetta` | `6fed776d53b02fd7c9ad43375c58309b21f8900d010337d667a62152dce7b85d` |
| `new-it-c1-la-vincita-immaginaria` | `0a441d27bf33f5a5d6af446a475b89ac11460d8ed3bb0f355f5bfdf713dfc54a` |
| `new-it-c1-la-visita-generosa` | `c36ef56b54ed28dbfdad5d4417faec9dddff9ec67e1282980624cd6276ea3999` |
| `new-it-c1-lo-sportello-invisibile` | `b1643f53cd4e3176faf43e79510f801774a9a7fd110cc0652fd2f11b85bf7866` |
| `new-it-c1-parenti-a-sorpresa` | `b84c83ff5c4d95438f01a80f2ced2a237a31232fb2547cd4c6fe5cd689c128a1` |
| `new-it-c1-quattro-libri-zero-frasi` | `2232fd8c9e2cbdf1dba4d31750aa0ad7dee210ea7985014d5000c196edd70de5` |
| `new-it-c1-salvare-il-buon-nome` | `056d43771594a91f7a0f911d3e88b3c9849cc056b50819a4d73da8996c67bc2e` |
| `new-it-c1-scuse-in-copia` | `a37f21dfdc8e7c4dfeaea642da5addb3cc43b9355f31ca88d9b35e6de4d948da` |
| `new-it-c1-un-aiuto-di-troppo` | `e52852555117aabe4494328dd58e7341ea568976370720935ce49a27a493b66d` |
| `new-it-c1-un-amico-eccellentissimo` | `a9fdc42f8197c2be7680319691f95463bbf57351837bd01cc479ae51d67121e2` |
| `new-it-c1-un-nome-da-mangiare` | `3b3867f3dde508725b5b3a1f256f5035d3b06e65205ceff4d8d6e74de3c1d451` |

# Бесплатные записи Kokoro

Слышать — образцы локальной нейроозвучки

Сгенерировано 6 MP3, около 2 минут в сумме:
- it-if_sara.mp3 — итальянский, женский голос Sara.
- it-im_nicola.mp3 — итальянский, мужской голос Nicola.
- en-bf_emma.mp3 — британский английский, женский голос Emma.
- en-bm_george.mp3 — британский английский, мужской голос George.
- it-coffee-dialogue.mp3 — одна ветка итальянской истории «Кофе» двумя голосами.
- en-coffee-dialogue.mp3 — одна ветка английской истории «Кофе» двумя голосами.

Это пробный набор для оценки звучания, а не озвучка всей библиотеки историй.
Один и тот же начальный текст в каждом языке прочитан двумя голосами для сравнения.
Тексты и переводы находятся в texts.txt; метаданные и контрольные суммы — в manifest.json.
Файлы можно проигрывать без API-ключа и подключения к сервису синтеза.
В приложении записи доступны в разделе «Аудио». Для появления на сервере нужно обновить и пересобрать контейнер.

Движок: Kokoro-82M v1.0, kokoro-onnx 0.6.1, ONNX Runtime CPU.
Голоса синтетические. Генерация выполнялась локально, платные API не использовались.
MP3 mono 24 kHz, VBR; исходный синтез speed=1.0.
Проверены декодирование, длительность, отсутствие пустого сигнала.
Это техническая проверка, не оценка произношения носителем языка.

Модель: https://huggingface.co/hexgrad/Kokoro-82M (Apache-2.0)
Движок: https://github.com/thewh1teagle/kokoro-onnx (MIT)

Воспроизведение генерации:
1. Создать Python 3.12 virtualenv, установить пакеты из requirements.txt; нужен ffmpeg.
2. Скачать kokoro-v1.0.onnx и voices-v1.0.bin из официального релиза:
   https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1
3. Положить обе модели рядом с generate_samples.py.
4. Запустить python generate_samples.py; MP3 появятся в output/.
Большие файлы моделей в репозиторий не включены. Скрипт и requirements.txt находятся в scripts/kokoro-samples/. Готовые MP3 и manifest.json размещены в public/audio/kokoro/.

SHA256 kokoro-v1.0.onnx: beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a
SHA256 voices-v1.0.bin: bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d

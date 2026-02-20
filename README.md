# PartyMaker

MVP сервиса совместного выбора фильма с реальным TMDB API.

## Настройка ключа TMDB
Сервер ищет ключи в таком порядке:
1. Переменные окружения `TMDB_API_KEY` / `TMDB_ACCESS_TOKEN`
2. Файл `.env` в корне проекта

Если ключи не найдены, API вернёт понятную ошибку с подсказкой для bash/PowerShell.

### Linux/macOS (bash/zsh)
```bash
export TMDB_API_KEY=your_tmdb_key
python3 server.py
```

### Windows PowerShell
```powershell
$env:TMDB_API_KEY = "your_tmdb_key"
python server.py
```

### Через `.env` (кроссплатформенно)
Создай файл `.env` рядом с `server.py`:
```env
TMDB_API_KEY=your_tmdb_key
# или
# TMDB_ACCESS_TOKEN=your_tmdb_bearer_token
```

Потом запускай:
```bash
python3 server.py
```

## Быстрая проверка конфигурации
После запуска:
```bash
curl http://localhost:4173/api/config-check
```
Ожидаемо: `tmdb_api_key_set: true` или `tmdb_access_token_set: true`.

## Запуск
```bash
cd PartyMaker
python3 server.py
```
Открыть: `http://localhost:4173`

## Проверка сценария
1. На ПК: введите имя хоста, нажмите «Создать комнату».
2. Гость может:
   - сканировать QR комнаты, или
   - открыть новый сайт и вручную ввести код комнаты.
3. Гость вводит ник и нажимает «Присоединиться».
4. Хост нажимает «Начать голосование».
5. Каждый участник голосует за фильмы со своего устройства.
6. Хост нажимает «Обработать раунд».
7. После единогласного лайка появляется итог и финальный QR.
8. Финальный QR открывает страницу итогового фильма (`final.html`).

## Swagger / OpenAPI
- OpenAPI JSON: `http://localhost:4173/openapi.json`
- Swagger UI: `http://localhost:4173/docs`
- Основной endpoint для практики №5: `POST /api/qr/generate`

## Документация по практике №5
- Текстовое описание сервиса: `reports/service_description.md`
- Отчет по практике №5: `reports/practice_work_5.md`

## Практика №6: интеграционная веб-платформа
- UI интеграции: `http://localhost:4173/platform.html`
- Endpoint интеграции: `POST /api/platform/integrate`
- Mock API одногруппника (для локальной проверки): `POST /api/mock/classmate/recommend`

### Формат запроса `/api/platform/integrate`
```json
{
  "title": "Интерстеллар",
  "date": "2014",
  "movie_link": "https://www.themoviedb.org/movie/157336-interstellar",
  "classmate_api_url": "https://<classmate>.amvera.io/api/..."
}
```

### Что делает бизнес-логика
1. Платформа вызывает собственное QR API (внутренне) и получает `qr_url`.
2. Добавляет `qr_url` к данным фильма.
3. Отправляет объединенные данные в API одногруппника (или локальный mock).
4. Возвращает объединенный результат, включая ошибки интеграции.

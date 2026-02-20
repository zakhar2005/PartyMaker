#!/usr/bin/env python3
import json
import os
import random
import string
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, urlencode, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError

TMDB_BASE = 'https://api.themoviedb.org/3'
IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'
ROOMS = {}


OPENAPI_SPEC = {
    'openapi': '3.0.3',
    'info': {
        'title': 'PartyMaker QR API',
        'version': '1.0.0',
        'description': 'API генерации QR-кода для итогового выбранного фильма.',
    },
    'servers': [{'url': 'http://localhost:4173'}],
    'paths': {
        '/api/qr/generate': {
            'post': {
                'summary': 'Сгенерировать QR-код для фильма',
                'description': 'Принимает информацию о фильме и возвращает ссылку на QR-код.',
                'requestBody': {
                    'required': True,
                    'content': {
                        'application/json': {
                            'schema': {
                                'type': 'object',
                                'required': ['title', 'movie_link'],
                                'properties': {
                                    'title': {'type': 'string', 'example': 'Дюна: Часть вторая'},
                                    'date': {'type': 'string', 'example': '2024'},
                                    'movie_link': {'type': 'string', 'format': 'uri', 'example': 'https://www.themoviedb.org/movie/693134-dune-part-two'},
                                },
                            }
                        }
                    },
                },
                'responses': {
                    '200': {
                        'description': 'QR-код успешно сгенерирован',
                        'content': {
                            'application/json': {
                                'schema': {
                                    'type': 'object',
                                    'properties': {
                                        'title': {'type': 'string'},
                                        'date': {'type': 'string'},
                                        'movie_link': {'type': 'string'},
                                        'qr_url': {'type': 'string', 'format': 'uri'},
                                    },
                                }
                            }
                        },
                    },
                    '400': {'description': 'Ошибка валидации входных данных'},
                },
            }
        },
        '/api/config-check': {
            'get': {
                'summary': 'Проверить видимость TMDB-ключей',
                'responses': {
                    '200': {
                        'description': 'Статус конфигурации',
                        'content': {'application/json': {'schema': {'type': 'object'}}},
                    }
                },
            }
        },
    },
}


def _load_dotenv(path='.env'):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, val = line.split('=', 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
    except FileNotFoundError:
        pass


def get_tmdb_credentials():
    _load_dotenv()
    return os.getenv('TMDB_API_KEY'), os.getenv('TMDB_ACCESS_TOKEN')


def room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def tmdb_get(path, params=None):
    api_key, access_token = get_tmdb_credentials()
    if not api_key and not access_token:
        raise RuntimeError(
            'TMDB_API_KEY or TMDB_ACCESS_TOKEN is not set. '
            'Set env var (bash: export TMDB_API_KEY=..., PowerShell: $env:TMDB_API_KEY="...") '
            'or create .env with TMDB_API_KEY=...'
        )

    params = params or {}
    headers = {'Accept': 'application/json'}

    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    else:
        params['api_key'] = api_key

    query = urlencode(params)
    url = f"{TMDB_BASE}{path}?{query}" if query else f"{TMDB_BASE}{path}"
    req = Request(url, headers=headers)
    with urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch_top(page=1):
    data = tmdb_get('/movie/top_rated', {'language': 'ru-RU', 'page': page})
    return data.get('results', [])


def fetch_genres():
    data = tmdb_get('/genre/movie/list', {'language': 'ru-RU'})
    return {x['id']: x['name'] for x in data.get('genres', [])}


def fetch_by_genres(genre_ids, page=1):
    if not genre_ids:
        return []
    data = tmdb_get('/discover/movie', {
        'language': 'ru-RU',
        'sort_by': 'vote_count.desc',
        'vote_count.gte': 500,
        'with_genres': ','.join(str(x) for x in genre_ids),
        'page': page,
    })
    return data.get('results', [])


def normalize(movie, genre_map):
    ids = movie.get('genre_ids', [])
    return {
        'id': movie['id'],
        'title': movie.get('title', 'Без названия'),
        'year': (movie.get('release_date', '') or '----')[:4],
        'rating': round(movie.get('vote_average', 0), 1),
        'overview': movie.get('overview') or 'Описание отсутствует.',
        'genres': [genre_map.get(i, str(i)) for i in ids],
        'genre_ids': ids,
        'poster': f"{IMAGE_BASE}{movie['poster_path']}" if movie.get('poster_path') else '',
    }


def build_batch(room, round_no):
    genre_map = room['genre_map']
    seen = room['seen_ids']

    if round_no == 1:
        source = fetch_top(1) + fetch_top(2)
    else:
        gids = room['top_genre_ids'][:3]
        source = fetch_by_genres(gids, 1) + fetch_by_genres(gids, 2)
        if len(source) < 3:
            source += fetch_top(1)

    batch = []
    for m in source:
        if m['id'] in seen:
            continue
        nm = normalize(m, genre_map)
        if not nm['poster']:
            continue
        batch.append(nm)
        seen.add(nm['id'])
        if len(batch) == 3:
            break
    return batch


def build_qr_url(payload):
    return f"https://api.qrserver.com/v1/create-qr-code/?size=256x256&data={quote(json.dumps(payload, ensure_ascii=False))}"


class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code, html):
        body = html.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length', '0'))
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}')

    def do_GET(self):
        p = urlparse(self.path).path

        if p == '/openapi.json':
            return self._json(200, OPENAPI_SPEC)

        if p == '/docs':
            return self._html(200, """
<!doctype html><html><head>
  <meta charset='utf-8'><title>PartyMaker Swagger</title>
  <link rel='stylesheet' href='https://unpkg.com/swagger-ui-dist@5/swagger-ui.css'>
</head><body>
  <div id='swagger-ui'></div>
  <script src='https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js'></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });
  </script>
</body></html>
            """)

        if p == '/api/config-check':
            key, token = get_tmdb_credentials()
            return self._json(200, {
                'tmdb_api_key_set': bool(key),
                'tmdb_access_token_set': bool(token),
            })

        if p.startswith('/api/rooms/'):
            code = p.split('/')[3] if len(p.split('/')) > 3 else None
            room = ROOMS.get(code)
            if not room:
                return self._json(404, {'error': 'Комната не найдена'})
            return self._json(200, {
                'code': code,
                'participants': room['participants'],
                'round': room['round'],
                'movies': room['movies'],
                'votes': room['votes'],
                'top_genres': room['top_genres'],
                'winner': room['winner'],
            })
        return super().do_GET()

    def do_POST(self):
        p = urlparse(self.path).path
        try:
            if p == '/api/qr/generate':
                data = self._body()
                title = (data.get('title') or '').strip()
                date = (data.get('date') or '').strip()
                movie_link = (data.get('movie_link') or '').strip()
                if not title or not movie_link:
                    return self._json(400, {'error': 'Поля title и movie_link обязательны'})
                payload = {'title': title, 'date': date, 'movie_link': movie_link}
                return self._json(200, {**payload, 'qr_url': build_qr_url(payload)})

            if p == '/api/rooms':
                data = self._body()
                host = (data.get('hostName') or '').strip()
                if not host:
                    return self._json(400, {'error': 'Введите имя хоста'})
                code = room_code()
                ROOMS[code] = {
                    'participants': [host],
                    'round': 0,
                    'movies': [],
                    'votes': {},
                    'top_genres': [],
                    'top_genre_ids': [],
                    'winner': None,
                    'genre_map': fetch_genres(),
                    'seen_ids': set(),
                }
                return self._json(200, {'code': code, 'host': host})

            if '/join' in p:
                code = p.split('/')[3].upper()
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})
                nick = (self._body().get('nickname') or '').strip()
                if not nick:
                    return self._json(400, {'error': 'Введите ник'})
                if nick not in room['participants']:
                    room['participants'].append(nick)
                    for mv in room['votes'].values():
                        mv[nick] = None
                return self._json(200, {'ok': True, 'participants': room['participants']})

            if '/start' in p:
                code = p.split('/')[3].upper()
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})
                room['round'] = 1
                room['winner'] = None
                room['movies'] = build_batch(room, 1)
                room['votes'] = {str(m['id']): {u: None for u in room['participants']} for m in room['movies']}
                return self._json(200, {'ok': True})

            if '/vote' in p:
                code = p.split('/')[3].upper()
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})
                data = self._body()
                mid = str(data.get('movieId'))
                user = data.get('participant')
                val = data.get('vote')
                if mid in room['votes'] and user in room['votes'][mid] and val in ('like', 'dislike'):
                    room['votes'][mid][user] = val
                    return self._json(200, {'ok': True})
                return self._json(400, {'error': 'Некорректный голос'})

            if '/process' in p:
                code = p.split('/')[3].upper()
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})

                for m in room['movies']:
                    mv = room['votes'].get(str(m['id']), {})
                    if any(v is None for v in mv.values()):
                        return self._json(400, {'error': 'Не все проголосовали'})

                for m in room['movies']:
                    mv = room['votes'][str(m['id'])]
                    if all(v == 'like' for v in mv.values()):
                        room['winner'] = m
                        return self._json(200, {'ok': True, 'winner': m})

                if room['round'] == 1:
                    score = {}
                    for m in room['movies']:
                        mv = room['votes'][str(m['id'])]
                        weight = sum(1 if v == 'like' else -1 for v in mv.values())
                        for gid in m['genre_ids']:
                            score[gid] = score.get(gid, 0) + weight
                    top = sorted(score.items(), key=lambda x: x[1], reverse=True)[:3]
                    room['top_genre_ids'] = [x[0] for x in top]
                    room['top_genres'] = [room['genre_map'].get(x[0], str(x[0])) for x in top]

                room['round'] += 1
                room['movies'] = build_batch(room, room['round'])
                room['votes'] = {str(m['id']): {u: None for u in room['participants']} for m in room['movies']}
                return self._json(200, {'ok': True})

        except RuntimeError as e:
            return self._json(500, {'error': str(e)})
        except HTTPError as e:
            return self._json(502, {'error': f'TMDB error: {e.code}'})
        except Exception as e:
            return self._json(500, {'error': f'Internal error: {e}'})

        return self._json(404, {'error': 'Not found'})


if __name__ == '__main__':
    port = int(os.getenv('PORT', '4173'))
    httpd = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'Serving on http://0.0.0.0:{port}')
    httpd.serve_forever()

#!/usr/bin/env python3
import json
import os
import random
import string
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from urllib.request import urlopen, Request
from urllib.error import HTTPError

TMDB_API_KEY = os.getenv('TMDB_API_KEY')
TMDB_BASE = 'https://api.themoviedb.org/3'
IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'
ROOMS = {}


def room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def tmdb_get(path, params=None):
    if not TMDB_API_KEY:
        raise RuntimeError('TMDB_API_KEY is not set')
    params = params or {}
    params['api_key'] = TMDB_API_KEY
    query = '&'.join(f"{k}={str(v)}" for k, v in params.items())
    url = f"{TMDB_BASE}{path}?{query}"
    req = Request(url, headers={'Accept': 'application/json'})
    with urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch_top(page=1):
    data = tmdb_get('/movie/top_rated', {'language': 'ru-RU', 'page': page})
    return data.get('results', [])


def fetch_genres():
    data = tmdb_get('/genre/movie/list', {'language': 'ru-RU'})
    return {x['id']: x['name'] for x in data.get('genres', [])}


def fetch_by_genres(genre_ids, page=1):
    data = tmdb_get('/discover/movie', {
        'language': 'ru-RU',
        'sort_by': 'vote_count.desc',
        'vote_count.gte': 1000,
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
        gids = room['top_genre_ids'][:3] or []
        source = fetch_by_genres(gids, 1) + fetch_by_genres(gids, 2)
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


class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length', '0'))
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}')

    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith('/api/rooms/'):
            code = p.split('/')[3] if len(p.split('/')) > 3 else None
            room = ROOMS.get(code)
            if not room:
                return self._json(404, {'error': 'Комната не найдена'})
            public = {
                'code': code,
                'participants': room['participants'],
                'round': room['round'],
                'movies': room['movies'],
                'votes': room['votes'],
                'top_genres': room['top_genres'],
                'winner': room['winner'],
            }
            return self._json(200, public)
        return super().do_GET()

    def do_POST(self):
        p = urlparse(self.path).path
        try:
            if p == '/api/rooms':
                data = self._body()
                host = (data.get('hostName') or '').strip()
                if not host:
                    return self._json(400, {'error': 'Введите имя хоста'})
                code = room_code()
                genre_map = fetch_genres()
                ROOMS[code] = {
                    'participants': [host],
                    'round': 0,
                    'movies': [],
                    'votes': {},
                    'top_genres': [],
                    'top_genre_ids': [],
                    'winner': None,
                    'genre_map': genre_map,
                    'seen_ids': set(),
                }
                return self._json(200, {'code': code, 'host': host})

            if '/join' in p:
                code = p.split('/')[3]
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})
                nick = (self._body().get('nickname') or '').strip()
                if not nick:
                    return self._json(400, {'error': 'Введите ник'})
                if nick not in room['participants']:
                    room['participants'].append(nick)
                return self._json(200, {'ok': True, 'participants': room['participants']})

            if '/start' in p:
                code = p.split('/')[3]
                room = ROOMS.get(code)
                if not room:
                    return self._json(404, {'error': 'Комната не найдена'})
                room['round'] = 1
                room['winner'] = None
                room['movies'] = build_batch(room, 1)
                room['votes'] = {str(m['id']): {u: None for u in room['participants']} for m in room['movies']}
                return self._json(200, {'ok': True})

            if '/vote' in p:
                code = p.split('/')[3]
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

            if '/process' in p:
                code = p.split('/')[3]
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
                        w = sum(1 if v == 'like' else -1 for v in mv.values())
                        for gid in m['genre_ids']:
                            score[gid] = score.get(gid, 0) + w
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

const TMDB_API_KEY = '496c09dd473a5e1336d94efbe7609867';

// Заполните для многоустройственного режима: console.firebase.google.com
// Правила базы: { "rules": { ".read": true, ".write": true } }
const FIREBASE_CONFIG = null;

const roomInfo         = document.querySelector('#roomInfo');
const participantsList = document.querySelector('#participants');
const moviesBoard      = document.querySelector('#moviesBoard');
const roundInfo        = document.querySelector('#roundInfo');
const finalResult      = document.querySelector('#finalResult');
const qrResult         = document.querySelector('#qrResult');

const state = {
  roomCode: null,
  participants: [],
  round: 0,
  moviesPool: [],          // только на устройстве хоста, не идёт в Firebase
  currentMovies: [],
  votes: {},
  topGenres: [],
  winner: null,
  seenMovieIds: new Set(), // только на устройстве хоста
  memoryMode: false,
  role: null,              // 'host' | 'guest'
  myName: null,
  _syncing: false          // предотвращает circular write при Firebase-обновлении
};

const fallbackMovies = [
  { id: 1,  title: 'Побег из Шоушенка',                   year: 1994, rating: 9.3, genres: ['Драма'] },
  { id: 2,  title: 'Крёстный отец',                        year: 1972, rating: 9.2, genres: ['Драма', 'Криминал'] },
  { id: 3,  title: 'Тёмный рыцарь',                       year: 2008, rating: 9.0, genres: ['Боевик', 'Криминал', 'Драма'] },
  { id: 4,  title: 'Криминальное чтиво',                  year: 1994, rating: 8.9, genres: ['Криминал', 'Драма'] },
  { id: 5,  title: 'Форрест Гамп',                        year: 1994, rating: 8.8, genres: ['Драма', 'Мелодрама'] },
  { id: 6,  title: 'Начало',                              year: 2010, rating: 8.8, genres: ['Фантастика', 'Боевик', 'Триллер'] },
  { id: 7,  title: 'Интерстеллар',                        year: 2014, rating: 8.7, genres: ['Фантастика', 'Драма'] },
  { id: 8,  title: 'Матрица',                             year: 1999, rating: 8.7, genres: ['Фантастика', 'Боевик'] },
  { id: 9,  title: 'Бойцовский клуб',                     year: 1999, rating: 8.8, genres: ['Драма', 'Триллер'] },
  { id: 10, title: 'Властелин колец: Братство Кольца',    year: 2001, rating: 8.8, genres: ['Фэнтези', 'Приключения'] },
  { id: 11, title: 'Властелин колец: Две крепости',       year: 2002, rating: 8.8, genres: ['Фэнтези', 'Приключения'] },
  { id: 12, title: 'Властелин колец: Возвращение короля', year: 2003, rating: 9.0, genres: ['Фэнтези', 'Приключения'] },
  { id: 13, title: 'Одержимость',                         year: 2014, rating: 8.5, genres: ['Драма', 'Музыка'] },
  { id: 14, title: 'Остров проклятых',                    year: 2010, rating: 8.2, genres: ['Триллер', 'Детектив'] },
  { id: 15, title: 'Дюна: Часть вторая',                  year: 2024, rating: 8.6, genres: ['Фантастика', 'Приключения'] },
  { id: 16, title: 'Гладиатор',                           year: 2000, rating: 8.5, genres: ['Боевик', 'Драма'] },
  { id: 17, title: '1+1',                                 year: 2011, rating: 8.5, genres: ['Комедия', 'Драма'] },
  { id: 18, title: 'Достать ножи',                        year: 2019, rating: 7.9, genres: ['Детектив', 'Комедия'] },
  { id: 19, title: 'Безумный Макс: Дорога ярости',        year: 2015, rating: 8.1, genres: ['Боевик', 'Фантастика'] },
  { id: 20, title: 'Ла-Ла Ленд',                         year: 2016, rating: 8.0, genres: ['Мелодрама', 'Музыка'] }
];

state.moviesPool = [...fallbackMovies];

let db = null;

function initFirebase() {
  if (!FIREBASE_CONFIG || typeof firebase === 'undefined') return;
  if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  db = firebase.database();
}

// Firebase сериализует массивы в объекты {0:…, 1:…} при записи
function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function pushRoomState() {
  if (!db || !state.roomCode || state._syncing) return;
  db.ref(`/rooms/${state.roomCode}`).set({
    hostName:      state.participants[0] || '',
    participants:  state.participants,
    round:         state.round,
    status:        state.winner ? 'done' : (state.round > 0 ? 'voting' : 'lobby'),
    currentMovies: state.currentMovies,
    votes:         state.votes,
    topGenres:     state.topGenres,
    winner:        state.winner || null,
  });
}

function subscribeToRoom(code) {
  if (!db) return;
  db.ref(`/rooms/${code}`).on('value', (snap) => {
    const data = snap.val();
    if (!data) return;

    state._syncing = true;
    state.participants  = toArray(data.participants);
    state.round         = data.round || 0;
    state.currentMovies = toArray(data.currentMovies);
    state.votes         = data.votes || {};
    state.topGenres     = toArray(data.topGenres);

    renderParticipants();

    if (data.status === 'voting' && state.currentMovies.length) {
      renderBoard();
      updateProcessBtn();
    }
    if (data.status === 'done' && data.winner) {
      state.winner = data.winner;
      renderFinal(data.winner);
    }

    state._syncing = false;
  });
}

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function renderParticipants() {
  participantsList.innerHTML = '';
  state.participants.forEach((name, idx) => {
    const li = document.createElement('li');
    li.textContent = `${name}${idx === 0 ? ' (хост)' : ''}`;
    participantsList.appendChild(li);
  });
}

function createRoom() {
  const hostName = document.querySelector('#hostName').value.trim();
  if (!hostName) { roomInfo.textContent = 'Введите имя хоста.'; return; }

  state.roomCode = generateCode();
  state.participants = [hostName];
  state.myName  = hostName;
  state.role    = 'host';
  state.round   = 0;
  state.topGenres = [];
  state.winner  = null;
  state.seenMovieIds.clear();

  roomInfo.textContent = `Комната ${state.roomCode} создана.`;
  renderParticipants();
  resetVotingArea();
  renderShareSection();
  subscribeToRoom(state.roomCode);
  pushRoomState();
}

function joinGuest() {
  if (!state.roomCode) { roomInfo.textContent = 'Сначала создайте комнату.'; return; }
  const guestInput = document.querySelector('#guestName');
  const guest = guestInput.value.trim();
  if (!guest) return;
  if (state.participants.includes(guest)) { roomInfo.textContent = `${guest} уже в комнате.`; return; }
  state.participants.push(guest);
  guestInput.value = '';
  renderParticipants();
  pushRoomState();
}

function guestJoin() {
  const codeInput = document.querySelector('#joinRoomCode');
  const nameInput = document.querySelector('#joinGuestName');
  const info      = document.querySelector('#guestJoinInfo');
  const code = codeInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  if (!code || !name) { info.textContent = 'Введите код комнаты и ваше имя.'; return; }

  if (!db) {
    info.textContent = 'Firebase не настроен. Попросите хоста добавить вас через кнопку «Присоединиться».';
    return;
  }

  info.textContent = 'Подключаемся...';

  db.ref(`/rooms/${code}`).once('value', (snap) => {
    const data = snap.val();
    if (!data) { info.textContent = 'Комната не найдена. Проверьте код.'; return; }

    if (data.status === 'voting') {
      info.textContent = 'Голосование уже идёт. Попросите хоста создать новую комнату.';
      return;
    }

    state.roomCode = code;
    state.role     = 'guest';
    state.myName   = name;

    const participants = toArray(data.participants);
    if (!participants.includes(name)) {
      participants.push(name);
      db.ref(`/rooms/${code}/participants`).set(participants);
    }

    document.querySelector('#section-room').classList.add('hidden');
    const welcome = document.querySelector('#guestWelcome');
    welcome.textContent = `Вы в комнате ${code} как «${name}». Дождитесь, пока хост начнёт голосование.`;
    welcome.classList.remove('hidden');

    subscribeToRoom(code);
    info.textContent = '';
  });
}

function resetVotingArea() {
  moviesBoard.innerHTML = '';
  document.querySelector('#nextRoundBtn').classList.add('hidden');
  roundInfo.textContent = 'Создайте комнату и добавьте участников, затем начните голосование.';
  finalResult.textContent = 'Пока финальный фильм не выбран.';
  finalResult.className = 'result-empty';
  qrResult.innerHTML = '';
}

function renderShareSection() {
  const section = document.querySelector('#shareSection');
  section.classList.remove('hidden');
  document.querySelector('#shareRoomCode').textContent = state.roomCode;

  if (db) {
    const joinUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(joinUrl)}`;
    document.querySelector('#shareQr').innerHTML = `<img src="${qrSrc}" alt="QR для входа" />`;
  } else {
    document.querySelector('#shareQr').innerHTML =
      '<p class="hint">Firebase не настроен — передайте код голосом.</p>';
  }
}

function getNextBatch() {
  let candidates = state.moviesPool.filter((m) => !state.seenMovieIds.has(m.id));

  if (state.round > 1 && state.topGenres.length) {
    candidates = candidates
      .map((movie) => {
        const score = movie.genres.reduce((acc, g) => {
          const pos = state.topGenres.indexOf(g);
          return pos >= 0 ? acc + (3 - pos) : acc;
        }, 0);
        return { movie, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.movie.rating - a.movie.rating)
      .map((x) => x.movie);
  }

  return candidates.slice(0, 3);
}

function initVotes(batch) {
  state.votes = {};
  batch.forEach((movie) => {
    state.votes[movie.id] = {};
    state.participants.forEach((p) => {
      state.votes[movie.id][p] = 'none'; // Firebase удаляет null-узлы, используем строку
    });
  });
}

function updateProcessBtn() {
  const btn = document.querySelector('#nextRoundBtn');
  if (btn.classList.contains('hidden')) return;
  if (state.role === 'guest') { btn.classList.add('hidden'); return; }

  const total = state.currentMovies.length * state.participants.length;
  const filled = state.currentMovies.reduce((acc, movie) => {
    const v = state.votes[movie.id] || {};
    return acc + Object.values(v).filter((x) => x === 'like' || x === 'dislike').length;
  }, 0);
  const ready = filled === total;

  btn.disabled = !ready;
  btn.textContent = ready
    ? 'Обработать раунд →'
    : `Обработать раунд (${filled} / ${total} голосов)`;
  btn.classList.toggle('btn--ready', ready);
}

function vote(movieId, participant, value) {
  if (!state.votes[movieId]) state.votes[movieId] = {};
  state.votes[movieId][participant] = value;

  // Гость пишет свой голос точечно, минуя pushRoomState
  if (db && state.roomCode) {
    db.ref(`/rooms/${state.roomCode}/votes/${movieId}/${participant}`).set(value);
  }

  renderBoard();
  updateProcessBtn();
}

function renderBoard() {
  moviesBoard.innerHTML = '';

  state.currentMovies.forEach((movie) => {
    const article = document.createElement('article');
    article.className = 'card';

    const movieVotes = state.votes[movie.id] || {};
    const likes    = Object.values(movieVotes).filter((v) => v === 'like').length;
    const dislikes = Object.values(movieVotes).filter((v) => v === 'dislike').length;

    // Гость видит только свою строку, хост — всех
    const visible = state.role === 'guest'
      ? state.participants.filter((p) => p === state.myName)
      : state.participants;

    const votersMarkup = visible.map((participant) => {
      const current = movieVotes[participant];
      return `
        <div class="voter-row">
          <span>${participant}</span>
          <div class="vote-buttons">
            <button class="small-btn ${current === 'like'    ? 'active-like'    : ''}"
              data-movie="${movie.id}" data-user="${participant}" data-v="like">👍</button>
            <button class="small-btn ${current === 'dislike' ? 'active-dislike' : ''}"
              data-movie="${movie.id}" data-user="${participant}" data-v="dislike">👎</button>
          </div>
        </div>`;
    }).join('');

    article.innerHTML = `
      <h3>${movie.title} (${movie.year})</h3>
      <p class="hint">Рейтинг: ${movie.rating} • Жанры: ${movie.genres.join(', ')}</p>
      <p class="vote">👍 ${likes} &nbsp; 👎 ${dislikes}</p>
      ${votersMarkup}
    `;

    moviesBoard.appendChild(article);
  });

  moviesBoard.querySelectorAll('.small-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      vote(Number(btn.dataset.movie), btn.dataset.user, btn.dataset.v);
    });
  });
}

function allVotesFilled() {
  return state.currentMovies.every((movie) =>
    state.participants.every((p) => {
      const v = (state.votes[movie.id] || {})[p];
      return v === 'like' || v === 'dislike';
    })
  );
}

function computeTopGenresFromFirstRound() {
  const genreScore = {};
  state.currentMovies.forEach((movie) => {
    const votes    = Object.values(state.votes[movie.id] || {});
    const likes    = votes.filter((v) => v === 'like').length;
    const dislikes = votes.filter((v) => v === 'dislike').length;
    const weight   = likes - dislikes;
    movie.genres.forEach((genre) => {
      genreScore[genre] = (genreScore[genre] || 0) + weight;
    });
  });

  state.topGenres = Object.entries(genreScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);
}

function findUnanimousMovie() {
  return state.currentMovies.find((movie) =>
    state.participants.every((p) => (state.votes[movie.id] || {})[p] === 'like')
  );
}

function saveWinner(movie) {
  const winners = loadWinners();
  if (!winners.find((w) => w.id === movie.id)) {
    winners.push(movie);
    localStorage.setItem('partymaker_winners', JSON.stringify(winners));
  }
  updateWinnersCount();
}

function loadWinners() {
  try { return JSON.parse(localStorage.getItem('partymaker_winners') || '[]'); }
  catch { return []; }
}

function updateWinnersCount() {
  const count = loadWinners().length;
  document.querySelector('#winnersCount').textContent =
    count > 0 ? `(в архиве: ${count})` : '(архив пуст)';
  document.querySelector('#clearWinnersBtn').classList.toggle('hidden', count === 0);
}

function clearWinners() {
  if (!confirm(`Удалить все ${loadWinners().length} фильм(а) из архива?`)) return;
  localStorage.removeItem('partymaker_winners');
  updateWinnersCount();
}

// Чистый рендер финала — вызывается и локально, и из Firebase-слушателя
function renderFinal(movie) {
  finalResult.className = 'result-win';
  finalResult.innerHTML = `
    <h3>🎉 Все выбрали один фильм</h3>
    <p><strong>${movie.title} (${movie.year})</strong></p>
    <p>Жанры: ${movie.genres.join(', ')} • Рейтинг: ${movie.rating}</p>
  `;
  const tmdbUrl = movie.url
    || `https://www.themoviedb.org/search?query=${encodeURIComponent(movie.title)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(tmdbUrl)}`;
  qrResult.innerHTML = `
    <p class="hint">Отсканируйте QR, чтобы открыть фильм на TMDB.</p>
    <img src="${qrSrc}" alt="QR код итогового фильма" />
  `;
  roundInfo.textContent = 'Голосование завершено: найден фильм с единогласным лайком.';
  document.querySelector('#nextRoundBtn').classList.add('hidden');
}

function showFinal(movie) {
  state.winner = movie;
  saveWinner(movie);
  renderFinal(movie);
  pushRoomState();
}

function startVoting() {
  if (!state.roomCode || state.participants.length < 2) {
    roundInfo.textContent = 'Нужны созданная комната и минимум 2 участника (хост + гость).';
    return;
  }

  if (state.memoryMode) {
    const winners = loadWinners();
    if (!winners.length) {
      roundInfo.textContent = 'Нет сохранённых победителей. Сначала проведите обычное голосование.';
      return;
    }
    state.moviesPool = winners;
  }

  state.round = 1;
  state.currentMovies = state.moviesPool.slice(0, 3);
  state.currentMovies.forEach((m) => state.seenMovieIds.add(m.id));
  initVotes(state.currentMovies);

  roundInfo.textContent = state.memoryMode
    ? 'Раунд 1: оцените фильмы из архива прошлых победителей.'
    : 'Раунд 1: оцените первые 3 фильма из топа.';

  const btn = document.querySelector('#nextRoundBtn');
  btn.classList.remove('hidden');
  btn.disabled = true;
  btn.textContent = `Обработать раунд (0 / ${state.currentMovies.length * state.participants.length} голосов)`;
  btn.classList.remove('btn--ready');
  renderBoard();
  pushRoomState();
}

function processRound() {
  if (!allVotesFilled()) {
    roundInfo.textContent = 'Каждый участник должен проголосовать по всем фильмам.';
    return;
  }

  const unanimous = findUnanimousMovie();
  if (unanimous) { showFinal(unanimous); return; }

  if (state.round === 1) computeTopGenresFromFirstRound();

  state.round += 1;
  const nextBatch = getNextBatch();

  if (!nextBatch.length) {
    roundInfo.textContent = 'Фильмы закончились до единогласия.';
    document.querySelector('#nextRoundBtn').classList.add('hidden');
    pushRoomState();
    return;
  }

  state.currentMovies = nextBatch;
  state.currentMovies.forEach((m) => state.seenMovieIds.add(m.id));
  initVotes(nextBatch);

  const genresText = state.topGenres.length ? ` Топ-3 жанра: ${state.topGenres.join(', ')}.` : '';
  roundInfo.textContent = `Раунд ${state.round}:${genresText} Оцените следующие 3 фильма.`;
  renderBoard();
  updateProcessBtn();
  pushRoomState();
}

async function loadMoviesFromTMDB() {
  const base   = 'https://api.themoviedb.org/3';
  const params = `api_key=${TMDB_API_KEY}&language=ru-RU`;

  const [genresData, ...pages] = await Promise.all([
    fetch(`${base}/genre/movie/list?${params}`).then((r) => r.json()),
    fetch(`${base}/movie/top_rated?${params}&page=1`).then((r) => r.json()),
    fetch(`${base}/movie/top_rated?${params}&page=2`).then((r) => r.json()),
    fetch(`${base}/movie/top_rated?${params}&page=3`).then((r) => r.json()),
  ]);

  const genreMap = Object.fromEntries(genresData.genres.map((g) => [g.id, g.name]));

  return pages
    .flatMap((d) => d.results)
    .filter((m) => m.vote_count > 500 && m.release_date)
    .map((m) => ({
      id:     m.id,
      title:  m.title,
      year:   parseInt(m.release_date),
      rating: Math.round(m.vote_average * 10) / 10,
      genres: m.genre_ids.map((id) => genreMap[id]).filter(Boolean).slice(0, 3),
      url:    `https://www.themoviedb.org/movie/${m.id}`,
    }))
    .filter((m) => m.genres.length > 0);
}

async function initApp() {
  initFirebase();

  // Если гость открыл ссылку ?room=CODE — предзаполняем поле и открываем таб гостя
  const roomParam = new URLSearchParams(window.location.search).get('room');
  if (roomParam) {
    document.querySelector('#joinRoomCode').value = roomParam.toUpperCase();
    switchTab('guest');
  }

  updateWinnersCount();

  if (!TMDB_API_KEY) return;

  const startBtn = document.querySelector('#startVotingBtn');
  startBtn.disabled = true;
  roundInfo.textContent = 'Загружаем фильмы с TMDB...';

  try {
    state.moviesPool = await loadMoviesFromTMDB();
    roundInfo.textContent = `Загружено ${state.moviesPool.length} фильмов с TMDB. Создайте комнату и добавьте участников.`;
  } catch (err) {
    console.error('TMDB:', err);
    roundInfo.textContent = 'Не удалось загрузить TMDB — используются локальные фильмы.';
  } finally {
    startBtn.disabled = false;
  }
}

function switchTab(tab) {
  document.querySelector('#tabHost').classList.toggle('tab--active', tab === 'host');
  document.querySelector('#tabGuest').classList.toggle('tab--active', tab === 'guest');
  document.querySelector('#hostForm').classList.toggle('hidden',  tab !== 'host');
  document.querySelector('#guestForm').classList.toggle('hidden', tab !== 'guest');
}

document.querySelector('#createRoomBtn').addEventListener('click', createRoom);
document.querySelector('#joinBtn').addEventListener('click', joinGuest);
document.querySelector('#startVotingBtn').addEventListener('click', startVoting);
document.querySelector('#nextRoundBtn').addEventListener('click', processRound);
document.querySelector('#guestJoinBtn').addEventListener('click', guestJoin);
document.querySelector('#tabHost').addEventListener('click', () => switchTab('host'));
document.querySelector('#tabGuest').addEventListener('click', () => switchTab('guest'));

document.querySelector('#hostName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') createRoom();
});
document.querySelector('#guestName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinGuest();
});
document.querySelector('#joinRoomCode').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.querySelector('#joinGuestName').focus();
});
document.querySelector('#joinGuestName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') guestJoin();
});
document.querySelector('#memoryModeToggle').addEventListener('change', (e) => {
  state.memoryMode = e.target.checked;
});
document.querySelector('#clearWinnersBtn').addEventListener('click', clearWinners);

initApp();

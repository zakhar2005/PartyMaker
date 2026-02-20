const roomInfo = document.querySelector('#roomInfo');
const participantsList = document.querySelector('#participants');
const moviesBoard = document.querySelector('#moviesBoard');
const roundInfo = document.querySelector('#roundInfo');
const finalResult = document.querySelector('#finalResult');
const qrResult = document.querySelector('#qrResult');

const state = {
  roomCode: null,
  participants: [],
  round: 0,
  moviesPool: [],
  currentMovies: [],
  votes: {},
  topGenres: [],
  winner: null,
  seenMovieIds: new Set()
};

const topMovies = [
  { id: 1, title: 'Побег из Шоушенка', year: 1994, rating: 9.3, genres: ['Драма'] },
  { id: 2, title: 'Крёстный отец', year: 1972, rating: 9.2, genres: ['Драма', 'Криминал'] },
  { id: 3, title: 'Тёмный рыцарь', year: 2008, rating: 9.0, genres: ['Боевик', 'Криминал', 'Драма'] },
  { id: 4, title: 'Криминальное чтиво', year: 1994, rating: 8.9, genres: ['Криминал', 'Драма'] },
  { id: 5, title: 'Форрест Гамп', year: 1994, rating: 8.8, genres: ['Драма', 'Мелодрама'] },
  { id: 6, title: 'Начало', year: 2010, rating: 8.8, genres: ['Фантастика', 'Боевик', 'Триллер'] },
  { id: 7, title: 'Интерстеллар', year: 2014, rating: 8.7, genres: ['Фантастика', 'Драма'] },
  { id: 8, title: 'Матрица', year: 1999, rating: 8.7, genres: ['Фантастика', 'Боевик'] },
  { id: 9, title: 'Бойцовский клуб', year: 1999, rating: 8.8, genres: ['Драма', 'Триллер'] },
  { id: 10, title: 'Властелин колец: Братство Кольца', year: 2001, rating: 8.8, genres: ['Фэнтези', 'Приключения'] },
  { id: 11, title: 'Властелин колец: Две крепости', year: 2002, rating: 8.8, genres: ['Фэнтези', 'Приключения'] },
  { id: 12, title: 'Властелин колец: Возвращение короля', year: 2003, rating: 9.0, genres: ['Фэнтези', 'Приключения'] },
  { id: 13, title: 'Одержимость', year: 2014, rating: 8.5, genres: ['Драма', 'Музыка'] },
  { id: 14, title: 'Остров проклятых', year: 2010, rating: 8.2, genres: ['Триллер', 'Детектив'] },
  { id: 15, title: 'Дюна: Часть вторая', year: 2024, rating: 8.6, genres: ['Фантастика', 'Приключения'] },
  { id: 16, title: 'Гладиатор', year: 2000, rating: 8.5, genres: ['Боевик', 'Драма'] },
  { id: 17, title: '1+1', year: 2011, rating: 8.5, genres: ['Комедия', 'Драма'] },
  { id: 18, title: 'Достать ножи', year: 2019, rating: 7.9, genres: ['Детектив', 'Комедия'] },
  { id: 19, title: 'Безумный Макс: Дорога ярости', year: 2015, rating: 8.1, genres: ['Боевик', 'Фантастика'] },
  { id: 20, title: 'Ла-Ла Ленд', year: 2016, rating: 8.0, genres: ['Мелодрама', 'Музыка'] }
];

state.moviesPool = [...topMovies];

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
  if (!hostName) {
    roomInfo.textContent = 'Введите имя хоста.';
    return;
  }

  state.roomCode = generateCode();
  state.participants = [hostName];
  state.round = 0;
  state.topGenres = [];
  state.winner = null;
  state.seenMovieIds.clear();
  roomInfo.textContent = `Комната ${state.roomCode} создана. Отправьте код гостям.`;
  renderParticipants();
  resetVotingArea();
}

function joinGuest() {
  if (!state.roomCode) {
    roomInfo.textContent = 'Сначала создайте комнату.';
    return;
  }

  const guestInput = document.querySelector('#guestName');
  const guest = guestInput.value.trim();
  if (!guest) return;
  if (state.participants.includes(guest)) {
    roomInfo.textContent = `Участник ${guest} уже в комнате.`;
    return;
  }

  state.participants.push(guest);
  guestInput.value = '';
  renderParticipants();
}

function resetVotingArea() {
  moviesBoard.innerHTML = '';
  document.querySelector('#nextRoundBtn').classList.add('hidden');
  roundInfo.textContent = 'Создайте комнату и добавьте участников, затем начните голосование.';
  finalResult.textContent = 'Пока финальный фильм не выбран.';
  finalResult.className = 'result-empty';
  qrResult.innerHTML = '';
}

function getNextBatch() {
  let candidates = state.moviesPool.filter((m) => !state.seenMovieIds.has(m.id));

  if (state.round > 1 && state.topGenres.length) {
    candidates = candidates
      .map((movie) => {
        const score = movie.genres.reduce((acc, g, idx) => {
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
    state.participants.forEach((participant) => {
      state.votes[movie.id][participant] = null;
    });
  });
}

function vote(movieId, participant, value) {
  state.votes[movieId][participant] = value;
  renderBoard();
}

function renderBoard() {
  moviesBoard.innerHTML = '';

  state.currentMovies.forEach((movie) => {
    const article = document.createElement('article');
    article.className = 'card';

    const votesSummary = Object.values(state.votes[movie.id]);
    const likes = votesSummary.filter((v) => v === 'like').length;
    const dislikes = votesSummary.filter((v) => v === 'dislike').length;

    const votersMarkup = state.participants
      .map((participant) => {
        const current = state.votes[movie.id][participant];
        return `
          <div class="voter-row">
            <span>${participant}</span>
            <div class="vote-buttons">
              <button class="small-btn ${current === 'like' ? 'active-like' : ''}" data-movie="${movie.id}" data-user="${participant}" data-v="like">👍</button>
              <button class="small-btn ${current === 'dislike' ? 'active-dislike' : ''}" data-movie="${movie.id}" data-user="${participant}" data-v="dislike">👎</button>
            </div>
          </div>
        `;
      })
      .join('');

    article.innerHTML = `
      <h3>${movie.title} (${movie.year})</h3>
      <p class="hint">Рейтинг: ${movie.rating} • Жанры: ${movie.genres.join(', ')}</p>
      <p class="vote">Лайки: ${likes} • Дизлайки: ${dislikes}</p>
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
    state.participants.every((p) => state.votes[movie.id][p] !== null)
  );
}

function computeTopGenresFromFirstRound() {
  const genreScore = {};
  state.currentMovies.forEach((movie) => {
    const likes = Object.values(state.votes[movie.id]).filter((v) => v === 'like').length;
    const dislikes = Object.values(state.votes[movie.id]).filter((v) => v === 'dislike').length;
    const weight = likes - dislikes;

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
    state.participants.every((p) => state.votes[movie.id][p] === 'like')
  );
}

function showFinal(movie) {
  state.winner = movie;
  finalResult.className = 'result-win';
  finalResult.innerHTML = `
    <h3>🎉 Все выбрали один фильм</h3>
    <p><strong>${movie.title} (${movie.year})</strong></p>
    <p>Жанры: ${movie.genres.join(', ')} • Рейтинг: ${movie.rating}</p>
  `;

  const payload = {
    title: movie.title,
    date: String(movie.year),
    movie_link: `https://www.themoviedb.org/search?query=${encodeURIComponent(movie.title)}`
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(JSON.stringify(payload))}`;
  qrResult.innerHTML = `
    <p class="hint">QR содержит итоговый фильм и ссылку для просмотра информации.</p>
    <img src="${qrSrc}" alt="QR код итогового фильма" />
  `;

  roundInfo.textContent = 'Голосование завершено: найден фильм с единогласным лайком.';
  document.querySelector('#nextRoundBtn').classList.add('hidden');
}

function startVoting() {
  if (!state.roomCode || state.participants.length < 2) {
    roundInfo.textContent = 'Нужны созданная комната и минимум 2 участника (хост + гость).';
    return;
  }

  state.round = 1;
  state.currentMovies = state.moviesPool.slice(0, 3);
  state.currentMovies.forEach((m) => state.seenMovieIds.add(m.id));
  initVotes(state.currentMovies);

  roundInfo.textContent = `Раунд 1: оцените первые 3 фильма из топа.`;
  document.querySelector('#nextRoundBtn').classList.remove('hidden');
  renderBoard();
}

function processRound() {
  if (!allVotesFilled()) {
    roundInfo.textContent = 'Нужно, чтобы каждый участник проголосовал по всем 3 фильмам.';
    return;
  }

  const unanimous = findUnanimousMovie();
  if (unanimous) {
    showFinal(unanimous);
    return;
  }

  if (state.round === 1) {
    computeTopGenresFromFirstRound();
  }

  state.round += 1;
  const nextBatch = getNextBatch();

  if (!nextBatch.length) {
    roundInfo.textContent = 'Фильмы закончились до единогласия. Добавьте больше фильмов в топ-список.';
    document.querySelector('#nextRoundBtn').classList.add('hidden');
    return;
  }

  state.currentMovies = nextBatch;
  state.currentMovies.forEach((m) => state.seenMovieIds.add(m.id));
  initVotes(nextBatch);

  const genresText = state.topGenres.length ? ` Топ-3 жанра: ${state.topGenres.join(', ')}.` : '';
  roundInfo.textContent = `Раунд ${state.round}:${genresText} Оцените следующие 3 фильма.`;
  renderBoard();
}

document.querySelector('#createRoomBtn').addEventListener('click', createRoom);
document.querySelector('#joinBtn').addEventListener('click', joinGuest);
document.querySelector('#startVotingBtn').addEventListener('click', startVoting);
document.querySelector('#nextRoundBtn').addEventListener('click', processRound);

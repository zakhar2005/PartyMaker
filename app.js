const roomInfo = document.querySelector('#roomInfo');
const participantsList = document.querySelector('#participants');
const moviesBoard = document.querySelector('#moviesBoard');
const roundInfo = document.querySelector('#roundInfo');
const finalResult = document.querySelector('#finalResult');
const qrResult = document.querySelector('#qrResult');
const roomQr = document.querySelector('#roomQr');
const joinHint = document.querySelector('#joinHint');
const joinLinkText = document.querySelector('#joinLinkText');

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
  { id: 1, title: 'Побег из Шоушенка', year: 1994, rating: 9.3, genres: ['Драма'], overview: 'Банкир ошибочно получает пожизненный срок и находит путь к надежде в тюрьме Шоушенк.', poster: 'https://image.tmdb.org/t/p/w342/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg' },
  { id: 2, title: 'Крёстный отец', year: 1972, rating: 9.2, genres: ['Драма', 'Криминал'], overview: 'История семьи Корлеоне и передачи власти от старого дона к сыну Майклу.', poster: 'https://image.tmdb.org/t/p/w342/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
  { id: 3, title: 'Тёмный рыцарь', year: 2008, rating: 9.0, genres: ['Боевик', 'Криминал', 'Драма'], overview: 'Бэтмен сталкивается с Джокером, который погружает Готэм в хаос.', poster: 'https://image.tmdb.org/t/p/w342/qJ2tW6WMUDux911r6m7haRef0WH.jpg' },
  { id: 4, title: 'Криминальное чтиво', year: 1994, rating: 8.9, genres: ['Криминал', 'Драма'], overview: 'Несколько переплетённых криминальных историй в Лос-Анджелесе.', poster: 'https://image.tmdb.org/t/p/w342/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg' },
  { id: 5, title: 'Форрест Гамп', year: 1994, rating: 8.8, genres: ['Драма', 'Мелодрама'], overview: 'Наивный Форрест становится свидетелем ключевых событий американской истории.', poster: 'https://image.tmdb.org/t/p/w342/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg' },
  { id: 6, title: 'Начало', year: 2010, rating: 8.8, genres: ['Фантастика', 'Боевик', 'Триллер'], overview: 'Команда специалистов проникает в сны, чтобы внедрить идею в подсознание.', poster: 'https://image.tmdb.org/t/p/w342/8IB2e4r4oVhHnANbnm7O3Tj6tF8.jpg' },
  { id: 7, title: 'Интерстеллар', year: 2014, rating: 8.7, genres: ['Фантастика', 'Драма'], overview: 'Астронавты отправляются через червоточину, чтобы спасти человечество.', poster: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
  { id: 8, title: 'Матрица', year: 1999, rating: 8.7, genres: ['Фантастика', 'Боевик'], overview: 'Хакер Нео узнаёт, что его мир — симуляция, и вступает в сопротивление.', poster: 'https://image.tmdb.org/t/p/w342/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' },
  { id: 9, title: 'Бойцовский клуб', year: 1999, rating: 8.8, genres: ['Драма', 'Триллер'], overview: 'Офисный работник создаёт подпольный клуб, который выходит из-под контроля.', poster: 'https://image.tmdb.org/t/p/w342/bptfVGEQuv6vDTIMVCHjJ9Dz8PX.jpg' },
  { id: 10, title: 'Властелин колец: Братство Кольца', year: 2001, rating: 8.8, genres: ['Фэнтези', 'Приключения'], overview: 'Фродо отправляется в опасное путешествие, чтобы уничтожить Кольцо Всевластия.', poster: 'https://image.tmdb.org/t/p/w342/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg' },
  { id: 11, title: 'Властелин колец: Две крепости', year: 2002, rating: 8.8, genres: ['Фэнтези', 'Приключения'], overview: 'Братство разделено, а силы Саурона усиливаются перед решающей битвой.', poster: 'https://image.tmdb.org/t/p/w342/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg' },
  { id: 12, title: 'Властелин колец: Возвращение короля', year: 2003, rating: 9.0, genres: ['Фэнтези', 'Приключения'], overview: 'Последняя битва за Средиземье и путь Фродо к Роковой горе.', poster: 'https://image.tmdb.org/t/p/w342/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg' },
  { id: 13, title: 'Одержимость', year: 2014, rating: 8.5, genres: ['Драма', 'Музыка'], overview: 'Молодой барабанщик сталкивается с жестким преподавателем ради совершенства.', poster: 'https://image.tmdb.org/t/p/w342/6uSPcdGNA2A6vJmCagXkvnutegs.jpg' },
  { id: 14, title: 'Остров проклятых', year: 2010, rating: 8.2, genres: ['Триллер', 'Детектив'], overview: 'Детектив расследует исчезновение пациентки в психиатрической клинике на острове.', poster: 'https://image.tmdb.org/t/p/w342/4GDy0PHYX3VRXUtwK5ysFbg3kEx.jpg' },
  { id: 15, title: 'Дюна: Часть вторая', year: 2024, rating: 8.6, genres: ['Фантастика', 'Приключения'], overview: 'Пол Атрейдес объединяется с фрименами и вступает в войну за судьбу Арракиса.', poster: 'https://image.tmdb.org/t/p/w342/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg' },
  { id: 16, title: 'Гладиатор', year: 2000, rating: 8.5, genres: ['Боевик', 'Драма'], overview: 'Римский генерал становится гладиатором и ищет месть за убийство семьи.', poster: 'https://image.tmdb.org/t/p/w342/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg' },
  { id: 17, title: '1+1', year: 2011, rating: 8.5, genres: ['Комедия', 'Драма'], overview: 'Необычная дружба парализованного аристократа и его помощника меняет их жизни.', poster: 'https://image.tmdb.org/t/p/w342/323BP0itpxTsO0skTwdnVmf7YC9.jpg' },
  { id: 18, title: 'Достать ножи', year: 2019, rating: 7.9, genres: ['Детектив', 'Комедия'], overview: 'Частный детектив расследует загадочную смерть главы эксцентричной семьи.', poster: 'https://image.tmdb.org/t/p/w342/pThyQovXQrw2m0s9x82twj48Jq4.jpg' },
  { id: 19, title: 'Безумный Макс: Дорога ярости', year: 2015, rating: 8.1, genres: ['Боевик', 'Фантастика'], overview: 'Погоня через пустошь за свободой в постапокалиптическом мире.', poster: 'https://image.tmdb.org/t/p/w342/hA2ple9q4qnwxp3hKVNhroipsir.jpg' },
  { id: 20, title: 'Ла-Ла Ленд', year: 2016, rating: 8.0, genres: ['Мелодрама', 'Музыка'], overview: 'Музыкант и актриса строят отношения между мечтой и реальностью в Лос-Анджелесе.', poster: 'https://image.tmdb.org/t/p/w342/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg' }
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

function getRoomJoinLink(code) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}

function renderRoomQr(code) {
  const joinUrl = getRoomJoinLink(code);
  joinHint.textContent = 'Гость сканирует QR и открывает ссылку комнаты на телефоне.';
  joinLinkText.innerHTML = `<a href="${joinUrl}" target="_blank" rel="noopener">${joinUrl}</a>`;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;
  roomQr.innerHTML = `<img src="${qrSrc}" alt="QR для входа в комнату" />`;
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

  roomInfo.textContent = `Комната ${state.roomCode} создана. Покажите QR гостям.`;
  renderRoomQr(state.roomCode);
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
      <div class="movie-head">
        <img src="${movie.poster}" alt="Постер: ${movie.title}" class="poster" />
        <div>
          <h3>${movie.title} (${movie.year})</h3>
          <p class="hint">Рейтинг: ${movie.rating} • Жанры: ${movie.genres.join(', ')}</p>
          <p class="overview">${movie.overview}</p>
        </div>
      </div>
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
    <p>${movie.overview}</p>
  `;

  const payload = {
    title: movie.title,
    date: String(movie.year),
    movie_link: `https://www.themoviedb.org/search?query=${encodeURIComponent(movie.title)}`
  };

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(JSON.stringify(payload))}`;
  qrResult.innerHTML = `
    <p class="hint">QR содержит итоговый фильм и ссылку на страницу с информацией.</p>
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

  roundInfo.textContent = 'Раунд 1: оцените первые 3 фильма из топа.';
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
    roundInfo.textContent = 'Фильмы закончились до единогласия. Добавьте больше фильмов в пул.';
    document.querySelector('#nextRoundBtn').classList.add('hidden');
    return;
  }

  state.currentMovies = nextBatch;
  state.currentMovies.forEach((m) => state.seenMovieIds.add(m.id));
  initVotes(nextBatch);

  const genresText = state.topGenres.length ? ` Топ-3 жанра: ${state.topGenres.join(', ')}.` : '';
  roundInfo.textContent = `Раунд ${state.round}.${genresText} Оцените следующие 3 фильма.`;
  renderBoard();
}

function initFromRoomLink() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  if (room) {
    state.roomCode = room;
    roomInfo.textContent = `Открыта ссылка комнаты ${room}. Введите имя и нажмите «Присоединиться».`;
    joinHint.textContent = 'Вы открыли комнату по QR-ссылке.';
    joinLinkText.textContent = '';
  }
}

document.querySelector('#createRoomBtn').addEventListener('click', createRoom);
document.querySelector('#joinBtn').addEventListener('click', joinGuest);
document.querySelector('#startVotingBtn').addEventListener('click', startVoting);
document.querySelector('#nextRoundBtn').addEventListener('click', processRound);

initFromRoomLink();

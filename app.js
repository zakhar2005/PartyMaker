const roomResult = document.querySelector('#roomResult');
const recommendations = document.querySelector('#recommendations');
const qrResult = document.querySelector('#qrResult');

const fallbackMovies = [
  { title: 'Дюна: Часть вторая', genre: 'Фантастика', director: 'Дени Вильнёв' },
  { title: 'Бегущий по лезвию 2049', genre: 'Фантастика', director: 'Дени Вильнёв' },
  { title: 'Достать ножи', genre: 'Детектив', director: 'Райан Джонсон' },
  { title: 'Остров проклятых', genre: 'Триллер', director: 'Мартин Скорсезе' }
];

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

document.querySelector('#createRoomBtn').addEventListener('click', () => {
  const host = document.querySelector('#hostName').value.trim() || 'Организатор';
  const code = roomCode();
  roomResult.textContent = `Комната создана: ${code}. Поделитесь кодом с друзьями. Хост: ${host}.`;
});

document.querySelector('#recommendBtn').addEventListener('click', () => {
  const favorites = ['#fav1', '#fav2', '#fav3']
    .map((id) => document.querySelector(id).value.trim())
    .filter(Boolean);

  recommendations.innerHTML = '';

  fallbackMovies
    .slice(0, favorites.length ? 3 : 2)
    .forEach((movie, index) => {
      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <h3>${movie.title}</h3>
        <div>${movie.genre} • ${movie.director}</div>
        <div class="vote">Голоса: ${Math.floor(Math.random() * 4) + 1}/4</div>
      `;
      recommendations.appendChild(card);
    });

  if (!favorites.length) {
    const warn = document.createElement('p');
    warn.className = 'hint';
    warn.textContent = 'Добавьте любимые фильмы, чтобы персонализировать рекомендации.';
    recommendations.appendChild(warn);
  }
});

document.querySelector('#qrBtn').addEventListener('click', () => {
  const title = document.querySelector('#title').value.trim();
  const date = document.querySelector('#date').value.trim();
  const movieLink = document.querySelector('#movieLink').value.trim();

  if (!title || !movieLink) {
    qrResult.innerHTML = '<p class="hint">Заполните обязательные поля: название и ссылка.</p>';
    return;
  }

  const payload = {
    title,
    date: date || undefined,
    movie_link: movieLink
  };

  const content = encodeURIComponent(JSON.stringify(payload));
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${content}`;

  qrResult.innerHTML = `
    <p class="hint">Готово! Отправьте QR друзьям:</p>
    <img src="${src}" alt="QR код выбранного фильма" />
  `;
});

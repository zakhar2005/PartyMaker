const $ = (s) => document.querySelector(s);
const roomInfo = $('#roomInfo');
const participantsList = $('#participants');
const moviesBoard = $('#moviesBoard');
const roundInfo = $('#roundInfo');
const finalResult = $('#finalResult');
const qrResult = $('#qrResult');
const roomQr = $('#roomQr');
const joinHint = $('#joinHint');
const joinLinkText = $('#joinLinkText');

const state = { code: null, me: null, isHost: false, room: null };

function joinUrl(code) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function renderRoomQr(code) {
  const link = joinUrl(code);
  joinHint.textContent = 'С телефона откройте эту же комнату через QR.';
  joinLinkText.innerHTML = `<a href="${link}" target="_blank" rel="noopener">${link}</a>`;
  roomQr.innerHTML = `<img alt="QR комнаты" src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}">`;
}

function renderParticipants(list) {
  participantsList.innerHTML = '';
  list.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p + (p === state.me ? ' (вы)' : '');
    participantsList.appendChild(li);
  });
}

function renderBoard(room) {
  moviesBoard.innerHTML = '';
  (room.movies || []).forEach((m) => {
    const votes = room.votes[String(m.id)] || {};
    const likes = Object.values(votes).filter((v) => v === 'like').length;
    const dislikes = Object.values(votes).filter((v) => v === 'dislike').length;
    const voters = room.participants.map((u) => {
      const cur = votes[u];
      return `<div class="voter-row"><span>${u}</span><div class="vote-buttons">
      <button class="small-btn ${cur === 'like' ? 'active-like' : ''}" data-mid="${m.id}" data-u="${u}" data-v="like">👍</button>
      <button class="small-btn ${cur === 'dislike' ? 'active-dislike' : ''}" data-mid="${m.id}" data-u="${u}" data-v="dislike">👎</button>
      </div></div>`;
    }).join('');

    const mineOnly = state.isHost ? voters : `<div class="voter-row"><span>${state.me}</span><div class="vote-buttons">
      <button class="small-btn ${votes[state.me] === 'like' ? 'active-like' : ''}" data-mid="${m.id}" data-u="${state.me}" data-v="like">👍</button>
      <button class="small-btn ${votes[state.me] === 'dislike' ? 'active-dislike' : ''}" data-mid="${m.id}" data-u="${state.me}" data-v="dislike">👎</button>
      </div></div>`;

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="movie-head">
        <img class="poster" src="${m.poster}" alt="Постер: ${m.title}" />
        <div>
          <h3>${m.title} (${m.year})</h3>
          <p class="hint">Рейтинг: ${m.rating} • Жанры: ${(m.genres || []).join(', ')}</p>
          <p class="overview">${m.overview}</p>
        </div>
      </div>
      <p class="vote">Лайки: ${likes} • Дизлайки: ${dislikes}</p>
      ${mineOnly}
    `;
    moviesBoard.appendChild(card);
  });

  moviesBoard.querySelectorAll('.small-btn').forEach((b) => {
    b.onclick = async () => {
      if (!state.code || !state.me) return;
      try {
        await api(`/api/rooms/${state.code}/vote`, 'POST', {
          movieId: Number(b.dataset.mid), participant: b.dataset.u, vote: b.dataset.v,
        });
        await syncRoom();
      } catch (e) { roomInfo.textContent = e.message; }
    };
  });
}

function renderFinal(winner) {
  if (!winner) {
    finalResult.className = 'result-empty';
    finalResult.textContent = 'Пока финальный фильм не выбран.';
    qrResult.innerHTML = '';
    return;
  }
  finalResult.className = 'result-win';
  finalResult.innerHTML = `<h3>🎉 Итоговый фильм: ${winner.title} (${winner.year})</h3><p>${winner.overview}</p>`;
  const finalUrl = `${window.location.origin}/final.html?room=${encodeURIComponent(state.code)}`;
  qrResult.innerHTML = `<p class="hint">Сканируйте QR, чтобы открыть страницу итогового фильма.</p><img src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(finalUrl)}" alt="QR финального фильма">`;
}

async function syncRoom() {
  if (!state.code) return;
  const room = await api(`/api/rooms/${state.code}`);
  state.room = room;
  renderParticipants(room.participants || []);
  roundInfo.textContent = room.winner
    ? 'Голосование завершено.'
    : room.round === 0
      ? 'Ждём старт голосования от хоста.'
      : `Раунд ${room.round}${(room.top_genres || []).length ? `. Топ жанры: ${room.top_genres.join(', ')}` : ''}`;
  renderBoard(room);
  renderFinal(room.winner);
}

$('#createRoomBtn').onclick = async () => {
  try {
    const host = ($('#hostName').value || '').trim();
    const data = await api('/api/rooms', 'POST', { hostName: host });
    state.code = data.code;
    state.me = data.host;
    state.isHost = true;
    roomInfo.textContent = `Комната ${state.code} создана.`;
    renderRoomQr(state.code);
    await syncRoom();
  } catch (e) { roomInfo.textContent = e.message; }
};

$('#joinBtn').onclick = async () => {
  try {
    const nick = ($('#guestName').value || '').trim();
    if (!nick) return;
    const code = state.code || new URLSearchParams(window.location.search).get('room');
    if (!code) throw new Error('Нет кода комнаты');
    await api(`/api/rooms/${code}/join`, 'POST', { nickname: nick });
    state.code = code;
    state.me = nick;
    state.isHost = false;
    roomInfo.textContent = `Вы подключены к комнате ${code}`;
    await syncRoom();
  } catch (e) { roomInfo.textContent = e.message; }
};

$('#startVotingBtn').onclick = async () => {
  if (!state.isHost) return;
  try { await api(`/api/rooms/${state.code}/start`, 'POST'); await syncRoom(); }
  catch (e) { roomInfo.textContent = e.message; }
};

$('#nextRoundBtn').onclick = async () => {
  if (!state.isHost) return;
  try { await api(`/api/rooms/${state.code}/process`, 'POST'); await syncRoom(); }
  catch (e) { roomInfo.textContent = e.message; }
};

(function init() {
  const code = new URLSearchParams(window.location.search).get('room');
  if (code) {
    state.code = code;
    roomInfo.textContent = `Комната ${code}: введите ник и нажмите «Присоединиться».`;
  }
  setInterval(() => state.code && syncRoom().catch(() => {}), 2500);
})();

export interface PlayerInfo { hash: string; name: string; avatar: string; }

const TRUTHS = [
  'Какое твоё самое неловкое воспоминание?',
  'Что тебя раздражает в людях больше всего?',
  'Был ли ты когда-нибудь влюблён в кого-то из присутствующих?',
  'Что ты никогда не сказал бы родителям?',
  'Какая твоя самая большая тайна?',
  'Кого из присутствующих ты добавил бы в контакты первым?',
  'Что ты делаешь, когда думаешь, что на тебя никто не смотрит?',
  'Какое твоё странное увлечение, которое ты скрываешь?',
  'Что ты соврал своим друзьям в последний раз?',
  'Кому из присутствующих ты доверяешь больше всего?',
  'Какой твой самый позорный момент в жизни?',
  'Кого бы ты не пустил на свою вечеринку?',
  'Что бы ты сделал с миллионом долларов?',
  'Какой твой самый большой страх?',
  'Когда последний раз ты плакал и почему?',
  'Есть ли у тебя секретный аккаунт в соцсетях?',
  'Что ты думаешь о каждом из присутствующих? (про каждого одно слово)',
  'Какую ложь ты говоришь чаще всего?',
  'Что ты никогда бы не съел?',
  'Кого из знаменитостей ты считаешь переоценённым?',
];

const DARES = [
  'Напиши что-нибудь смешное маркером на бумаге и покажи всем',
  'Позвони кому-нибудь из контактов и скажи "Мне нужна твоя помощь" — потом молчи 10 секунд',
  'Расскажи историю из жизни с голосом другого пола',
  'Сделай 15 приседаний прямо сейчас',
  'Напиши признание в любви случайному контакту и отправь',
  'Три минуты отвечай на всё только словом "Да"',
  'Покажи последний мем, который ты отправил',
  'Изобрази любое животное по заказу группы',
  'Поговори следующие 2 минуты как робот',
  'Напиши статус в соцсети "Я сошёл с ума" и оставь на 5 минут',
  'Угадай кто в чате написал последнее сообщение с закрытыми глазами',
  'Расскажи анекдот — если никто не засмеётся, штраф ещё одно задание',
  'Скопируй чью-нибудь аватарку и поставь себе на 10 минут',
  'Напиши 5 комплиментов каждому участнику игры',
  'Спой первый куплет любой песни',
  'Придумай прозвища для всех участников прямо сейчас',
  'Прочитай последнее уведомление на телефоне вслух',
  'Попробуй не смеяться, пока остальные тебя смешат (30 сек)',
  'Стань ди-джеем: включи трек и объяви его как радиоведущий',
  'Скажи по-русски скороговорку 3 раза',
];

export interface TDState {
  gameId: string;
  gameType: 'truthdare';
  status: 'playing' | 'ended';
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  currentHash: string;
  choice: 'truth' | 'dare' | null;
  currentTask: string | null;
  taskDone: boolean;
  round: number;
  scores: Record<string, number>;
  usedTruths: number[];
  usedDares: number[];
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr;
}

function pickUnused(list: string[], used: number[]): { text: string; idx: number } {
  const available = list.map((_, i) => i).filter(i => !used.includes(i));
  const pool = available.length > 0 ? available : list.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { text: list[idx], idx };
}

export function createTDGame(players: PlayerInfo[]): TDState {
  if (players.length < 2) throw new Error('Нужно минимум 2 игрока');
  const order = shuffle(players.map(p => p.hash));
  const playersMap: Record<string, PlayerInfo> = {};
  for (const p of players) playersMap[p.hash] = p;
  const scores: Record<string, number> = {};
  for (const p of players) scores[p.hash] = 0;
  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'truthdare',
    status: 'playing',
    playerOrder: order,
    players: playersMap,
    currentHash: order[0],
    choice: null,
    currentTask: null,
    taskDone: false,
    round: 1,
    scores,
    usedTruths: [],
    usedDares: [],
  };
}

export type TDAction =
  | { type: 'choose'; choice: 'truth' | 'dare' }
  | { type: 'done' }
  | { type: 'skip' };

export function applyTDAction(state: TDState, actorHash: string, action: TDAction): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };

  if (action.type === 'choose') {
    if (actorHash !== state.currentHash) return { ok: false, error: 'Сейчас не твоя очередь' };
    if (state.choice) return { ok: false, error: 'Уже выбрано' };
    state.choice = action.choice;
    if (action.choice === 'truth') {
      const { text, idx } = pickUnused(TRUTHS, state.usedTruths);
      state.currentTask = text;
      state.usedTruths.push(idx);
      if (state.usedTruths.length > TRUTHS.length - 3) state.usedTruths = [];
    } else {
      const { text, idx } = pickUnused(DARES, state.usedDares);
      state.currentTask = text;
      state.usedDares.push(idx);
      if (state.usedDares.length > DARES.length - 3) state.usedDares = [];
    }
    state.taskDone = false;
    return { ok: true };
  }

  if (action.type === 'done' || action.type === 'skip') {
    if (actorHash !== state.currentHash) return { ok: false, error: 'Сейчас не твоя очередь' };
    if (!state.choice) return { ok: false, error: 'Сначала выбери Правду или Действие' };
    if (action.type === 'done') {
      state.scores[actorHash] = (state.scores[actorHash] || 0) + 1;
    }
    const idx = state.playerOrder.indexOf(state.currentHash);
    state.currentHash = state.playerOrder[(idx + 1) % state.playerOrder.length];
    state.choice = null; state.currentTask = null; state.taskDone = false;
    if (state.currentHash === state.playerOrder[0]) state.round++;
    if (state.round > 20) { state.status = 'ended'; }
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестное действие' };
}

export function sanitizeTDForPlayer(state: TDState, _playerHash: string): object {
  return {
    gameId: state.gameId, gameType: state.gameType, status: state.status,
    playerOrder: state.playerOrder, players: state.players,
    currentHash: state.currentHash, choice: state.choice,
    currentTask: state.currentTask, round: state.round, scores: state.scores,
  };
}

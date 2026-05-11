export interface PlayerInfo { hash: string; name: string; avatar: string; }

const WORDS = [
  'АВТОБУС','БАБОЧКА','ВЕЛОСИПЕД','ГИТАРА','ДРАКОН','ЕДИНОРОГ','ЖИРАФ','ЗЕБРА',
  'ИГОЛКА','КАБЛУК','ЛИМОНАД','МОЛОТОК','НОТАРИУС','ОБЛАКО','ПИНГВИН','РАДУГА',
  'САМОЛЁТ','ТЕЛЕФОН','УЛИТКА','ФЛАМИНГО','ХОМЯК','ЦИРК','ЧЕРЕПАХА','ШОКОЛАД',
  'ЩУКА','ЭЛЬФ','ЮБИЛЕЙ','ЯГУАР','АБРИКОС','БАЛАЛАЙКА','ВЕРТОЛЁТ','ГОРИЛЛА',
  'ДИПЛОМ','ЕЖЕВИКА','ЖОНГЛЁР','ЗОНТИК','ИНТЕРНЕТ','КАКТУС','ЛАНДЫШ','МАНДАРИН',
  'НОСОРОГ','ОГУРЕЦ','ПАРАШЮТ','РАКУШКА','СКРИПКА','ТЮЛЬПАН','УДОЧКА','ФОНТАН',
  'ХУДОЖНИК','ЦЫПЛЁНОК','ШАХМАТЫ','ЭКВАТОР','ЯКОРЬ','АРБУЗ','БУТЫЛКА','ВОЛШЕБНИК',
];

export interface HangmanState {
  gameId: string;
  gameType: 'hangman';
  status: 'playing' | 'ended';
  word: string;
  maskedWord: string;
  guessedLetters: string[];
  wrongLetters: string[];
  maxWrong: number;
  winner: string | null;
  lastGuesser: string | null;
  players: Record<string, PlayerInfo>;
  playerOrder: string[];
  scores: Record<string, number>;
  round: number;
  hostHash: string;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr;
}

function getMasked(word: string, guessed: string[]): string {
  return word.split('').map(c => c === ' ' ? ' ' : guessed.includes(c) ? c : '_').join('');
}

export function createHangmanGame(players: PlayerInfo[]): HangmanState {
  if (players.length < 2) throw new Error('Нужно минимум 2 игрока');
  const order = shuffle(players.map(p => p.hash));
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const playersMap: Record<string, PlayerInfo> = {};
  const scores: Record<string, number> = {};
  for (const p of players) { playersMap[p.hash] = p; scores[p.hash] = 0; }
  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'hangman',
    status: 'playing',
    word,
    maskedWord: getMasked(word, []),
    guessedLetters: [],
    wrongLetters: [],
    maxWrong: 7,
    winner: null,
    lastGuesser: null,
    players: playersMap,
    playerOrder: order,
    scores,
    round: 1,
    hostHash: order[0],
  };
}

export function applyHangmanAction(state: HangmanState, actorHash: string, action: { type: 'guess'; letter: string }): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };
  if (action.type !== 'guess') return { ok: false, error: 'Неизвестное действие' };

  const letter = action.letter.toUpperCase().trim();
  if (!letter || letter.length !== 1) return { ok: false, error: 'Одна буква' };
  if (state.guessedLetters.includes(letter) || state.wrongLetters.includes(letter)) return { ok: false, error: 'Уже угадывали' };

  state.lastGuesser = actorHash;

  if (state.word.includes(letter)) {
    state.guessedLetters.push(letter);
    state.maskedWord = getMasked(state.word, state.guessedLetters);
    if (!state.maskedWord.includes('_')) {
      state.status = 'ended';
      state.winner = actorHash;
      state.scores[actorHash] = (state.scores[actorHash] || 0) + 3;
    }
  } else {
    state.wrongLetters.push(letter);
    if (state.wrongLetters.length >= state.maxWrong) {
      state.status = 'ended';
      state.winner = null;
    }
  }

  return { ok: true };
}

export function sanitizeHangmanForPlayer(state: HangmanState, _playerHash: string): object {
  return {
    gameId: state.gameId, gameType: state.gameType, status: state.status,
    maskedWord: state.maskedWord,
    wordLength: state.word.length,
    guessedLetters: state.guessedLetters,
    wrongLetters: state.wrongLetters,
    maxWrong: state.maxWrong,
    errorsLeft: state.maxWrong - state.wrongLetters.length,
    winner: state.winner,
    revealedWord: state.status === 'ended' ? state.word : undefined,
    lastGuesser: state.lastGuesser,
    players: state.players,
    playerOrder: state.playerOrder,
    scores: state.scores,
    round: state.round,
  };
}

import { useRef, useState, useEffect, useCallback } from 'react';

export type CallState = 'idle' | 'calling' | 'incoming' | 'active';
export type CallType  = 'audio' | 'video';

export interface CallPeer {
  hash: string;
  type: CallType;
}

export interface UseCallSignalingReturn {
  callState:    CallState;
  callPeer:     CallPeer | null;
  localStream:  MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted:      boolean;
  isCamOff:     boolean;
  callDuration: number;
  iceState:     RTCIceConnectionState | null;
  startCall:    (peerHash: string, type: CallType) => void;
  acceptCall:   () => void;
  declineCall:  () => void;
  endCall:      () => void;
  toggleMute:   () => void;
  toggleCam:    () => void;
  unavailable:  boolean;
  blocked:      boolean;
}

const STUN: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    /* openrelay.metered.ca — UDP + TCP + TLS */
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:80?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    /* numb.viagenie.ca — дополнительный бесплатный TURN */
    { urls: 'turn:numb.viagenie.ca', username: 'webrtc@live.com', credential: 'muazkh' },
    /* freestun.net */
    { urls: 'turn:freestun.net:3479', username: 'free', credential: 'free' },
    { urls: 'turns:freestun.net:5350', username: 'free', credential: 'free' },
  ],
  iceCandidatePoolSize: 10,
};

/* ─── Рингтоны ─── */
export type RingtoneId = 'classic' | 'modern' | 'digital' | 'pulse' | 'custom';
export const RINGTONE_OPTIONS: { id: RingtoneId; name: string; emoji: string }[] = [
  { id: 'classic', name: 'Классический', emoji: '📞' },
  { id: 'modern',  name: 'Современный',  emoji: '🔔' },
  { id: 'digital', name: 'Цифровой',     emoji: '💻' },
  { id: 'pulse',   name: 'Пульс',        emoji: '💓' },
  { id: 'custom',  name: 'Своя мелодия', emoji: '🎵' },
];
export const RINGTONE_PREF_KEY = 'sw_ringtone_id';

/* ─── Синтезатор рингтонов (Web Audio API) ─── */
class SynthRing {
  private ctx: AudioContext | null = null;
  private running = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private kind: Exclude<RingtoneId, 'custom'>) {}

  play() {
    this.running = true;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.loop();
    } catch {}
  }

  private loop() {
    if (!this.running || !this.ctx) return;
    this.playPattern();
    const intervals: Record<string, number> = { classic: 5000, modern: 4200, digital: 2800, pulse: 2000 };
    this.loopTimer = setTimeout(() => this.loop(), intervals[this.kind] ?? 4000);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.35) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + dur - 0.04);
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.start(t); osc.stop(t + dur);
  }

  private playPattern() {
    switch (this.kind) {
      case 'classic':
        /* Двухтональный звонок телефона */
        this.tone(480, 0,   1.8, 'square', 0.28);
        this.tone(440, 0,   1.8, 'square', 0.28);
        break;
      case 'modern':
        /* Трель вверх: три ноты */
        [880, 1100, 1320].forEach((f, i) => this.tone(f, i * 0.22, 0.18, 'sine', 0.38));
        this.tone(1760, 0.75, 0.28, 'sine', 0.3);
        break;
      case 'digital':
        /* Быстрые короткие пики */
        for (let i = 0; i < 5; i++) this.tone(1200 + i * 60, i * 0.18, 0.12, 'square', 0.22);
        break;
      case 'pulse':
        /* Три низкочастотных импульса */
        [0, 0.55, 1.1].forEach(t => this.tone(620, t, 0.35, 'sine', 0.42));
        break;
    }
  }

  stop() {
    this.running = false;
    if (this.loopTimer) { clearTimeout(this.loopTimer); this.loopTimer = null; }
    try { this.ctx?.close(); } catch {}
    this.ctx = null;
  }
}

/* Комбинированный плеер (синтез или mp3) */
interface RingPlayer { stop(): void }

function startRingtone(id: RingtoneId): RingPlayer {
  if (id === 'custom') {
    const a = new Audio('/custom-ringtone.mp3');
    a.loop = true; a.volume = 0.8;
    a.play().catch(() => {});
    return { stop: () => { a.pause(); a.currentTime = 0; } };
  }
  const synth = new SynthRing(id);
  synth.play();
  return { stop: () => synth.stop() };
}

export function useCallSignaling(myHash: string, token: string, ringtoneId: RingtoneId = 'classic'): UseCallSignalingReturn {
  const ws            = useRef<WebSocket | null>(null);
  const pc            = useRef<RTCPeerConnection | null>(null);
  const localRef      = useRef<MediaStream | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef   = useRef<RingPlayer | null>(null);

  /* Очередь ICE-кандидатов до готовности PC+remoteDescription */
  const icePending    = useRef<RTCIceCandidateInit[]>([]);

  const [callState,    setCallState]    = useState<CallState>('idle');
  const [callPeer,     setCallPeer]     = useState<CallPeer | null>(null);
  const [localStream,  setLocalStream]  = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCamOff,     setIsCamOff]     = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [unavailable,  setUnavailable]  = useState(false);
  const [blocked,      setBlocked]      = useState(false);
  const [iceState,     setIceState]     = useState<RTCIceConnectionState | null>(null);

  /* ─── WebSocket URL ─── */
  const wsUrl = (() => {
    const origin = window.location.origin;
    return origin.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/api/ws/calls';
  })();

  /* ─── Остановить рингтон ─── */
  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
  }, []);

  /* ─── Запустить рингтон ─── */
  const playRingtone = useCallback(() => {
    stopRingtone();
    ringtoneRef.current = startRingtone(ringtoneId);
  }, [stopRingtone, ringtoneId]);

  /* ─── Cleanup ─── */
  const cleanup = useCallback(() => {
    stopRingtone();
    pc.current?.close();
    pc.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    icePending.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setCallPeer(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCamOff(false);
    setIceState(null);
  }, [stopRingtone]);

  /* ─── Send via WebSocket ─── */
  const wsSend = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  /* ─── Flush pending ICE candidates ─── */
  const flushPendingIce = useCallback(async () => {
    const conn = pc.current;
    if (!conn || !conn.remoteDescription) return;
    const candidates = icePending.current.splice(0);
    for (const cand of candidates) {
      try { await conn.addIceCandidate(new RTCIceCandidate(cand)); } catch {}
    }
  }, []);

  /* ─── Create RTCPeerConnection ─── */
  const createPC = useCallback((peerHash: string) => {
    pc.current?.close();
    pc.current = null;
    icePending.current = [];

    const conn = new RTCPeerConnection(STUN);

    conn.onicecandidate = (e) => {
      if (e.candidate) wsSend({ type: 'call:ice', peerHash, candidate: e.candidate });
    };

    /* Собираем треки в единый MediaStream — надёжнее чем e.streams[0] */
    const remoteMs = new MediaStream();
    conn.ontrack = (e) => {
      remoteMs.addTrack(e.track);
      setRemoteStream(new MediaStream(remoteMs.getTracks()));
    };

    conn.oniceconnectionstatechange = () => {
      setIceState(conn.iceConnectionState);
      if (conn.iceConnectionState === 'failed') {
        /* Пробуем перезапустить ICE перед сдачей */
        conn.restartIce?.();
      }
    };

    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'failed') {
        cleanup();
      }
    };

    pc.current = conn;
    return conn;
  }, [wsSend, cleanup]);

  /* ─── Get local media ─── */
  const getMedia = useCallback(async (type: CallType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false,
    });
    localRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  /* ─── Start timer ─── */
  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
  }, []);

  /* ─── Таймаут звонка (45 сек без ответа) ─── */
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
  }, []);

  /* ─── Handle incoming WS messages ─── */
  const callPeerRef     = useRef<CallPeer | null>(null);
  const cleanupRef      = useRef(cleanup);
  const createPCRef     = useRef(createPC);
  const flushIceRef     = useRef(flushPendingIce);
  const getMediaRef     = useRef(getMedia);
  const startTimerRef   = useRef(startTimer);
  const wsSendRef       = useRef(wsSend);
  const stopRingtoneRef = useRef(stopRingtone);
  const playRingtoneRef = useRef(playRingtone);

  useEffect(() => { callPeerRef.current    = callPeer;       }, [callPeer]);
  useEffect(() => { cleanupRef.current     = cleanup;        }, [cleanup]);
  useEffect(() => { createPCRef.current    = createPC;       }, [createPC]);
  useEffect(() => { flushIceRef.current    = flushPendingIce;}, [flushPendingIce]);
  useEffect(() => { getMediaRef.current    = getMedia;       }, [getMedia]);
  useEffect(() => { startTimerRef.current  = startTimer;     }, [startTimer]);
  useEffect(() => { wsSendRef.current      = wsSend;         }, [wsSend]);
  useEffect(() => { stopRingtoneRef.current = stopRingtone;  }, [stopRingtone]);
  useEffect(() => { playRingtoneRef.current = playRingtone;  }, [playRingtone]);

  const handleMessage = useCallback(async (raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    const _callPeer   = callPeerRef.current;
    const _cleanup    = cleanupRef.current;
    const _createPC   = createPCRef.current;
    const _flushIce   = flushIceRef.current;
    const _getMedia   = getMediaRef.current;
    const _startTimer = startTimerRef.current;
    const _wsSend     = wsSendRef.current;
    const _stop       = stopRingtoneRef.current;
    const _play       = playRingtoneRef.current;

    switch (msg.type) {

      case 'call:incoming': {
        setCallState('incoming');
        setCallPeer({ hash: msg.callerHash, type: msg.callType ?? 'audio' });
        setUnavailable(false);
        setBlocked(false);
        _play();
        break;
      }

      case 'call:ringing': {
        _play();
        clearCallTimeout();
        callTimeoutRef.current = setTimeout(() => { _cleanup(); }, 45_000);
        break;
      }

      case 'call:accepted': {
        /* ЗВОНЯЩИЙ: callee принял — создаём offer */
        _stop();
        clearCallTimeout();
        const calleeHash = msg.calleeHash;
        if (!calleeHash) break;
        try {
          /* 1. Создаём PC сразу — ICE-кандидаты от callee будут ставиться в очередь */
          const conn = _createPC(calleeHash);
          /* 2. Получаем медиа */
          const stream = await _getMedia(_callPeer?.type ?? 'audio');
          /* 3. Добавляем треки */
          stream.getTracks().forEach(t => conn.addTrack(t, stream));
          /* 4. Создаём и отправляем offer */
          const offer = await conn.createOffer();
          await conn.setLocalDescription(offer);
          _wsSend({ type: 'call:offer', peerHash: calleeHash, sdp: offer.sdp });
          setCallState('active');
          _startTimer();
        } catch (err) {
          console.error('[call] offer error', err);
          _cleanup();
        }
        break;
      }

      case 'call:declined':
      case 'call:ended': {
        clearCallTimeout();
        _cleanup();
        break;
      }

      case 'call:offer': {
        /* ПРИНИМАЮЩИЙ: получили offer от звонящего */
        _stop();
        clearCallTimeout();
        const callerHash = msg.callerHash;
        try {
          /* 1. Создаём PC ПЕРВЫМ — теперь ICE-кандидаты могут поступать и будут в очереди */
          const conn = _createPC(callerHash);
          /* 2. Устанавливаем remote description (может сразу вызвать ontrack) */
          await conn.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          /* 3. Применяем накопившиеся ICE-кандидаты */
          await _flushIce();
          /* 4. Получаем медиа (может занять 1-5 сек на разрешение) */
          const stream = await _getMedia(_callPeer?.type ?? 'audio');
          /* 5. Добавляем треки */
          stream.getTracks().forEach(t => conn.addTrack(t, stream));
          /* 6. Создаём и отправляем answer */
          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);
          _wsSend({ type: 'call:answer', peerHash: callerHash, sdp: answer.sdp });
          /* 7. Переходим в активное состояние */
          setCallState('active');
          _startTimer();
        } catch (err) {
          console.error('[call] answer error', err);
          _cleanup();
        }
        break;
      }

      case 'call:answer': {
        /* ЗВОНЯЩИЙ: получили answer от callee — устанавливаем remote description */
        try {
          await pc.current?.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          /* Применяем ICE-кандидаты от callee, которые могли прийти до answer */
          await flushPendingIce();
        } catch (err) {
          console.error('[call] setRemoteDescription(answer) error', err);
        }
        break;
      }

      case 'call:ice': {
        try {
          if (msg.candidate) {
            const conn = pc.current;
            if (conn && conn.remoteDescription) {
              /* PC готов — применяем сразу */
              await conn.addIceCandidate(new RTCIceCandidate(msg.candidate));
            } else {
              /* PC не готов — ставим в очередь */
              icePending.current.push(msg.candidate);
            }
          }
        } catch {}
        break;
      }

      case 'call:unavailable': {
        clearCallTimeout();
        setUnavailable(true);
        _cleanup();
        setTimeout(() => setUnavailable(false), 3000);
        break;
      }

      case 'call:blocked': {
        clearCallTimeout();
        setBlocked(true);
        _cleanup();
        setTimeout(() => setBlocked(false), 4000);
        break;
      }
    }
  }, [clearCallTimeout, flushPendingIce]); // стабильные зависимости

  /* ─── Connect WebSocket ─── */
  useEffect(() => {
    if (!token || !myHash) return;
    let socket: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'register', token }));
      };
      socket.onmessage = (e) => handleMessage(e.data);
      socket.onclose   = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };
      socket.onerror   = () => socket.close();
    };

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token, myHash, wsUrl, handleMessage]);

  /* ─── API ─── */
  const startCall = useCallback((peerHash: string, type: CallType) => {
    setCallState('calling');
    setCallPeer({ hash: peerHash, type });
    setUnavailable(false);
    setBlocked(false);
    wsSend({ type: 'call:request', calleeHash: peerHash, callType: type });
  }, [wsSend]);

  const acceptCall = useCallback(() => {
    if (!callPeer) return;
    stopRingtone();
    wsSend({ type: 'call:accept', callerHash: callPeer.hash });
  }, [callPeer, wsSend, stopRingtone]);

  const declineCall = useCallback(() => {
    if (!callPeer) return;
    wsSend({ type: 'call:decline', callerHash: callPeer.hash });
    cleanup();
  }, [callPeer, wsSend, cleanup]);

  const endCall = useCallback(() => {
    if (callPeer) wsSend({ type: 'call:end', peerHash: callPeer.hash });
    cleanup();
  }, [callPeer, wsSend, cleanup]);

  const toggleMute = useCallback(() => {
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }, []);

  const toggleCam = useCallback(() => {
    localRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCamOff(c => !c);
  }, []);

  return {
    callState, callPeer, localStream, remoteStream,
    isMuted, isCamOff, callDuration, iceState,
    startCall, acceptCall, declineCall, endCall,
    toggleMute, toggleCam, unavailable, blocked,
  };
}

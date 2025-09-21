import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { io, type Socket } from 'socket.io-client';
import {
  helloEventSchema,
  lotteryDrawEventSchema,
  lotteryResultBroadcastSchema,
  modeSwitchEventSchema,
  quizAnswerEventSchema,
  quizResultBroadcastSchema,
  quizShowBroadcastSchema,
  stateUpdateBroadcastSchema,
  tapDeltaEventSchema
} from '@wedding_tool/schema';
import { z } from '@wedding_tool/schema';

type BroadcastMap = {
  'state:update': z.infer<typeof stateUpdateBroadcastSchema>;
  'quiz:show': z.infer<typeof quizShowBroadcastSchema>;
  'quiz:result': z.infer<typeof quizResultBroadcastSchema>;
  'lottery:result': z.infer<typeof lotteryResultBroadcastSchema>;
};

type ClientEventMap = {
  'tap:delta': z.infer<typeof tapDeltaEventSchema>;
  'quiz:answer': z.infer<typeof quizAnswerEventSchema>;
  hello: z.infer<typeof helloEventSchema>;
};

type AdminEventMap = {
  'mode:switch': z.infer<typeof modeSwitchEventSchema>;
  'game:start': undefined;
  'game:stop': undefined;
  'quiz:next': undefined;
  'quiz:reveal': undefined;
  'lottery:draw': z.infer<typeof lotteryDrawEventSchema>;
};

type ClientEvent = {
  [K in keyof ClientEventMap]: { type: K; payload: ClientEventMap[K] };
}[keyof ClientEventMap];

type AdminEvent = {
  [K in keyof AdminEventMap]: { type: K; payload: AdminEventMap[K] };
}[keyof AdminEventMap];

type Handler<K extends keyof BroadcastMap> = (payload: BroadcastMap[K]) => void;

export type RealtimeMode = 'cloud' | 'lan';

export interface RealtimeClient {
  join: (roomId: string) => Promise<void>;
  on: <K extends keyof BroadcastMap>(event: K, handler: Handler<K>) => () => void;
  emit: (event: ClientEvent | AdminEvent) => Promise<void>;
  close: () => Promise<void>;
}

export type SupabaseRealtimeOptions = {
  mode: 'cloud';
  supabaseUrl: string;
  supabaseKey: string;
  dispatch: (event: ClientEvent | AdminEvent) => Promise<void>;
};

export type SocketRealtimeOptions = {
  mode: 'lan';
  socketUrl: string;
};

export type RealtimeClientOptions = SupabaseRealtimeOptions | SocketRealtimeOptions;

class SupabaseRealtimeClient implements RealtimeClient {
  private client: SupabaseClient;
  private channel: ReturnType<SupabaseClient['channel']> | null = null;
  private handlers = new Map<keyof BroadcastMap, Set<Handler<keyof BroadcastMap>>>();

  constructor(private readonly options: SupabaseRealtimeOptions) {
    this.client = createClient(options.supabaseUrl, options.supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 20
        }
      }
    });
  }

  async join(roomId: string) {
    if (this.channel) {
      await this.channel.unsubscribe();
    }

    const channelName = `room:${roomId}`;
    this.channel = this.client.channel(channelName, {
      config: {
        broadcast: { ack: true }
      }
    });

    this.channel.on('broadcast', { event: 'state:update' }, (payload) => {
      this.dispatch('state:update', payload.payload);
    });

    this.channel.on('broadcast', { event: 'quiz:show' }, (payload) => {
      this.dispatch('quiz:show', payload.payload);
    });

    this.channel.on('broadcast', { event: 'quiz:result' }, (payload) => {
      this.dispatch('quiz:result', payload.payload);
    });

    this.channel.on('broadcast', { event: 'lottery:result' }, (payload) => {
      this.dispatch('lottery:result', payload.payload);
    });

    const { error } = await this.channel.subscribe();
    if (error) {
      throw error;
    }
  }

  on<K extends keyof BroadcastMap>(event: K, handler: Handler<K>) {
    const set = (this.handlers.get(event) ?? new Set()) as Set<Handler<K>>;
    set.add(handler);
    this.handlers.set(event, set as Set<Handler<keyof BroadcastMap>>);

    return () => {
      set.delete(handler);
    };
  }

  async emit(event: ClientEvent | AdminEvent) {
    await this.options.dispatch(event);
  }

  async close() {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
  }

  private dispatch<K extends keyof BroadcastMap>(event: K, payload: unknown) {
    const schema = broadcastSchemas[event];
    const parseResult = schema.safeParse(payload);
    if (!parseResult.success) {
      console.error(`[Realtime] Invalid payload for ${event}`, parseResult.error);
      return;
    }

    const handlers = this.handlers.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler(parseResult.data as BroadcastMap[K]));
  }
}

class SocketRealtimeClient implements RealtimeClient {
  private socket: Socket | null = null;
  private handlers = new Map<keyof BroadcastMap, Set<Handler<keyof BroadcastMap>>>();

  constructor(private readonly options: SocketRealtimeOptions) {}

  async join(roomId: string) {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(this.options.socketUrl, {
      transports: ['websocket'],
      query: {
        roomId
      }
    });

    this.socket.on('connect', () => {
      this.socket?.emit('join', { roomId });
    });

    (Object.keys(broadcastSchemas) as Array<keyof BroadcastMap>).forEach((event) => {
      this.socket?.on(event, (payload: unknown) => {
        this.dispatch(event, payload);
      });
    });
  }

  on<K extends keyof BroadcastMap>(event: K, handler: Handler<K>) {
    const set = (this.handlers.get(event) ?? new Set()) as Set<Handler<K>>;
    set.add(handler);
    this.handlers.set(event, set as Set<Handler<keyof BroadcastMap>>);

    return () => {
      set.delete(handler);
    };
  }

  async emit(event: ClientEvent | AdminEvent) {
    if (!this.socket) {
      throw new Error('Socket is not connected. Call join() first.');
    }

    this.socket.emit('event', event);
    return Promise.resolve();
  }

  async close() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private dispatch<K extends keyof BroadcastMap>(event: K, payload: unknown) {
    const schema = broadcastSchemas[event];
    const parseResult = schema.safeParse(payload);
    if (!parseResult.success) {
      console.error(`[LAN Realtime] Invalid payload for ${event}`, parseResult.error);
      return;
    }

    const handlers = this.handlers.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler(parseResult.data as BroadcastMap[K]));
  }
}

const broadcastSchemas: Record<keyof BroadcastMap, z.ZodTypeAny> = {
  'state:update': stateUpdateBroadcastSchema,
  'quiz:show': quizShowBroadcastSchema,
  'quiz:result': quizResultBroadcastSchema,
  'lottery:result': lotteryResultBroadcastSchema
};

export async function createRealtimeClient(options: RealtimeClientOptions): Promise<RealtimeClient> {
  if (options.mode === 'cloud') {
    return new SupabaseRealtimeClient(options);
  }

  return new SocketRealtimeClient(options);
}

export type { ClientEvent, AdminEvent, BroadcastMap };

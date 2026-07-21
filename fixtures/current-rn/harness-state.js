export const initialPlaybackState = {
  cursor: 0,
  status: 'idle',
};

export function advanceCursor(cursor, total, chunkSize) {
  return Math.min(total, Math.max(0, cursor) + Math.max(1, chunkSize));
}

export function playbackReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialPlaybackState;
    case 'start':
      return {
        cursor: state.cursor >= action.total ? 0 : state.cursor,
        status: 'running',
      };
    case 'pause':
      return { ...state, status: state.cursor >= action.total ? 'complete' : 'paused' };
    case 'step': {
      const cursor = advanceCursor(state.cursor, action.total, action.chunkSize);
      return { cursor, status: cursor >= action.total ? 'complete' : 'paused' };
    }
    case 'tick': {
      if (state.status !== 'running') return state;
      const cursor = advanceCursor(state.cursor, action.total, action.chunkSize);
      return { cursor, status: cursor >= action.total ? 'complete' : 'running' };
    }
    case 'finish':
      return { cursor: action.total, status: 'complete' };
    default:
      return state;
  }
}

export function progressPercent(cursor, total) {
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((cursor / total) * 100)));
}

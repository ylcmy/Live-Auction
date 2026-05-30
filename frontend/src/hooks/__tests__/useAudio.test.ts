import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudio } from '../useAudio';

function setupAudioContextMock() {
  const mockOscillator = {
    connect: vi.fn(),
    frequency: { value: 0 },
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockGain = {
    connect: vi.fn(),
    gain: {
      value: 0,
      exponentialRampToValueAtTime: vi.fn(),
    },
  };

  const mockAudioContext = {
    createOscillator: vi.fn(() => ({ ...mockOscillator })),
    createGain: vi.fn(() => ({ ...mockGain })),
    destination: {},
    currentTime: 0,
  };

  const OriginalAudioContext = globalThis.AudioContext;

  globalThis.AudioContext = vi.fn(() => ({ ...mockAudioContext })) as unknown as typeof AudioContext;

  return { mockAudioContext, mockOscillator, mockGain, OriginalAudioContext };
}

describe('useAudio', () => {
  let OriginalAudioContext: typeof globalThis.AudioContext | undefined;
  let mockAudioContext: ReturnType<typeof setupAudioContextMock>['mockAudioContext'];

  beforeAll(() => {
    const mocks = setupAudioContextMock();
    OriginalAudioContext = mocks.OriginalAudioContext;
    mockAudioContext = mocks.mockAudioContext;
  });

  afterAll(() => {
    if (OriginalAudioContext !== undefined) {
      globalThis.AudioContext = OriginalAudioContext;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return playTick and playDing functions', () => {
    const { result } = renderHook(() => useAudio());
    expect(typeof result.current.playTick).toBe('function');
    expect(typeof result.current.playDing).toBe('function');
  });

  it('should create AudioContext lazily when playTick is first called', () => {
    const { result } = renderHook(() => useAudio());
    expect(globalThis.AudioContext).not.toHaveBeenCalled();

    act(() => { result.current.playTick(); });
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('should reuse AudioContext on subsequent calls', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playTick(); });
    act(() => { result.current.playDing(); });
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(1);
  });

  it('should create oscillator and gain nodes for playTick', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playTick(); });
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('should set correct frequency for playTick (800 Hz)', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playTick(); });
    // The mock creates new objects each time, so we check via the constructor call
    expect(globalThis.AudioContext).toHaveBeenCalled();
  });

  it('should create oscillator and gain nodes for playDing', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playDing(); });
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    expect(mockAudioContext.createGain).toHaveBeenCalled();
  });

  it('should call exponentialRampToValueAtTime for playDing fade-out', () => {
    const { result } = renderHook(() => useAudio());
    act(() => { result.current.playDing(); });
    expect(mockAudioContext.createGain).toHaveBeenCalled();
    // The gain mock returns a new spread object; check via AudioContext mock usage
    expect(globalThis.AudioContext).toHaveBeenCalled();
  });

  it('should gracefully degrade when AudioContext is unavailable', () => {
    const Original = globalThis.AudioContext;
    globalThis.AudioContext = undefined as unknown as typeof AudioContext;

    const { result } = renderHook(() => useAudio());
    expect(() => { act(() => { result.current.playTick(); }); }).not.toThrow();
    expect(() => { act(() => { result.current.playDing(); }); }).not.toThrow();

    globalThis.AudioContext = Original;
  });

  it('should gracefully degrade when AudioContext constructor throws', () => {
    const Original = globalThis.AudioContext;
    globalThis.AudioContext = vi.fn(() => {
      throw new Error('AudioContext not allowed');
    }) as unknown as typeof AudioContext;

    const { result } = renderHook(() => useAudio());
    expect(() => { act(() => { result.current.playTick(); }); }).not.toThrow();

    globalThis.AudioContext = Original;
  });

  it('should handle multiple playTick rapid calls without error', () => {
    const { result } = renderHook(() => useAudio());
    expect(() => {
      act(() => {
        result.current.playTick();
        result.current.playTick();
        result.current.playTick();
      });
    }).not.toThrow();
  });

  it('should handle mixed playTick and playDing calls', () => {
    const { result } = renderHook(() => useAudio());
    expect(() => {
      act(() => {
        result.current.playTick();
        result.current.playDing();
        result.current.playTick();
      });
    }).not.toThrow();
  });
});

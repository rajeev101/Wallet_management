import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

export function useResource<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const currentLoader = useRef(loader);
  currentLoader.current = loader;
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const generation = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current += 1; }; }, []);
  const reload = useCallback(async () => {
    const requestId = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await currentLoader.current();
      if (mounted.current && requestId === generation.current) setData(result);
      return result;
    } catch (failure) {
      if (mounted.current && requestId === generation.current) setError(failure instanceof Error ? failure.message : 'Something went wrong.');
    } finally { if (mounted.current && requestId === generation.current) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload, ...dependencies]));
  return { data, loading, error, reload };
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Something went wrong.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, message, setError, setMessage, run };
}

export function useForegroundPoll(callback: () => Promise<unknown>, intervalMs: number, enabled = true) {
  const current = useRef(callback);
  current.current = callback;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending = false;
    const tick = async () => {
      if (!active || pending || AppState.currentState !== 'active') return;
      pending = true;
      try { await current.current(); } finally { pending = false; }
    };
    void tick();
    const timer = setInterval(() => { void tick(); }, intervalMs);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void tick(); });
    return () => { active = false; clearInterval(timer); subscription.remove(); };
  }, [intervalMs, enabled]);
}
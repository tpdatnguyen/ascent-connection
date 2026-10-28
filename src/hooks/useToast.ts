import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast(ms = 3200) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const push = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(false), ms);
  }, [ms]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { msg, show, push };
}

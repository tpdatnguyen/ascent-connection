import { useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { PlanScreen } from './components/PlanScreen';
import { Splash } from './components/Splash';
import { Toast } from './components/Toast';
import { usePlan } from './hooks/usePlan';
import { useToast } from './hooks/useToast';
import type { PlanStore } from './store/PlanStore';

export function App({ store }: { store: Promise<PlanStore> }) {
  const [screen, setScreen] = useState<'splash' | 'plan'>('splash');
  const toast = useToast();
  const plan = usePlan(store, toast.push);

  const openPlan = () => {
    setScreen('plan');
    window.scrollTo(0, 0);
  };

  return (
    <>
      {screen === 'splash'
        ? <Splash onOpen={openPlan} />
        : plan.state.session && plan.state.session.state !== 'ready'
          ? <AuthGate plan={plan} />
          : <PlanScreen plan={plan} />}
      <Toast msg={toast.msg} show={toast.show} />
    </>
  );
}

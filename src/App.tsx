import { useState } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { EnergyBoard } from './components/EnergyBoard';
import { GameErrorBoundary } from './components/GameErrorBoundary';
import { PauseOverlay } from './components/PauseOverlay';
import { ResultOverlay } from './components/ResultOverlay';
import { RiskPanel } from './components/RiskPanel';
import { StartOverlay } from './components/StartOverlay';
import { StatusBar } from './components/StatusBar';
import { UpgradeOverlay } from './components/UpgradeOverlay';
import { useGameController } from './hooks/useGameController';

function GameScreen() {
  const game = useGameController();
  const restart = () => game.dispatch({ type: 'restart', seed: Date.now() >>> 0 });
  const pauseOnError = () => game.dispatch({ type: 'pause' });

  return (
    <GameErrorBoundary onRestart={restart} onError={pauseOnError}>
      <main className="game-shell">
        <h1 className="sr-only">电量守卫</h1>
        <StatusBar state={game.state} onPause={() => game.dispatch({ type: 'pause' })} />
        <EnergyBoard state={game.state} />
        <RiskPanel state={game.state} />
        <ControlPanel state={game.state} onAction={game.dispatch} />
        {game.state.status === 'ready' && <StartOverlay onStart={() => game.dispatch({ type: 'start' })} />}
        {game.state.status === 'paused' && <PauseOverlay onResume={() => game.dispatch({ type: 'resume' })} />}
        {game.state.status === 'choosingUpgrade' && (
          <UpgradeOverlay
            choices={game.state.pendingUpgrades}
            onChoose={(upgrade) => game.dispatch({ type: 'chooseUpgrade', upgrade })}
          />
        )}
        {(game.state.status === 'victory' || game.state.status === 'gameOver') && (
          <ResultOverlay state={game.state} onRestart={restart} />
        )}
      </main>
    </GameErrorBoundary>
  );
}

export default function App() {
  const [recoveryKey, setRecoveryKey] = useState(0);

  return (
    <GameErrorBoundary key={recoveryKey} onRestart={() => setRecoveryKey((key) => key + 1)}>
      <GameScreen />
    </GameErrorBoundary>
  );
}

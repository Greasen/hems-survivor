import { useRef, useState } from 'react';
import type { UpgradeId } from '../game/types';
import { upgradeText } from '../game/upgrades';
import { ModalDialog } from './ModalDialog';

interface UpgradeOverlayProps {
  choices: readonly UpgradeId[];
  onChoose: (upgrade: UpgradeId) => void;
}

export function UpgradeOverlay({ choices, onChoose }: UpgradeOverlayProps) {
  const selectionLocked = useRef(false);
  const [locked, setLocked] = useState(false);

  const choose = (upgrade: UpgradeId) => {
    if (selectionLocked.current) return;
    selectionLocked.current = true;
    setLocked(true);
    onChoose(upgrade);
  };

  return (
    <ModalDialog className="overlay overlay--upgrade" titleId="upgrade-title">
      <h2 id="upgrade-title">选择升级</h2>
      <div className="upgrade-grid">
        {choices.map((upgrade) => {
          const text = upgradeText[upgrade];
          return (
            <article className="upgrade-card" key={upgrade}>
              <h3>{text.name}</h3>
              <p>{text.description}</p>
              <button type="button" disabled={locked} onClick={() => choose(upgrade)} aria-label={`选择${text.name}`}>
                选择
              </button>
            </article>
          );
        })}
      </div>
    </ModalDialog>
  );
}

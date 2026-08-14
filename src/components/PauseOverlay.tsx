import { ModalDialog } from './ModalDialog';

interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <ModalDialog className="overlay overlay--pause" titleId="pause-title">
      <h2 id="pause-title">游戏已暂停</h2>
      <button type="button" onClick={onResume}>继续游戏</button>
    </ModalDialog>
  );
}

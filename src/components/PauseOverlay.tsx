interface PauseOverlayProps {
  onResume: () => void;
}

export function PauseOverlay({ onResume }: PauseOverlayProps) {
  return (
    <section className="overlay overlay--pause" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <h2 id="pause-title">游戏已暂停</h2>
      <button type="button" onClick={onResume}>继续游戏</button>
    </section>
  );
}

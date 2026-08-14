interface StartOverlayProps {
  onStart: () => void;
}

export function StartOverlay({ onStart }: StartOverlayProps) {
  return (
    <section className="overlay overlay--start" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <h2 id="start-title">电量守卫</h2>
      <ul>
        <li>保证 Home 持续供电</li>
        <li>使用 Battery 应对供电缺口</li>
        <li>根据事件控制 EV 和 Grid</li>
      </ul>
      <button type="button" onClick={onStart}>开始游戏</button>
    </section>
  );
}

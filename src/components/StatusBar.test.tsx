import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { StatusBar } from './StatusBar';
import { stateAt } from '../test/fixtures';

describe('StatusBar', () => {
  afterEach(cleanup);
  it('shows the formatted time and resource values', () => {
    render(
      <StatusBar
        state={stateAt({ tick: 65, resources: { money: 120, family: 100, score: 7 } })}
        onPause={vi.fn()}
      />,
    );

    expect(screen.getByText('时间 01:05')).toBeInTheDocument();
    expect(screen.getByText('Money 120')).toBeInTheDocument();
    expect(screen.getByLabelText('家庭满意度')).toHaveTextContent('100');
    expect(screen.getByText('Score 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停游戏' })).toBeInTheDocument();
  });

  it('calls onPause from the named pause action', async () => {
    const onPause = vi.fn();
    render(<StatusBar state={stateAt()} onPause={onPause} />);

    screen.getByRole('button', { name: '暂停游戏' }).click();
    expect(onPause).toHaveBeenCalledOnce();
  });
});

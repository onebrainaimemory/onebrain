import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkeletonText, SkeletonCard, SkeletonList } from './Skeleton';

describe('SkeletonText', () => {
  it('should render with default 3 lines', () => {
    const { container } = render(<SkeletonText />);

    const lines = container.querySelectorAll('.skeletonLine');
    expect(lines.length).toBe(3);
  });

  it('should render the specified number of lines', () => {
    const { container } = render(<SkeletonText lines={5} />);

    const lines = container.querySelectorAll('.skeletonLine');
    expect(lines.length).toBe(5);
  });

  it('should set the last line to 60% width', () => {
    const { container } = render(<SkeletonText lines={3} />);

    const lines = container.querySelectorAll('.skeletonLine');
    const lastLine = lines[lines.length - 1] as HTMLElement;
    expect(lastLine.style.width).toBe('60%');
  });

  it('should have aria-busy attribute for accessibility', () => {
    render(<SkeletonText />);

    const loading = screen.getByLabelText('Loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });
});

describe('SkeletonCard', () => {
  it('should render three skeleton lines', () => {
    const { container } = render(<SkeletonCard />);

    const lines = container.querySelectorAll('.skeletonLine');
    expect(lines.length).toBe(3);
  });

  it('should have aria-busy attribute', () => {
    render(<SkeletonCard />);

    const loading = screen.getByLabelText('Loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });

  it('should have card-specific class', () => {
    const { container } = render(<SkeletonCard />);

    expect(container.querySelector('.skeletonCard')).toBeInTheDocument();
  });
});

describe('SkeletonList', () => {
  it('should render 5 items by default', () => {
    const { container } = render(<SkeletonList />);

    const items = container.querySelectorAll('.skeletonListItem');
    expect(items.length).toBe(5);
  });

  it('should render the specified count of items', () => {
    const { container } = render(<SkeletonList count={3} />);

    const items = container.querySelectorAll('.skeletonListItem');
    expect(items.length).toBe(3);
  });

  it('should include circle avatars in list items', () => {
    const { container } = render(<SkeletonList count={2} />);

    const circles = container.querySelectorAll('.skeletonCircle');
    expect(circles.length).toBe(2);
  });

  it('should have aria-busy attribute', () => {
    render(<SkeletonList />);

    const loading = screen.getByLabelText('Loading');
    expect(loading).toHaveAttribute('aria-busy', 'true');
  });
});

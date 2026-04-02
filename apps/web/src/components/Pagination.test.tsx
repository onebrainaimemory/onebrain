import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

/**
 * Mock the AuthContext since Pagination uses useAuth for translations.
 */
vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'pagination.previous': 'Previous',
        'pagination.next': 'Next',
      };
      return translations[key] ?? key;
    },
    locale: 'en',
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('Pagination', () => {
  it('should render nothing when no more pages and no previous', () => {
    const { container } = render(<Pagination cursor={null} hasMore={false} onNext={() => {}} />);

    expect(container.innerHTML).toBe('');
  });

  it('should render Next button when hasMore is true', () => {
    render(<Pagination cursor="abc123" hasMore={true} onNext={() => {}} />);

    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('should disable Next button when no cursor', () => {
    render(<Pagination cursor={null} hasMore={true} onNext={() => {}} />);

    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  it('should call onNext with cursor when clicked', () => {
    const handleNext = vi.fn();
    render(<Pagination cursor="cursor-abc" hasMore={true} onNext={handleNext} />);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(handleNext).toHaveBeenCalledWith('cursor-abc');
  });

  it('should render Previous button when onPrevious is provided', () => {
    render(
      <Pagination
        cursor="abc"
        hasMore={true}
        onNext={() => {}}
        onPrevious={() => {}}
        hasPrevious={true}
      />,
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('should disable Previous button when hasPrevious is false', () => {
    render(
      <Pagination
        cursor="abc"
        hasMore={true}
        onNext={() => {}}
        onPrevious={() => {}}
        hasPrevious={false}
      />,
    );

    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  it('should call onPrevious when Previous button is clicked', () => {
    const handlePrevious = vi.fn();
    render(
      <Pagination
        cursor="abc"
        hasMore={true}
        onNext={() => {}}
        onPrevious={handlePrevious}
        hasPrevious={true}
      />,
    );

    const prevButton = screen.getByText('Previous');
    fireEvent.click(prevButton);

    expect(handlePrevious).toHaveBeenCalledTimes(1);
  });

  it('should render when hasPrevious is true even if hasMore is false', () => {
    render(
      <Pagination
        cursor={null}
        hasMore={false}
        onNext={() => {}}
        onPrevious={() => {}}
        hasPrevious={true}
      />,
    );

    expect(screen.getByText('Previous')).toBeInTheDocument();
  });
});

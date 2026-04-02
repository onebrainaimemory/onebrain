import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from './Toast';

describe('Toast', () => {
  it('should render the message text', () => {
    render(<Toast message="Operation successful" type="success" onClose={() => {}} />);

    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('should have role="alert" for accessibility', () => {
    render(<Toast message="Test" type="info" onClose={() => {}} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<Toast message="Test" type="error" onClose={handleClose} />);

    const closeButton = screen.getByLabelText('Close notification');
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should apply success type styling', () => {
    const { container } = render(<Toast message="Saved" type="success" onClose={() => {}} />);

    const toastElement = container.firstElementChild;
    expect(toastElement?.className).toContain('success');
  });

  it('should apply error type styling', () => {
    const { container } = render(<Toast message="Failed" type="error" onClose={() => {}} />);

    const toastElement = container.firstElementChild;
    expect(toastElement?.className).toContain('error');
  });

  it('should apply info type styling', () => {
    const { container } = render(<Toast message="Note" type="info" onClose={() => {}} />);

    const toastElement = container.firstElementChild;
    expect(toastElement?.className).toContain('info');
  });

  it('should have an accessible close button', () => {
    render(<Toast message="Test" type="success" onClose={() => {}} />);

    const closeButton = screen.getByLabelText('Close notification');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.tagName).toBe('BUTTON');
  });
});

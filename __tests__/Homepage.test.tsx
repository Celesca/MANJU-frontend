import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock child components used by Home to keep the test focused and lightweight
jest.mock('../../components/Navbar', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-navbar">Navbar</div>,
}));
jest.mock('../../components/Backgound', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-aurora">Aurora</div>,
}));
jest.mock('../../components/ContentCard', () => ({
  __esModule: true,
  default: (props: any) => <div data-testid="mock-cardswap">{props.children}</div>,
  Card: (props: any) => <div data-testid="mock-card">{props.children}</div>,
}));
jest.mock('../../components/Contenthome', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-contenthome">ContentInputPage</div>,
}));
jest.mock('../../components/GradientText', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="mock-gradient">{children}</div>,
}));
jest.mock('../../components/TextType', () => ({
  __esModule: true,
  default: ({ text, className }: any) => <div data-testid="mock-texttype" className={className}>{text}</div>,
}));
jest.mock('../../components/UserCardSwap', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-usercardswap">UserCardSwap</div>,
}));

import Homepage from '../src/pages/Home';

describe('Homepage', () => {
  test('renders welcome headline', () => {
    render(<Homepage />);
    // The Home.tsx uses the text "Welcome to MANJU!" inside TextWelcome
    const el = screen.getByText(/Welcome to MANJU!/i);
    expect(el).toBeInTheDocument();
  });
});

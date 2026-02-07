import { render, screen } from '@testing-library/react';
import Login from '../src/pages/Login';
import '@testing-library/jest-dom';

// Mock components
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);
jest.mock('../src/components/Backgound', () => () => <div data-testid="aurora">Aurora</div>);

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
}));

describe('Login Page', () => {
    it('renders without crashing', () => {
        render(<Login />);
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('aurora')).toBeInTheDocument();
    });

    it('displays the sign-in header', () => {
        render(<Login />);
        expect(screen.getAllByText(/Sign in with/i).length).toBeGreaterThan(0);
        // Google appears multiple times (Header, Button, Notes)
        expect(screen.getAllByText('Google').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/This app uses the backend to handle the OAuth flow securely/i).length).toBeGreaterThan(0);
    });

    it('contains the Google sign-in button with correct link', () => {
        render(<Login />);
        const link = screen.getByRole('link', { name: /Sign in with Google/i });
        const expectedLink = 'http://127.0.0.1:8080/auth/login/google';
        
        expect(link).toHaveAttribute('href', expectedLink);
    });

    it('renders developer notes', () => {
        render(<Login />);
        expect(screen.getByText('Developer Notes:')).toBeInTheDocument();
        expect(screen.getByText(/Ensure your Google OAuth client has redirect URI/i)).toBeInTheDocument();
    });
});

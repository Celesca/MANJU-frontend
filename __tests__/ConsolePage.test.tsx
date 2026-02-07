import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ConsolePage from '../src/pages/ConsolePage';
import useAuth from '../src/hooks/useAuth';
import '@testing-library/jest-dom';

// Mock child components
jest.mock('../src/components/ConsoleSidebar', () => () => <div data-testid="console-sidebar">Sidebar</div>);
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

// Mock useAuth hook
jest.mock('../src/hooks/useAuth');

describe('ConsolePage', () => {
    
    // Helper to mock auth state
    const mockAuth = (user: any, loading: boolean) => {
        (useAuth as jest.Mock).mockReturnValue({ user, loading });
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('displays loading spinner when loading', () => {
        mockAuth(null, true);
        render(
            <MemoryRouter>
                <ConsolePage />
            </MemoryRouter>
        );
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('redirects to login when no user is authenticated', () => {
        mockAuth(null, false);
        
        render(
            <MemoryRouter initialEntries={['/console']}>
                <Routes>
                    <Route path="/console" element={<ConsolePage />} />
                    <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('redirects from /console to /console/projects by default', () => {
        mockAuth({ id: 'user-1' }, false);

        render(
            <MemoryRouter initialEntries={['/console']}>
                <Routes>
                   <Route path="/console" element={<ConsolePage />}>
                        <Route path="projects" element={<div data-testid="projects-page">Projects Page</div>} />
                   </Route>
                   {/* Capture redirect */}
                   <Route path="/console/projects" element={<div data-testid="projects-page">Projects Page</div>} />
                </Routes>
            </MemoryRouter>
        );
        
        // This confirms the Navigate component triggered a redirect
        expect(screen.getByTestId('projects-page')).toBeInTheDocument();
    });

    it('renders layout (navbar, sidebar, outlet) when authenticated', () => {
        mockAuth({ id: 'user-1' }, false);

        render(
            <MemoryRouter initialEntries={['/console/settings']}>
                <Routes>
                    <Route path="/console" element={<ConsolePage />}>
                        <Route path="settings" element={<div data-testid="settings-content">Settings Content</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('console-sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });
});

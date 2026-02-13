import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Projects from '../src/pages/Projects';
import { apiFetch } from '../src/utils/api';
import '@testing-library/jest-dom';
import '@testing-library/jest-dom';

// Mock dependencies
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

jest.mock('../src/utils/api', () => ({
    apiFetch: jest.fn(),
}));

jest.mock('sweetalert2', () => ({
    fire: jest.fn(),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: any) => (
            <div className={className} onClick={onClick} {...props} data-testid="motion-div">
                {children}
            </div>
        ),
        button: ({ children, className, onClick, ...props }: any) => (
            <button className={className} onClick={onClick} {...props} data-testid="motion-button">
                {children}
            </button>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Projects', () => {
    const mockProjects = [
        {
            id: '1',
            name: 'Project Alpha',
            description: 'Test Description',
            status: 'active',
            created_at: '2023-10-01T10:00:00Z',
            updated_at: '2023-10-02T10:00:00Z',
        },
        {
            id: '2',
            name: 'Project Beta',
            description: '',
            status: 'draft',
            created_at: '2023-10-03T10:00:00Z',
            updated_at: null,
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (apiFetch as jest.Mock).mockImplementation((url) => {
            if (url.endsWith('/api/projects') && !url.includes('POST')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockProjects,
                });
            }
            return Promise.resolve({
                ok: true,
                json: async () => ({}),
            });
        });
    });

    it('renders project list after fetching', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Projects />
                </MemoryRouter>
            );
        });

        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(await screen.findByText('Project Alpha')).toBeInTheDocument();
        expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });

    it('handles search filtering', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <Projects />
                </MemoryRouter>
            );
        });

        await screen.findByText('Project Alpha');

        const searchInput = screen.getByPlaceholderText('Search projects...');
        fireEvent.change(searchInput, { target: { value: 'Alpha' } });

        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
        expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });

    it('opens create modal and creates project', async () => {
        const newProject = {
            id: '3',
            name: 'New Project',
            description: 'New Description',
            status: 'draft',
            created_at: new Date().toISOString(),
            updated_at: null,
        };

        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.endsWith('/api/projects') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    json: async () => newProject,
                });
            }
            if (url.endsWith('/api/projects')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockProjects,
                });
            }
            return Promise.resolve({ ok: false });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <Projects />
                </MemoryRouter>
            );
        });

        await screen.findByText('Project Alpha');

        // Click New Project button
        const newProjectBtn = screen.getByText('New Project');
        fireEvent.click(newProjectBtn);

        // Fill form
        const nameInput = screen.getByPlaceholderText('My Voice Workflow'); // Based on placeholder in code
        const descInput = screen.getByPlaceholderText('Describe your workflow...');

        fireEvent.change(nameInput, { target: { value: 'New Project' } });
        fireEvent.change(descInput, { target: { value: 'New Description' } });

        // Submit
        const createBtn = screen.getByRole('button', { name: 'Create' }); 
        await act(async () => {
            fireEvent.click(createBtn);
        });

        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/projects'), expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('New Project'),
        }));
    });
});

import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../src/pages/SettingsPage';
import { apiFetch } from '../src/utils/api';
import '@testing-library/jest-dom';

// Mock Dependencies
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

jest.mock('../src/hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id', name: 'Test User' },
        loading: false,
    }),
}));

jest.mock('../src/utils/api', () => ({
    apiFetch: jest.fn(),
}));

jest.mock('sweetalert2', () => ({
    fire: jest.fn(),
}));

jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, className, onClick, ...props }: any) => (
            <button className={className} onClick={onClick} {...props}>{children}</button>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('SettingsPage', () => {
    const mockKeys = [
        {
            id: 'key-1',
            label: 'Test Key 1',
            masked_key: 'sk-...test1',
            provider: 'openai',
            is_default: true,
        },
        {
            id: 'key-2',
            label: 'Test Key 2',
            masked_key: 'sk-...test2',
            provider: 'openai',
            is_default: false,
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock GET keys
        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.endsWith('/api-keys') && (!options || options.method === 'GET' || !options.method)) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockKeys,
                });
            }
            return Promise.resolve({ ok: false });
        });
    });

    it('renders and fetches API keys', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <SettingsPage />
                </MemoryRouter>
            );
        });

        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(await screen.findByText('Test Key 1')).toBeInTheDocument();
        expect(screen.getByText('Test Key 2')).toBeInTheDocument();
    });

    it('adds a new API key', async () => {
        const newKey = {
            id: 'key-3',
            label: 'New Key',
            masked_key: 'sk-...new',
            provider: 'openai',
            is_default: false,
        };

        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.endsWith('/api-keys') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    json: async () => newKey,
                });
            }
            // Default GET
             if (url.endsWith('/api-keys')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockKeys,
                });
            }
            return Promise.resolve({ ok: false });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <SettingsPage />
                </MemoryRouter>
            );
        });

        await screen.findByText('Test Key 1');

        const labelInput = screen.getByPlaceholderText('Label (e.g., Work Key, Personal)');
        const keyInput = screen.getByPlaceholderText('sk-...');

        fireEvent.change(labelInput, { target: { value: 'New Key' } });
        fireEvent.change(keyInput, { target: { value: 'sk-new-api-key' } });

        const addBtn = screen.getByText('Add API Key');
        await act(async () => {
            fireEvent.click(addBtn);
        });

        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api-keys'), expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('sk-new-api-key'),
        }));
    });
});

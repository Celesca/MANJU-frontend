import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VoicesContent from '../src/pages/VoicesContent';
import { apiFetch } from '../src/utils/api';
import '@testing-library/jest-dom';

// Mock Dependencies
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

jest.mock('framer-motion', () => {
    const MockComponent = ({ children, className, onClick, ...props }: any) => {
        // Filter out framer-motion props to avoid React warnings
        const validProps = { ...props };
        ['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'layout', 'layoutId'].forEach(prop => {
            delete validProps[prop];
        });
        
        return (
            <div className={className} onClick={onClick} {...validProps}>
                {children}
            </div>
        );
    };

    return {
        motion: {
            div: MockComponent,
            button: ({ children, className, onClick, ...props }: any) => {
                const validProps = { ...props };
                ['initial', 'animate', 'exit', 'variants', 'transition', 'whileHover', 'whileTap', 'layout', 'layoutId'].forEach(prop => {
                    delete validProps[prop];
                });
                return (
                    <button className={className} onClick={onClick} {...validProps}>
                        {children}
                    </button>
                );
            },
        },
        AnimatePresence: ({ children }: any) => <>{children}</>,
    };
});

// Mock Child Components to avoid deep testing
jest.mock('../src/components/VoiceCard', () => ({ voice, onPlay, onDelete }: any) => (
    <div data-testid="voice-card">
        {voice.voice_name}
        <button onClick={onPlay}>Play</button>
        <button onClick={onDelete}>Delete</button>
    </div>
));

jest.mock('../src/components/VoiceAudioPlayer', () => () => <div data-testid="audio-player">Audio Player</div>);

describe('VoicesContent', () => {
    const mockVoices = [
        {
            id: 'voice-1',
            voice_name: 'My Voice 1',
            voice_url: 'http://test.com/audio1.wav',
            ref_text: 'Ref Text',
            gender: 'Male',
            language: 'en',
            created_at: '2023-10-01T10:00:00Z',
        },
        {
            id: 'voice-2',
            voice_name: 'My Voice 2',
            voice_url: 'http://test.com/audio2.wav',
            created_at: '2023-10-02T10:00:00Z',
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock GET voices
        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.includes('/api/voices/user/') && (!options || options.method === 'GET' || !options.method)) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockVoices,
                });
            }
            return Promise.resolve({ ok: false });
        });
    });

    it('renders and fetches voice list', async () => {
        await act(async () => {
            render(
                <MemoryRouter>
                    <VoicesContent />
                </MemoryRouter>
            );
        });

        expect(screen.getByText('My Voices')).toBeInTheDocument();
        expect(await screen.findByText('My Voice 1')).toBeInTheDocument();
        expect(screen.getByText('My Voice 2')).toBeInTheDocument();
    });

    it('handles voice deletion', async () => {
        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.includes('/api/voices/user/')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockVoices,
                });
            }
            if (url.includes('/api/voices/') && options?.method === 'DELETE') {
                return Promise.resolve({ ok: true });
            }
            return Promise.resolve({ ok: false });
        });

        // Mock SweetAlert confirm
        const Swal = require('sweetalert2');
        Swal.fire.mockResolvedValue({ isConfirmed: true });

        await act(async () => {
            render(
                <MemoryRouter>
                    <VoicesContent />
                </MemoryRouter>
            );
        });

        await screen.findByText('My Voice 1');

        // Find delete button for first voice (mocked VoiceCard)
        const deleteBtns = screen.getAllByText('Delete');
        fireEvent.click(deleteBtns[0]);

        // Wait for async operations
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/voices/voice-2'), expect.objectContaining({
            method: 'DELETE',
        }));
    });
});

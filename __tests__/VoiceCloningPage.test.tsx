import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VoiceCloningPage from '../src/pages/VoiceCloningPage';
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

jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
        button: ({ children, className, onClick, ...props }: any) => (
            <button className={className} onClick={onClick} {...props}>{children}</button>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock URL.createObjectURL and revokeObjectURL
window.URL.createObjectURL = jest.fn(() => 'blob:test-url');
window.URL.revokeObjectURL = jest.fn();

describe('VoiceCloningPage', () => {
    const mockVoices = [
        {
            id: 'voice-1',
            voice_name: 'Test Voice 1',
            voice_url: 'http://test.com/audio1.wav',
            ref_text: 'Ref Text',
            gender: 'Male',
            language: 'en',
            created_at: '2023-10-01T10:00:00Z',
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

    it('renders and fetches voices', async () => {
        await act(async () => {
             render(
                <MemoryRouter>
                    <VoiceCloningPage />
                </MemoryRouter>
            );
        });

        expect(screen.getByText('Voice Cloning')).toBeInTheDocument();
        
        // Open dropdown to see voices
        const selectBtn = screen.getByText('Select a voice'); // Initially no voice selected
        fireEvent.click(selectBtn);
        
        expect(await screen.findByText('Test Voice 1')).toBeInTheDocument();
    });

    it('handles voice generation workflow', async () => {
        (apiFetch as jest.Mock).mockImplementation((url, options) => {
            if (url.includes('/api/voices/user/')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mockVoices,
                });
            }
            if (url.endsWith('/clone') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    blob: async () => new Blob(['audio data'], { type: 'audio/wav' }),
                });
            }
            return Promise.resolve({ ok: false });
        });

        await act(async () => {
            render(
                <MemoryRouter>
                    <VoiceCloningPage />
                </MemoryRouter>
            );
        });

        // 1. Select Voice
        const selectBtn = screen.getByText('Select a voice');
        fireEvent.click(selectBtn);
        const voiceOption = await screen.findByText('Test Voice 1');
        fireEvent.click(voiceOption);

        expect(screen.getByText('Test Voice 1')).toBeInTheDocument(); // Selected

        // 2. Enter Text
        const textArea = screen.getByPlaceholderText('Enter the text you want to convert to speech...');
        fireEvent.change(textArea, { target: { value: 'Hello world' } });

        // 3. Click Generate
        const generateBtn = screen.getByText('Generate Speech');
        await act(async () => {
            fireEvent.click(generateBtn);
        });

        expect(apiFetch).toHaveBeenCalledWith(expect.stringContaining('/clone'), expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Hello world'),
        }));

        // 4. Check if audio player appears (mocked checks)
        expect(await screen.findByText('Generated Audio')).toBeInTheDocument();
    });
});

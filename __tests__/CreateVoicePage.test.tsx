import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreateVoicePage from '../src/pages/CreateVoicePage';
import { useAuth } from '../src/hooks/useAuth';
import { apiFetch } from '../src/utils/api';
import Swal from 'sweetalert2';
import '@testing-library/jest-dom';

// Mocks
jest.mock('../src/hooks/useAuth');
jest.mock('../src/utils/api');
jest.mock('sweetalert2');
jest.mock('../src/components/VoiceAudioPlayer', () => () => <div data-testid="voice-player">Audio Player</div>);

// Mock getEnv to avoid import.meta errors if not already mocked globally or handled
jest.mock('../src/utils/env', () => ({
    getEnv: jest.fn().mockReturnValue('http://localhost:8080')
}));

// Mock URL.createObjectURL
URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/mock-url');
URL.revokeObjectURL = jest.fn();

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate
}));

describe('CreateVoicePage', () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };

    beforeEach(() => {
        jest.clearAllMocks();
        (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    });

    it('renders step 1 (upload) initially', () => {
        render(
            <MemoryRouter>
                <CreateVoicePage />
            </MemoryRouter>
        );
        expect(screen.getByText('Create new voice')).toBeInTheDocument();
        expect(screen.getByText('Upload voice file')).toBeInTheDocument();
        expect(screen.getByText(/Click to upload or drag and drop/i)).toBeInTheDocument();
    });

    it('handles file selection', async () => {
        render(
            <MemoryRouter>
                <CreateVoicePage />
            </MemoryRouter>
        );

        const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
        // const input = screen.getByLabelText(/Click to upload or drag and drop/i).querySelector('input[type="file"]');
        
        // Find input by cleaner selector if label isn't working perfectly with complex markup
        // Actually, the input is hidden, so we need to find it directly
        // The accessible way is by label, but the label wraps everything.
        // Let's rely on firing event on the input element which we can find by type.
        // Or simpler:
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => {
            expect(screen.getByText('test.mp3')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('navigates to step 2 when Continue is clicked', async () => {
        render(
            <MemoryRouter>
                <CreateVoicePage />
            </MemoryRouter>
        );

        const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [file] } });

        await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument());

        fireEvent.click(screen.getByText('Continue'));

        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter voice name')).toBeInTheDocument();
    });

    it('submits form correctly', async () => {
        (apiFetch as jest.Mock).mockImplementation((url) => {
            if (url.includes('/upload')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ url: '/uploads/test.mp3' })
                });
            }
            if (url.includes('/api/voices')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'voice-1' })
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });

        render(
            <MemoryRouter>
                <CreateVoicePage />
            </MemoryRouter>
        );

        // Step 1
        const file = new File(['audio content'], 'test.mp3', { type: 'audio/mp3' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(fileInput, { target: { files: [file] } });
        
        await waitFor(() => expect(screen.getByText('Continue')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Continue'));

        // Step 2
        fireEvent.change(screen.getByPlaceholderText('Enter voice name'), { target: { value: 'My Voice' } });
        fireEvent.click(screen.getByText('Create'));

        await waitFor(() => {
            expect(apiFetch).toHaveBeenCalledTimes(2);
            expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Voice Created!',
                icon: 'success'
            }));
            expect(mockNavigate).toHaveBeenCalledWith('/console/voices');
        });
    });
});

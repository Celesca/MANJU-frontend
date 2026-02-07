import { render, screen, fireEvent } from '@testing-library/react';
import VoiceStudio from '../src/pages/Voice';
import '@testing-library/jest-dom';

// Mock child components
jest.mock('../src/components/VoiceInputOutput', () => {
  return ({ mode }: any) => <div data-testid="voice-input-output">Mode: {mode}</div>;
});

jest.mock('../src/components/VoiceControls', () => {
  return () => <div data-testid="voice-controls">VoiceControls</div>;
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Mic: () => <span>MicIcon</span>,
  Type: () => <span>TypeIcon</span>,
  Settings2: () => <span>SettingsIcon</span>,
  Sparkles: () => <span>SparklesIcon</span>,
}));

describe('VoiceStudio Page', () => {
  it('renders the header and title correctly', () => {
    render(<VoiceStudio />);
    expect(screen.getByText('AI Studio')).toBeInTheDocument();
    expect(screen.getByText('แปลงเสียงเป็นอักษร และเสกอักษรให้มีเสียง')).toBeInTheDocument();
  });

  it('renders mode switching buttons', () => {
    render(<VoiceStudio />);
    expect(screen.getByText('Text to Voice')).toBeInTheDocument();
    expect(screen.getByText('Voice to Text')).toBeInTheDocument();
  });

  it('defaults to "text-to-voice" mode', () => {
    render(<VoiceStudio />);
    // Check if child component receives the correct default mode
    expect(screen.getByTestId('voice-input-output')).toHaveTextContent('Mode: text-to-voice');
  });

  it('switches mode when buttons are clicked', () => {
    render(<VoiceStudio />);
    
    // Switch to Voice to Text
    fireEvent.click(screen.getByText('Voice to Text'));
    expect(screen.getByTestId('voice-input-output')).toHaveTextContent('Mode: voice-to-text');

    // Switch back to Text to Voice
    fireEvent.click(screen.getByText('Text to Voice'));
    expect(screen.getByTestId('voice-input-output')).toHaveTextContent('Mode: text-to-voice');
  });

  it('renders the controls sidebar', () => {
    render(<VoiceStudio />);
    expect(screen.getByTestId('voice-controls')).toBeInTheDocument();
    expect(screen.getByText('Studio Controls')).toBeInTheDocument();
  });

  it('displays the pro tip', () => {
    render(<VoiceStudio />);
    expect(screen.getByText(/Pro Tip:/i)).toBeInTheDocument();
  });
});

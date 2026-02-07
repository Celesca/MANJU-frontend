
import { render, screen, act } from '@testing-library/react';
import Home from '../src/pages/Home';
import '@testing-library/jest-dom';

// Mock components
jest.mock('../src/components/ContentCard', () => {
    return {
        __esModule: true,
        default: ({ children }: any) => <div data-testid="card-swap">{children}</div>,
        Card: ({ children }: any) => <div data-testid="card">{children}</div>
    };
});
jest.mock('../src/components/GradientText', () => ({ children }: any) => <div data-testid="gradient-text">{children}</div>);
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);
jest.mock('../src/components/TextType', () => ({ text }: any) => <div data-testid="text-welcome">{text}</div>);
jest.mock('../src/components/Backgound', () => () => <div data-testid="aurora">Aurora</div>);
jest.mock('../src/components/UserCardSwap', () => () => <div data-testid="user-card-swap">UserCardSwap</div>);
jest.mock('../src/pages/Voice', () => () => <div data-testid="voice-studio">VoiceStudio</div>);
jest.mock('../src/components/TutorialSection', () => () => <div data-testid="tutorial-section">TutorialSection</div>);
jest.mock('../src/components/Techstack', () => () => <div data-testid="techstack-section">TechStackSection</div>);
jest.mock('../src/components/Footer', () => () => <div data-testid="footer">Footer</div>);
jest.mock('../src/components/FAQ', () => () => <div data-testid="faq-page">FaqPage</div>);

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
}));

describe('Home Component', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('renders without crashing', () => {
        render(<Home />);
        // Check for main sections
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        expect(screen.getByTestId('aurora')).toBeInTheDocument();
        expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('displays initial welcome text', () => {
        render(<Home />);
        // TextWelcome is mocked to display the text prop
        expect(screen.getByText('MANJU')).toBeInTheDocument();
        expect(screen.queryByText('Multi-Agent AI for Natural Just-in-time Understanding')).not.toBeInTheDocument();
    });

    it('toggles text after 10 seconds', () => {
        render(<Home />);

        // Initial state
        expect(screen.getByText('MANJU')).toBeInTheDocument();

        // Fast-forward 10 seconds
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        // Current state: showFirst is false
        // TextWelcome should show the long text
        expect(screen.getByText('Multi-Agent AI for Natural Just-in-time Understanding')).toBeInTheDocument();
        expect(screen.queryByText('MANJU')).not.toBeInTheDocument();

        // Fast-forward another 10 seconds
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        // Back to initial state
        expect(screen.getByText('MANJU')).toBeInTheDocument();
    });

    it('renders key sections', () => {
        render(<Home />);
        expect(screen.getByTestId('voice-studio')).toBeInTheDocument();
        expect(screen.getByTestId('tutorial-section')).toBeInTheDocument();
        expect(screen.getByTestId('techstack-section')).toBeInTheDocument();
        expect(screen.getByTestId('faq-page')).toBeInTheDocument();
    });
});


import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FeaturesSection from '../src/pages/FeaturesSection';
import '@testing-library/jest-dom';

// Mock Navbar since it's used in the component
jest.mock('../src/components/Navbar', () => () => <div data-testid="navbar">Navbar</div>);

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, onClick, ...props }: any) => (
            <div className={className} onClick={onClick} {...props}>
                {children}
            </div>
        ),
        button: ({ children, className, onClick, ...props }: any) => (
            <button className={className} onClick={onClick} {...props}>
                {children}
            </button>
        ),
        h2: ({ children, className, ...props }: any) => (
            <h2 className={className} {...props}>{children}</h2>
        ),
        p: ({ children, className, ...props }: any) => (
            <p className={className} {...props}>{children}</p>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('FeaturesSection', () => {
    it('renders the navbar', () => {
        render(
            <MemoryRouter>
                <FeaturesSection />
            </MemoryRouter>
        );
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    it('renders the main title', () => {
        render(
            <MemoryRouter>
                <FeaturesSection />
            </MemoryRouter>
        );
        expect(screen.getByText(/MANJU:/i)).toBeInTheDocument();
        expect(screen.getByText(/Multi-Agent AI/i)).toBeInTheDocument();
        expect(screen.getByText(/ระบบผู้ช่วยอัจฉริยะ/i)).toBeInTheDocument();
    });

    it('renders default tab content (highlights)', () => {
        render(
            <MemoryRouter>
                <FeaturesSection />
            </MemoryRouter>
        );
        // Check for specific content related to 'highlights' tab (Platform Features)
        expect(screen.getByText(/Go Execution Engine/i)).toBeInTheDocument();
        expect(screen.getByText(/Vector Memory \(RAG\)/i)).toBeInTheDocument();
    });

    it('switches to Architecture tab', () => {
        render(
            <MemoryRouter>
                <FeaturesSection />
            </MemoryRouter>
        );
        
        const architectureTab = screen.getByText('System Architecture');
        fireEvent.click(architectureTab);

        // Check content for Architecture tab
        const supervisors = screen.getAllByText(/Supervisor Agent/i);
        expect(supervisors.length).toBeGreaterThan(0);
        const knowledgeAgents = screen.getAllByText(/Knowledge Agent/i);
        expect(knowledgeAgents.length).toBeGreaterThan(0);
    });

    it('switches to Pipeline tab', () => {
        render(
            <MemoryRouter>
                <FeaturesSection />
            </MemoryRouter>
        );

        const pipelineTab = screen.getByText('Processing Pipeline');
        fireEvent.click(pipelineTab);

        // Check content for Pipeline tab
        const typhoons = screen.getAllByText(/Typhoon ASR/i);
        expect(typhoons.length).toBeGreaterThan(0);
        const inputs = screen.getAllByText(/Voice Input & ASR/i);
        expect(inputs.length).toBeGreaterThan(0);
    });
});
